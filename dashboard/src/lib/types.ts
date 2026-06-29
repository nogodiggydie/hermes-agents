export type AgentType = "python" | "node";

export type AgentStatus = "initializing" | "running" | "completed" | "error" | "paused";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AgentConfig {
  id: string;
  type: AgentType;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface Agent {
  id: string;
  type: AgentType;
  config: AgentConfig;
  pid: number | null;
  status: AgentStatus;
  startedAt: Date | null;
  stoppedAt: Date | null;
  exitCode: number | null;
  uptime: number;
  cpuPercent: number;
  memoryMb: number;
  lastHeartbeat: Date | null;
  message: string;
}

export interface SystemMetrics {
  cpu: {
    overall: number;
    cores: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  network: {
    rxBytes: number;
    txBytes: number;
    rxSec: number;
    txSec: number;
  };
  timestamp: Date;
}

export interface AgentMetrics {
  agentId: string;
  cpuPercent: number;
  memoryMb: number;
  timestamp: Date;
}

export interface LogEntry {
  id: number;
  agentId: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  raw?: boolean;
}

export interface CostEntry {
  id: number;
  agentId: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  timestamp: Date;
}

export interface CostSummary {
  provider: string;
  model: string;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  callCount: number;
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  agentCount: number;
  runningAgents: number;
  systemMetrics: SystemMetrics;
  timestamp: Date;
}

export interface LocalMetrics {
  cpu: {
    overall: number;
    cores: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  timestamp: Date;
}

export interface DashboardData {
  localMetrics: LocalMetrics | null;
  remoteHealth: HealthResponse | null;
  agents: Agent[];
  systemMetricsHistory: SystemMetrics[];
  agentMetricsHistory: Record<string, AgentMetrics[]>;
  recentLogs: LogEntry[];
  costSummaries: CostSummary[];
  totalCost: number;
  dailyCosts: Array<{ date: string; cost: number }>;
  connectionStatus: "connected" | "connecting" | "disconnected" | "error";
}

export type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface WebSocketMessage {
  type: "log" | "metrics" | "status" | "cost";
  data: any;
}

export interface SubscriptionParams {
  agentId?: string;
  levels?: LogLevel[];
}