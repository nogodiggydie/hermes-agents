import {
  Agent,
  HealthResponse,
  SystemMetrics,
  AgentMetrics,
  LogEntry,
  CostEntry,
  CostSummary,
  ApiResponse,
} from "./types";

const REMOTE_BASE_URL = process.env.NEXT_PUBLIC_REMOTE_URL || "http://localhost:3001";
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${REMOTE_BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date(),
    };
  }
}

export async function getRemoteHealth(): Promise<ApiResponse<HealthResponse>> {
  return fetchApi<HealthResponse>("/health");
}

export async function getRemoteAgents(): Promise<ApiResponse<Agent[]>> {
  return fetchApi<Agent[]>("/api/agents");
}

export async function getRemoteAgent(id: string): Promise<ApiResponse<Agent>> {
  return fetchApi<Agent>(`/api/agents/${id}`);
}

export async function startRemoteAgent(config: any): Promise<ApiResponse<Agent>> {
  return fetchApi<Agent>("/api/agents", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function stopRemoteAgent(id: string): Promise<ApiResponse<Agent>> {
  return fetchApi<Agent>(`/api/agents/${id}/stop`, {
    method: "POST",
  });
}

export async function restartRemoteAgent(id: string): Promise<ApiResponse<Agent>> {
  return fetchApi<Agent>(`/api/agents/${id}/restart`, {
    method: "POST",
  });
}

export async function deleteRemoteAgent(id: string): Promise<ApiResponse<void>> {
  return fetchApi<void>(`/api/agents/${id}`, {
    method: "DELETE",
  });
}

export async function getRemoteMetrics(): Promise<ApiResponse<{ system: SystemMetrics; agents: AgentMetrics[] }>> {
  return fetchApi("/api/metrics");
}

export async function getRemoteMetricsHistory(
  limit: number = 288,
  agentId?: string
): Promise<ApiResponse<{ system: SystemMetrics[]; agents: AgentMetrics[] }>> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (agentId) params.append("agentId", agentId);
  return fetchApi(`/api/metrics/history?${params.toString()}`);
}

export async function getRemoteLogs(
  agentId?: string,
  limit: number = 100
): Promise<ApiResponse<LogEntry[]>> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (agentId) params.append("agentId", agentId);
  return fetchApi(`/api/logs?${params.toString()}`);
}

export async function getRemoteCosts(params?: {
  agentId?: string;
  provider?: string;
  since?: string;
  limit?: number;
}): Promise<ApiResponse<{ costs: CostEntry[]; summaries: CostSummary[] }>> {
  const searchParams = new URLSearchParams();
  if (params?.agentId) searchParams.append("agentId", params.agentId);
  if (params?.provider) searchParams.append("provider", params.provider);
  if (params?.since) searchParams.append("since", params.since);
  if (params?.limit) searchParams.append("limit", params.limit.toString());
  return fetchApi(`/api/costs?${searchParams.toString()}`);
}

export async function getRemoteCostSummary(days: number = 30): Promise<ApiResponse<{
  summaries: CostSummary[];
  totalCost: number;
  dailyCosts: Array<{ date: string; cost: number }>;
}>> {
  return fetchApi(`/api/costs/summary?days=${days}`);
}

export function createLogWebSocket(
  agentId?: string,
  levels?: string[]
): WebSocket {
  const params = new URLSearchParams();
  if (agentId) params.append("agentId", agentId);
  if (levels?.length) params.append("levels", levels.join(","));
  
  const wsUrl = `${WS_BASE_URL}/ws/logs?${params.toString()}`;
  return new WebSocket(wsUrl);
}

export function createMetricsWebSocket(): WebSocket {
  const wsUrl = `${WS_BASE_URL}/ws/metrics`;
  return new WebSocket(wsUrl);
}

// Aliases for easier imports in pages
export const fetchRemoteHealth = getRemoteHealth;
export const fetchRemoteAgents = getRemoteAgents;
export const fetchRemoteAgent = getRemoteAgent;
export const startRemoteAgent = startRemoteAgent;
export const stopRemoteAgent = stopRemoteAgent;
export const restartRemoteAgent = restartRemoteAgent;
export const deleteRemoteAgent = deleteRemoteAgent;
export const fetchRemoteMetrics = getRemoteMetrics;
export const fetchRemoteMetricsHistory = getRemoteMetricsHistory;
export const fetchRemoteLogs = getRemoteLogs;
export const fetchRemoteCosts = getRemoteCosts;
export const fetchRemoteCostSummary = getRemoteCostSummary;