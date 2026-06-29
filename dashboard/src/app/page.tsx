"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Server,
  Activity,
  FileText,
  DollarSign,
  Cpu,
  HardDrive,
  MemoryStick,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { NavSidebar } from "@/components/NavSidebar";
import { StatusCard, SystemStatusCard, AgentStatusCard } from "@/components/StatusCard";
import { SystemMetricsCharts } from "@/components/MetricsChart";
import { AgentList } from "@/components/AgentList";
import { collectLocalMetrics } from "@/lib/local-metrics";
import {
  fetchRemoteHealth,
  fetchRemoteAgents,
  fetchRemoteMetrics,
} from "@/lib/remote-client";
import { getDb, getLocalMetricsHistory, getRemoteMetricsHistory, getAgentMetricsHistory } from "@/lib/db";
import {
  Agent,
  HealthResponse,
  SystemMetrics,
  LocalMetrics,
  AgentMetrics,
  ConnectionStatus,
} from "@/lib/types";

interface DashboardData {
  localMetrics: LocalMetrics | null;
  remoteHealth: HealthResponse | null;
  agents: Agent[];
  localMetricsHistory: LocalMetrics[];
  remoteMetricsHistory: SystemMetrics[];
  agentMetricsHistory: Record<string, AgentMetrics[]>;
  connectionStatus: ConnectionStatus;
  lastUpdated: Date | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    localMetrics: null,
    remoteHealth: null,
    agents: [],
    localMetricsHistory: [],
    remoteMetricsHistory: [],
    agentMetricsHistory: {},
    connectionStatus: "disconnected",
    lastUpdated: null,
  });
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = async () => {
    try {
      setData((prev) => ({ ...prev, connectionStatus: "connecting" }));

      const [localMetrics, remoteHealth, remoteAgents, remoteMetrics] = await Promise.all([
        collectLocalMetrics(),
        fetchRemoteHealth(),
        fetchRemoteAgents(),
        fetchRemoteMetrics(),
      ]);

      const db = getDb();
      const localHistory = getLocalMetricsHistory(db, 288);
      const remoteHistory = getRemoteMetricsHistory(db, 288);

      const agentMetricsHistory: Record<string, AgentMetrics[]> = {};
      for (const agent of remoteAgents.data || []) {
        if (agent.status === "running") {
          agentMetricsHistory[agent.id] = getAgentMetricsHistory(db, agent.id, 288);
        }
      }

      setData({
        localMetrics,
        remoteHealth: remoteHealth.data || null,
        agents: remoteAgents.data || [],
        localMetricsHistory: localHistory,
        remoteMetricsHistory: remoteHistory,
        agentMetricsHistory,
        connectionStatus: remoteHealth.success ? "connected" : "error",
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error("Failed to refresh dashboard:", error);
      setData((prev) => ({ ...prev, connectionStatus: "error" }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    if (!autoRefresh) return;

    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const runningAgents = data.agents.filter((a) => a.status === "running").length;
  const errorAgents = data.agents.filter((a) => a.status === "error").length;
  const totalUptime = data.agents.reduce((sum, a) => sum + a.uptime, 0);

  return (
    <div className="flex h-screen bg-background">
      <NavSidebar connectionStatus={data.connectionStatus} />

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Hermes Dashboard</h1>
              <p className="text-muted-foreground">
                Monitoring AI agents on AWS EC2
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-border"
                />
                Auto-refresh (10s)
              </label>
              <button
                onClick={refresh}
                disabled={loading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Connection Status & Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatusCard
              title="Connection"
              value={
                data.connectionStatus === "connected" ? (
                  <>
                    <Wifi className="w-5 h-5 text-success mr-2 inline" />
                    Connected
                  </>
                ) : data.connectionStatus === "connecting" ? (
                  <>
                    <span className="animate-spin">◐</span> Connecting...
                  </>
                ) : data.connectionStatus === "error" ? (
                  <>
                    <WifiOff className="w-5 h-5 text-destructive mr-2 inline" />
                    Error
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-muted-foreground mr-2 inline" />
                    Disconnected
                  </>
                )
              }
              subtitle={data.lastUpdated ? `Last update: ${data.lastUpdated.toLocaleTimeString()}` : "No data yet"}
              icon={<Server className="w-5 h-5" />}
              status={
                data.connectionStatus === "connected"
                  ? "healthy"
                  : data.connectionStatus === "error"
                  ? "error"
                  : "warning"
              }
            />

            <StatusCard
              title="Agents"
              value={data.agents.length}
              subtitle={runningAgents > 0 ? `${runningAgents} running, ${errorAgents} errors` : "No agents"}
              icon={<Server className="w-5 h-5" />}
              status={runningAgents > 0 ? "healthy" : errorAgents > 0 ? "error" : "warning"}
              trend={data.agents.length > 0 ? { value: 0, label: "total" } : undefined}
            />

            <StatusCard
              title="Local CPU"
              value={data.localMetrics ? `${data.localMetrics.cpu.overall.toFixed(1)}%` : "—"}
              subtitle={data.localMetrics ? `${data.localMetrics.cpu.cores.length} cores` : "No data"}
              icon={<Cpu className="w-5 h-5" />}
              status={
                data.localMetrics && data.localMetrics.cpu.overall >= 90
                  ? "error"
                  : data.localMetrics && data.localMetrics.cpu.overall >= 75
                  ? "warning"
                  : "healthy"
              }
            />

            <StatusCard
              title="Local Memory"
              value={data.localMetrics ? `${data.localMetrics.memory.percent.toFixed(1)}%` : "—"}
              subtitle={data.localMetrics
                ? `${(data.localMetrics.memory.used / 1024 / 1024 / 1024).toFixed(1)} / ${(data.localMetrics.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB`
                : "No data"}
              icon={<MemoryStick className="w-5 h-5" />}
              status={
                data.localMetrics && data.localMetrics.memory.percent >= 90
                  ? "error"
                  : data.localMetrics && data.localMetrics.memory.percent >= 75
                  ? "warning"
                  : "healthy"
              }
            />
          </div>

          {/* Remote System Status */}
          {data.remoteHealth && (
            <div className="grid gap-4 md:grid-cols-3">
              <SystemStatusCard metrics={data.remoteHealth.systemMetrics} label="Remote System" />
              <StatusCard
                title="Remote Uptime"
                value={formatUptime(data.remoteHealth.uptime)}
                subtitle={`Service running for ${data.remoteHealth.uptime.toFixed(0)}s`}
                icon={<Activity className="w-5 h-5" />}
                status="healthy"
              />
              <StatusCard
                title="Agent Health"
                value={`${data.remoteHealth.runningAgents} / ${data.remoteHealth.agentCount}`}
                subtitle={
                  data.remoteHealth.status === "healthy"
                    ? "All systems operational"
                    : data.remoteHealth.status === "degraded"
                    ? "Some agents not running"
                    : "Service unhealthy"
                }
                icon={<CheckCircle className="w-5 h-5" />}
                status={
                  data.remoteHealth.status === "healthy"
                    ? "healthy"
                    : data.remoteHealth.status === "degraded"
                    ? "warning"
                    : "error"
                }
              />
            </div>
          )}

          {/* System Metrics Charts */}
          <SystemMetricsCharts
            localMetrics={data.localMetricsHistory}
            remoteMetrics={data.remoteMetricsHistory}
            agentMetrics={data.agentMetricsHistory}
          />

          {/* Agents Overview */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <AgentList agents={data.agents} loading={loading} />
          </div>
        </div>
      </main>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}