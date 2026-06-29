import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  LocalMetrics,
  SystemMetrics,
  AgentMetrics,
  CostEntry,
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, "..", "..", "data", "dashboard.db");

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma("journal_mode = WAL");
    initDb(dbInstance);
  }
  return dbInstance;
}

function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS local_metrics (
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
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_local_metrics_time ON local_metrics(timestamp);

    CREATE TABLE IF NOT EXISTS remote_metrics (
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

    CREATE INDEX IF NOT EXISTS idx_remote_metrics_time ON remote_metrics(timestamp);

    CREATE TABLE IF NOT EXISTS agent_metrics_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      cpu_percent REAL NOT NULL,
      memory_mb REAL NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_time ON agent_metrics_history(agent_id, timestamp);

    CREATE TABLE IF NOT EXISTS cost_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT,
      provider TEXT,
      model TEXT,
      tokens_in INTEGER NOT NULL,
      tokens_out INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cost_snapshots_time ON cost_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_cost_snapshots_agent ON cost_snapshots(agent_id);
    CREATE INDEX IF NOT EXISTS idx_cost_snapshots_provider ON cost_snapshots(provider);
  `);
}

export function insertLocalMetrics(db: Database.Database, metrics: LocalMetrics): void {
  db.prepare(`
    INSERT INTO local_metrics (
      cpu_overall, cpu_cores, memory_total, memory_used, memory_free, memory_percent,
      disk_total, disk_used, disk_free, disk_percent, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    metrics.timestamp.getTime()
  );
}

export function getLocalMetricsHistory(
  db: Database.Database,
  limit: number = 288
): LocalMetrics[] {
  const rows = db.prepare(`
    SELECT * FROM local_metrics ORDER BY timestamp DESC LIMIT ?
  `).all(limit);
  return rows.reverse().map(mapRowToLocalMetrics);
}

export function insertRemoteMetrics(db: Database.Database, metrics: SystemMetrics): void {
  db.prepare(`
    INSERT INTO remote_metrics (
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

export function getRemoteMetricsHistory(
  db: Database.Database,
  limit: number = 288
): SystemMetrics[] {
  const rows = db.prepare(`
    SELECT * FROM remote_metrics ORDER BY timestamp DESC LIMIT ?
  `).all(limit);
  return rows.reverse().map(mapRowToSystemMetrics);
}

export function insertAgentMetrics(db: Database.Database, metrics: AgentMetrics): void {
  db.prepare(`
    INSERT INTO agent_metrics_history (agent_id, cpu_percent, memory_mb, timestamp)
    VALUES (?, ?, ?, ?)
  `).run(metrics.agentId, metrics.cpuPercent, metrics.memoryMb, metrics.timestamp.getTime());
}

export function getAgentMetricsHistory(
  db: Database.Database,
  agentId: string,
  limit: number = 288
): AgentMetrics[] {
  const rows = db.prepare(`
    SELECT * FROM agent_metrics_history WHERE agent_id = ? ORDER BY timestamp DESC LIMIT ?
  `).all(agentId, limit);
  return rows.reverse().map(mapRowToAgentMetrics);
}

export function insertCostSnapshot(db: Database.Database, cost: CostEntry): void {
  db.prepare(`
    INSERT INTO cost_snapshots (agent_id, provider, model, tokens_in, tokens_out, cost_usd, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(cost.agentId, cost.provider, cost.model, cost.tokensIn, cost.tokensOut, cost.costUsd, cost.timestamp.getTime());
}

export function getCostSnapshots(
  db: Database.Database,
  agentId: string | null = null,
  provider: string | null = null,
  since: Date | null = null,
  limit: number = 1000
): CostEntry[] {
  let query = "SELECT * FROM cost_snapshots WHERE 1=1";
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
  return rows.reverse().map(mapRowToCostEntry);
}

export function getCostSummaries(
  db: Database.Database,
  since: Date | null = null
): Array<{
  provider: string;
  model: string;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  callCount: number;
}> {
  let query = `
    SELECT
      provider,
      model,
      SUM(tokens_in) as total_tokens_in,
      SUM(tokens_out) as total_tokens_out,
      SUM(cost_usd) as total_cost_usd,
      COUNT(*) as call_count
    FROM cost_snapshots
  `;
  const params: number[] = [];

  if (since) {
    query += " WHERE timestamp >= ?";
    params.push(since.getTime());
  }

  query += " GROUP BY provider, model ORDER BY total_cost_usd DESC";

  return db.prepare(query).all(...params) as any[];
}

export function getTotalCost(db: Database.Database, since: Date | null = null): number {
  let query = "SELECT SUM(cost_usd) as total FROM cost_snapshots WHERE 1=1";
  const params: number[] = [];

  if (since) {
    query += " AND timestamp >= ?";
    params.push(since.getTime());
  }

  const row = db.prepare(query).get(...params) as { total: number | null };
  return row.total || 0;
}

export function getCostsByPeriod(db: Database.Database, days: number = 30): Array<{ date: string; cost: number }> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return db.prepare(`
    SELECT
      date(timestamp / 1000, 'unixepoch') as date,
      SUM(cost_usd) as cost
    FROM cost_snapshots
    WHERE timestamp >= ?
    GROUP BY date
    ORDER BY date
  `).all(startDate.getTime()) as { date: string; cost: number }[];
}

export function cleanupOldData(db: Database.Database, daysToKeep: number = 30): void {
  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
  db.prepare("DELETE FROM local_metrics WHERE timestamp < ?").run(cutoff);
  db.prepare("DELETE FROM remote_metrics WHERE timestamp < ?").run(cutoff);
  db.prepare("DELETE FROM agent_metrics_history WHERE timestamp < ?").run(cutoff);
  db.prepare("DELETE FROM cost_snapshots WHERE timestamp < ?").run(cutoff);
}

function mapRowToLocalMetrics(row: any): LocalMetrics {
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
    timestamp: new Date(row.timestamp),
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

function mapRowToCostEntry(row: any): CostEntry {
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