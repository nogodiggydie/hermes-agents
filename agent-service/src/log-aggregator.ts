import { WebSocket, WebSocketServer } from "ws";
import { db, getAllAgents } from "./db.js";
import { LogEntry, LogLevel, AgentMessage } from "./types.js";

interface LogSubscriber {
  ws: WebSocket;
  agentId?: string;
  levelFilter?: LogLevel[];
}

export class LogAggregator {
  private subscribers: Map<WebSocket, LogSubscriber> = new Map();
  private readonly maxHistoryLines = 500;

  constructor() {}

  handleAgentOutput(agentId: string, data: string, isStderr: boolean = false): void {
    const lines = data.trim().split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      this.processLine(agentId, line, isStderr);
    }
  }

  private processLine(agentId: string, line: string, isStderr: boolean): void {
    let entry: LogEntry | null = null;

    try {
      const parsed = JSON.parse(line) as AgentMessage;
      entry = this.parseAgentMessage(agentId, parsed);
    } catch {
      entry = {
        id: 0,
        agentId,
        level: isStderr ? "error" : "info",
        message: line,
        timestamp: new Date(),
        raw: true,
      };
    }

    if (entry) {
      this.storeLogEntry(entry);
      this.broadcast(entry);
    }
  }

  private parseAgentMessage(agentId: string, msg: AgentMessage): LogEntry | null {
    const timestamp = new Date();

    switch (msg.type) {
      case "heartbeat":
        return null;
      case "status":
        return {
          id: 0,
          agentId,
          level: "info",
          message: `[${msg.state.toUpperCase()}] ${msg.msg}`,
          timestamp,
          raw: false,
        };
      case "cost":
        return {
          id: 0,
          agentId,
          level: "info",
          message: `[COST] ${msg.provider}/${msg.model}: ${msg.tokens_in} in, ${msg.tokens_out} out`,
          timestamp,
          raw: false,
        };
      case "log":
        return {
          id: 0,
          agentId,
          level: msg.level,
          message: msg.msg,
          timestamp,
          raw: false,
        };
      default:
        return null;
    }
  }

  private storeLogEntry(entry: LogEntry): void {
    const stmt = db.prepare(`
      INSERT INTO logs (agent_id, level, message, timestamp, raw)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      entry.agentId,
      entry.level,
      entry.message,
      entry.timestamp.getTime(),
      entry.raw ? 1 : 0
    );
    entry.id = result.lastInsertRowid as number;

    const count = db.prepare("SELECT COUNT(*) as cnt FROM logs WHERE agent_id = ?").get(entry.agentId) as { cnt: number };
    if (count.cnt > this.maxHistoryLines) {
      const deleteCount = count.cnt - this.maxHistoryLines;
      db.prepare(`
        DELETE FROM logs
        WHERE agent_id = ? AND id IN (
          SELECT id FROM logs WHERE agent_id = ? ORDER BY timestamp ASC LIMIT ?
        )
      `).run(entry.agentId, entry.agentId, deleteCount);
    }
  }

  private broadcast(entry: LogEntry): void {
    const message = JSON.stringify({
      type: "log",
      data: entry,
    });

    for (const [ws, sub] of this.subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        if (sub.agentId && sub.agentId !== entry.agentId) continue;
        if (sub.levelFilter && !sub.levelFilter.includes(entry.level)) continue;
        ws.send(message);
      }
    }
  }

  subscribe(ws: WebSocket, agentId?: string, levelFilter?: LogLevel[]): void {
    this.subscribers.set(ws, { ws, agentId, levelFilter });

    ws.on("close", () => {
      this.subscribers.delete(ws);
    });

    ws.on("error", () => {
      this.subscribers.delete(ws);
    });
  }

  getRecentLogs(agentId?: string, limit: number = 100): LogEntry[] {
    let query = "SELECT * FROM logs";
    const params: (string | number)[] = [];

    if (agentId) {
      query += " WHERE agent_id = ?";
      params.push(agentId);
    }

    query += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];
    return rows
      .reverse()
      .map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        level: row.level as LogLevel,
        message: row.message,
        timestamp: new Date(row.timestamp),
        raw: Boolean(row.raw),
      }));
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }
}

export const logAggregator = new LogAggregator();