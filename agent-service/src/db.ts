import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  AgentInfo,
  SystemMetrics,
  AgentMetrics,
  LogEntry,
  CostEntry,
  CostSummary,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, "..", "..", "data", "agent-service.db");

// Singleton database instance
let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma("journal_mode = WAL");
  }
  return dbInstance;
}

// Export singleton instance for convenience
export const db = getDb();
  return dbInstance;
}

export const db = getDb();

export function initDb(): Database.Database {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      command TEXT NOT NULL,
      args TEXT NOT NULL,
      env TEXT,
      cwd TEXT,
      pid INTEGER,
      status TEXT NOT NULL DEFAULT 'initializing',
      started_at INTEGER,
      stopped_at INTEGER,
      exit_code INTEGER,
      uptime INTEGER DEFAULT 0,
      cpu_percent REAL DEFAULT 0,
      memory_mb REAL DEFAULT 0,
      last_heartbeat INTEGER,
      message TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS system_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cpu_overall REAL NOT NULL,
      cpu_cores TEXT NOT NULL,
      memory_total INTEGER NOT NULL,
      memory_used INTEGER NOT NULL,
      memory_free INTEGER NOT NULL,
      memory_percent REAL NOT NULL,
      disk_total INTEGER NOT NULL,
      disk_used INTEGER NOT NULL,
      disk_free INTEGER NOT NULL,
      disk_percent REAL NOT NULL,
      network_rx_bytes INTEGER NOT NULL,
      network_tx_bytes INTEGER NOT NULL,
      network_rx_sec INTEGER NOT NULL,
      network_tx_sec INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      cpu_percent REAL NOT NULL,
      memory_mb REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_time ON agent_metrics(agent_id, timestamp);

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      raw INTEGER DEFAULT 0,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_logs_agent_time ON logs(agent_id, timestamp);

    CREATE TABLE IF NOT EXISTS costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      tokens_in INTEGER NOT NULL,
      tokens_out INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_costs_agent_time ON costs(agent_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_costs_provider_time ON costs(provider, timestamp);

    CREATE TABLE IF NOT EXISTS pricing (
      provider TEXT PRIMARY KEY,
      model TEXT NOT NULL,
      input_price_per_1k REAL NOT NULL,
      output_price_per_1k REAL NOT NULL
    );
  `);

  const defaultPricing = [
    ["kilo-gateway", "claude-sonnet-4", 0.003, 0.015],
    ["kilo-gateway", "claude-opus-4", 0.015, 0.075],
    ["kilo-gateway", "gpt-4o", 0.005, 0.015],
    ["kilo-gateway", "gpt-4o-mini", 0.00015, 0.0006],
    ["gemini", "gemini-1.5-pro", 0.00125, 0.005],
    ["gemini", "gemini-1.5-flash", 0.000075, 0.0003],
    ["gemini", "gemini-2.0-flash", 0.000075, 0.0003],
    ["codex", "gpt-4o", 0.005, 0.015],
    ["codex", "gpt-4o-mini", 0.00015, 0.0006],
    ["copilot", "gpt-4o", 0.005, 0.015],
    ["copilot", "gpt-4o-mini", 0.00015, 0.0006],
    ["claude-code", "claude-sonnet-4", 0.003, 0.015],
    ["claude-code", "claude-opus-4", 0.015, 0.075],
  ];

  const insertPricing = db.prepare(`
    INSERT OR IGNORE INTO pricing (provider, model, input_price_per_1k, output_price_per_1k)
    VALUES (?, ?, ?, ?)
  `);

  for (const [provider, model, inPrice, outPrice] of defaultPricing) {
    insertPricing.run(provider, model, inPrice, outPrice);
  }

  return db;
}

export function getAgent(db: Database.Database, id: string): AgentInfo | null {
  const row = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
  return row ? mapRowToAgent(row) : null;
}

export function getAllAgents(db: Database.Database): AgentInfo[] {
  const rows = db.prepare("SELECT * FROM agents ORDER BY started_at DESC").all();
  return rows.map(mapRowToAgent);
}

export function upsertAgent(db: Database.Database, agent: AgentInfo): void {
  db.prepare(`
    INSERT INTO agents (id, type, command, args, env, cwd, pid, status, started_at, stopped_at, exit_code, uptime, cpu_percent, memory_mb, last_heartbeat, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      command = excluded.command,
      args = excluded.args,
      env = excluded.env,
      cwd = excluded.cwd,
      pid = excluded.pid,
      status = excluded.status,
      started_at = excluded.started_at,
      stopped_at = excluded.stopped_at,
      exit_code = excluded.exit_code,
      uptime = excluded.uptime,
      cpu_percent = excluded.cpu_percent,
      memory_mb = excluded.memory_mb,
      last_heartbeat = excluded.last_heartbeat,
      message = excluded.message
  `).run(
    agent.id,
    agent.type,
    agent.config.command,
    JSON.stringify(agent.config.args),
    JSON.stringify(agent.config.env || {}),
    agent.config.cwd || null,
    agent.pid,
    agent.status,
    agent.startedAt?.getTime() || null,
    agent.stoppedAt?.getTime() || null,
    agent.exitCode,
    agent.uptime,
    agent.cpuPercent,
    agent.memoryMb,
    agent.lastHeartbeat?.getTime() || null,
    agent.message
  );
}

export function deleteAgent(db: Database.Database, id: string): void {
  db.prepare("DELETE FROM agents WHERE id = ?").run(id);
}

export function insertSystemMetrics(db: Database.Database, metrics: SystemMetrics): void {
  db.prepare(`
    INSERT INTO system_metrics (
      cpu_overall, cpu_cores, memory_total, memory_used, memory_free, memory_percent,
      disk_total, disk_used, disk_free, disk_percent,
      network_rx_bytes, network_tx_bytes, network_rx_sec, network_tx_sec, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    metrics.cpu.overall,
    JSON.stringify(metrics.cpu.cores),
    metrics.memory.total,
    metrics.memory.used,
    metrics.memory.free,
    metrics.memory.percent,
    metrics.disk.total,
    metrics.disk.used,
    metrics.disk.free,
    metrics.disk.percent,
    metrics.network.rxBytes,
    metrics.network.txBytes,
    metrics.network.rxSec,
    metrics.network.txSec,
    metrics.timestamp.getTime()
  );
}

export function getSystemMetricsHistory(
  db: Database.Database,
  limit: number = 288
): SystemMetrics[] {
  const rows = db.prepare(`
    SELECT * FROM system_metrics ORDER BY timestamp DESC LIMIT ?
  `).all(limit);
  return rows.reverse().map(mapRowToSystemMetrics);
}

export function insertAgentMetrics(db: Database.Database, metrics: AgentMetrics): void {
  db.prepare(`
    INSERT INTO agent_metrics (agent_id, cpu_percent, memory_mb, timestamp)
    VALUES (?, ?, ?, ?)
  `).run(metrics.agentId, metrics.cpuPercent, metrics.memoryMb, metrics.timestamp.getTime());
}

export function getAgentMetricsHistory(
  db: Database.Database,
  agentId: string,
  limit: number = 288
): AgentMetrics[] {
  const rows = db.prepare(`
    SELECT * FROM agent_metrics WHERE agent_id = ? ORDER BY timestamp DESC LIMIT ?
  `).all(agentId, limit);
  return rows.reverse().map(mapRowToAgentMetrics);
}

export function insertLog(db: Database.Database, log: Omit<LogEntry, "id">): LogEntry {
  const result = db.prepare(`
    INSERT INTO logs (agent_id, level, message, timestamp, raw)
    VALUES (?, ?, ?, ?, ?)
  `).run(log.agentId, log.level, log.message, log.timestamp.getTime(), log.raw ? 1 : 0);
  return { ...log, id: Number(result.lastInsertRowid) };
}

export function getRecentLogs(
  db: Database.Database,
  agentId: string | null = null,
  limit: number = 500
): LogEntry[] {
  let query = "SELECT * FROM logs";
  const params: (string | number)[] = [];

  if (agentId) {
    query += " WHERE agent_id = ?";
    params.push(agentId);
  }

  query += " ORDER BY timestamp DESC LIMIT ?";
  params.push(limit);

  const rows = db.prepare(query).all(...params);
  return rows.reverse().map(mapRowToLog);
}

export function insertCost(db: Database.Database, cost: Omit<CostEntry, "id">): CostEntry {
  const result = db.prepare(`
    INSERT INTO costs (agent_id, provider, model, tokens_in, tokens_out, cost_usd, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(cost.agentId, cost.provider, cost.model, cost.tokensIn, cost.tokensOut, cost.costUsd, cost.timestamp.getTime());
  return { ...cost, id: Number(result.lastInsertRowid) };
}

export function getCosts(
  db: Database.Database,
  agentId: string | null = null,
  provider: string | null = null,
  since: Date | null = null,
  limit: number = 1000
): CostEntry[] {
  let query = "SELECT * FROM costs WHERE 1=1";
  const params: (string | number)[] = [];

  if (agentId) {
    query += " AND agent_id = ?";
    params.push(agentId);
  }
  if (provider) {
    query += " AND provider = ?";
    params.push(provider);
  }
  if (since) {
    query += " AND timestamp >= ?";
    params.push(since.getTime());
  }

  query += " ORDER BY timestamp DESC LIMIT ?";
  params.push(limit);

  const rows = db.prepare(query).all(...params);
  return rows.reverse().map(mapRowToCost);
}

export function getCostSummaries(
  db: Database.Database,
  since: Date | null = null
): CostSummary[] {
  let query = `
    SELECT
      provider,
      model,
      SUM(tokens_in) as total_tokens_in,
      SUM(tokens_out) as total_tokens_out,
      SUM(cost_usd) as total_cost_usd,
      COUNT(*) as call_count
    FROM costs
  `;
  const params: number[] = [];

  if (since) {
    query += " WHERE timestamp >= ?";
    params.push(since.getTime());
  }

  query += " GROUP BY provider, model ORDER BY total_cost_usd DESC";

  const rows = db.prepare(query).all(...params);
  return rows.map((row) => ({
    provider: row.provider,
    model: row.model,
    totalTokensIn: row.total_tokens_in,
    totalTokensOut: row.total_tokens_out,
    totalCostUsd: row.total_cost_usd,
    callCount: row.call_count,
  }));
}

export function getPricing(db: Database.Database): Map<string, Map<string, { in: number; out: number }>> {
  const rows = db.prepare("SELECT * FROM pricing").all();
  const pricing = new Map<string, Map<string, { in: number; out: number }>>();
  for (const row of rows) {
    if (!pricing.has(row.provider)) {
      pricing.set(row.provider, new Map());
    }
    pricing.get(row.provider)!.set(row.model, {
      in: row.input_price_per_1k,
      out: row.output_price_per_1k,
    });
  }
  return pricing;
}

export function setPricing(
  db: Database.Database,
  provider: string,
  model: string,
  inputPrice: number,
  outputPrice: number
): void {
  db.prepare(`
    INSERT INTO pricing (provider, model, input_price_per_1k, output_price_per_1k)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      model = excluded.model,
      input_price_per_1k = excluded.input_price_per_1k,
      output_price_per_1k = excluded.output_price_per_1k
  `).run(provider, model, inputPrice, outputPrice);
}

function mapRowToAgent(row: any): AgentInfo {
  return {
    id: row.id,
    type: row.type,
    config: {
      id: row.id,
      type: row.type,
      command: row.command,
      args: JSON.parse(row.args || "[]"),
      env: JSON.parse(row.env || "{}"),
      cwd: row.cwd || undefined,
    },
    pid: row.pid,
    status: row.status,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    stoppedAt: row.stopped_at ? new Date(row.stopped_at) : null,
    exitCode: row.exit_code,
    uptime: row.uptime || 0,
    cpuPercent: row.cpu_percent || 0,
    memoryMb: row.memory_mb || 0,
    lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : null,
    message: row.message || "",
  };
}

function mapRowToSystemMetrics(row: any): SystemMetrics {
  return {
    cpu: {
      overall: row.cpu_overall,
      cores: JSON.parse(row.cpu_cores),
    },
    memory: {
      total: row.memory_total,
      used: row.memory_used,
      free: row.memory_free,
      percent: row.memory_percent,
    },
    disk: {
      total: row.disk_total,
      used: row.disk_used,
      free: row.disk_free,
      percent: row.disk_percent,
    },
    network: {
      rxBytes: row.network_rx_bytes,
      txBytes: row.network_tx_bytes,
      rxSec: row.network_rx_sec,
      txSec: row.network_tx_sec,
    },
    timestamp: new Date(row.timestamp),
  };
}

function mapRowToAgentMetrics(row: any): AgentMetrics {
  return {
    agentId: row.agent_id,
    cpuPercent: row.cpu_percent,
    memoryMb: row.memory_mb,
    timestamp: new Date(row.timestamp),
  };
}

function mapRowToLog(row: any): LogEntry {
  return {
    id: row.id,
    agentId: row.agent_id,
    level: row.level,
    message: row.message,
    timestamp: new Date(row.timestamp),
    raw: Boolean(row.raw),
  };
}

function mapRowToCost(row: any): CostEntry {
  return {
    id: row.id,
    agentId: row.agent_id,
    provider: row.provider,
    model: row.model,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costUsd: row.cost_usd,
    timestamp: new Date(row.timestamp),
  };
}