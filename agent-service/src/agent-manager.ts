import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { db, getAgent, getAllAgents, upsertAgent, deleteAgent, insertLog } from "./db.js";
import {
  AgentInfo,
  AgentConfig,
  AgentStatus,
  AgentType,
  AgentMessage,
  LogEntry,
  LogLevel,
} from "./types.js";

export class AgentManager extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly HEARTBEAT_TIMEOUT = 30000;

  constructor() {
    super();
    try {
      this.restoreAgents();
    } catch {
      // DB not initialized yet - restoreAgents will be called after initDb()
    }
  }

  restoreAgents(): void {
    const agents = getAllAgents(db);
    for (const agent of agents) {
      if (agent.status === "running" && agent.pid) {
        agent.status = "error";
        agent.message = "Process lost on service restart";
        agent.stoppedAt = new Date();
        agent.exitCode = -1;
        upsertAgent(db, agent);
        this.emit("log", {
          agentId: agent.id,
          level: "warn",
          message: `Agent ${agent.id} marked as error due to service restart`,
          timestamp: new Date(),
        } as LogEntry);
      }
    }
  }

  async startAgent(config: AgentConfig): Promise<AgentInfo> {
    const existing = getAgent(db, config.id);
    if (existing && existing.status === "running") {
      throw new Error(`Agent ${config.id} is already running`);
    }

    const agent: AgentInfo = {
      id: config.id,
      type: config.type,
      config,
      pid: null,
      status: "initializing",
      startedAt: new Date(),
      stoppedAt: null,
      exitCode: null,
      uptime: 0,
      cpuPercent: 0,
      memoryMb: 0,
      lastHeartbeat: null,
      message: "Starting...",
    };

    upsertAgent(db, agent);

    try {
      const child = this.spawnProcess(config);
      agent.pid = child.pid || null;
      agent.status = "running";
      agent.message = "Running";
      upsertAgent(db, agent);

      this.processes.set(config.id, child);
      this.setupProcessHandlers(config.id, child);
      this.startHeartbeatMonitor(config.id);

      this.emit("agent-started", agent);
      return agent;
    } catch (error) {
      agent.status = "error";
      agent.message = error instanceof Error ? error.message : "Unknown error";
      agent.stoppedAt = new Date();
      upsertAgent(db, agent);
      throw error;
    }
  }

  private spawnProcess(config: AgentConfig): ChildProcess {
    const env = { ...process.env, ...config.env };
    const child = spawn(config.command, config.args, {
      cwd: config.cwd || process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    return child;
  }

  private setupProcessHandlers(agentId: string, child: ChildProcess): void {
    child.stdout?.on("data", (data) => {
      this.handleStdout(agentId, data.toString());
    });

    child.stderr?.on("data", (data) => {
      this.handleStderr(agentId, data.toString());
    });

    child.on("exit", (code, signal) => {
      this.handleExit(agentId, code, signal);
    });

    child.on("error", (error) => {
      this.handleError(agentId, error);
    });
  }

  private handleStdout(agentId: string, data: string): void {
    const lines = data.trim().split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message: AgentMessage = JSON.parse(line);
        this.processAgentMessage(agentId, message);
      } catch {
        insertLog(db, {
          agentId,
          level: "info",
          message: line,
          timestamp: new Date(),
          raw: true,
        });
        this.emit("log", {
          agentId,
          level: "info",
          message: line,
          timestamp: new Date(),
          raw: true,
        } as LogEntry);
      }
    }
  }

  private handleStderr(agentId: string, data: string): void {
    const lines = data.trim().split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      insertLog(db, {
        agentId,
        level: "error",
        message: line,
        timestamp: new Date(),
        raw: true,
      });
      this.emit("log", {
        agentId,
        level: "error",
        message: line,
        timestamp: new Date(),
        raw: true,
      } as LogEntry);
    }
  }

  private processAgentMessage(agentId: string, message: AgentMessage): void {
    const agent = getAgent(db, agentId);
    if (!agent) return;

    switch (message.type) {
      case "heartbeat":
        agent.lastHeartbeat = new Date(message.ts);
        agent.status = "running";
        agent.message = "Healthy";
        upsertAgent(db, agent);
        this.resetHeartbeatTimer(agentId);
        break;

      case "status":
        agent.status = message.state;
        agent.message = message.msg;
        if (message.state === "completed" || message.state === "error") {
          agent.stoppedAt = new Date();
        }
        upsertAgent(db, agent);
        this.emit("agent-status", agent);
        break;

      case "cost":
        this.emit("cost", {
          agentId: message.agent_id,
          provider: message.provider,
          model: message.model,
          tokensIn: message.tokens_in,
          tokensOut: message.tokens_out,
          timestamp: new Date(),
        });
        break;

      case "log":
        const logEntry = {
          agentId,
          level: message.level,
          message: message.msg,
          timestamp: new Date(),
        };
        insertLog(db, logEntry);
        this.emit("log", logEntry);
        break;
    }
  }

  private handleExit(agentId: string, code: number | null, signal: string | null): void {
    const agent = getAgent(db, agentId);
    if (!agent) return;

    this.clearHeartbeatTimer(agentId);
    this.processes.delete(agentId);

    agent.pid = null;
    agent.status = code === 0 ? "completed" : "error";
    agent.exitCode = code;
    agent.stoppedAt = new Date();
    agent.message = signal ? `Terminated by signal ${signal}` : `Exited with code ${code ?? "unknown"}`;
    upsertAgent(db, agent);

    this.emit("agent-stopped", agent);
  }

  private handleError(agentId: string, error: Error): void {
    const agent = getAgent(db, agentId);
    if (!agent) return;

    agent.status = "error";
    agent.message = error.message;
    agent.stoppedAt = new Date();
    upsertAgent(db, agent);

    this.emit("log", {
      agentId,
      level: "error",
      message: `Process error: ${error.message}`,
      timestamp: new Date(),
    } as LogEntry);
  }

  async stopAgent(agentId: string): Promise<void> {
    const child = this.processes.get(agentId);
    if (!child) {
      const agent = getAgent(db, agentId);
      if (agent && agent.status === "running") {
        agent.status = "error";
        agent.message = "Process not found";
        agent.stoppedAt = new Date();
        upsertAgent(db, agent);
      }
      return;
    }

    child.kill("SIGTERM");

    setTimeout(() => {
      if (this.processes.has(agentId)) {
        child.kill("SIGKILL");
      }
    }, 5000);
  }

  async restartAgent(agentId: string): Promise<AgentInfo> {
    const agent = getAgent(db, agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await this.stopAgent(agentId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return this.startAgent(agent.config);
  }

  getAgent(agentId: string): AgentInfo | null {
    return getAgent(db, agentId);
  }

  getAllAgents(): AgentInfo[] {
    return getAllAgents(db);
  }

  private startHeartbeatMonitor(agentId: string): void {
    this.resetHeartbeatTimer(agentId);
  }

  private resetHeartbeatTimer(agentId: string): void {
    this.clearHeartbeatTimer(agentId);
    const timer = setTimeout(() => {
      const agent = getAgent(db, agentId);
      if (agent && agent.status === "running") {
        agent.status = "error";
        agent.message = "Heartbeat timeout";
        agent.stoppedAt = new Date();
        upsertAgent(db, agent);
        this.emit("log", {
          agentId,
          level: "warn",
          message: "Heartbeat timeout - agent marked as error",
          timestamp: new Date(),
        } as LogEntry);
        this.emit("agent-heartbeat-timeout", agent);
      }
    }, this.HEARTBEAT_TIMEOUT);
    this.heartbeatTimers.set(agentId, timer);
  }

  private clearHeartbeatTimer(agentId: string): void {
    const timer = this.heartbeatTimers.get(agentId);
    if (timer) {
      clearTimeout(timer);
      this.heartbeatTimers.delete(agentId);
    }
  }

  shutdown(): void {
    for (const [agentId, child] of this.processes) {
      child.kill("SIGTERM");
    }
    for (const timer of this.heartbeatTimers.values()) {
      clearTimeout(timer);
    }
    this.processes.clear();
    this.heartbeatTimers.clear();
  }
}

export const agentManager = new AgentManager();