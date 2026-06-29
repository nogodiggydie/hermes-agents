"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Download, Monitor } from "lucide-react";
import { NavSidebar } from "@/components/NavSidebar";
import { SystemMetricsCharts } from "@/components/MetricsChart";
import { collectLocalMetrics, fetchRemoteMetrics } from "@/lib/remote-client";
import { getDb, getLocalMetricsHistory, getRemoteMetricsHistory, getAgentMetricsHistory } from "@/lib/db";
import { SystemMetrics, LocalMetrics, AgentMetrics, ConnectionStatus } from "@/lib/types";

export default function MetricsPage() {
  const [localMetrics, setLocalMetrics] = useState<LocalMetrics | null>(null);
  const [localHistory, setLocalHistory] = useState<LocalMetrics[]>([]);
  const [remoteMetrics, setRemoteMetrics] = useState<SystemMetrics | null>(null);
  const [remoteHistory, setRemoteHistory] = useState<SystemMetrics[]>([]);
  const [agentMetrics, setAgentMetrics] = useState<Record<string, AgentMetrics[]>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "7d">("1h");

  const timeRangeMs = {
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };

  const limitMap = {
    "1h": 72,
    "6h": 216,
    "24h": 288,
    "7d": 288,
  };

  const refresh = async () => {
    try {
      setConnectionStatus("connecting");
      
      const [local, remote] = await Promise.all([
        collectLocalMetrics(),
        fetchRemoteMetrics(),
      ]);

      setLocalMetrics(local);
      setRemoteMetrics(remote.data?.system || null);

      const db = getDb();
      const limit = limitMap[timeRange];
      
      const localHist = getLocalMetricsHistory(db, limit);
      const remoteHist = getRemoteMetricsHistory(db, limit);
      
      setLocalHistory(localHist);
      setRemoteHistory(remoteHist);

      if (remote.data?.agents) {
        const agentHist: Record<string, AgentMetrics[]> = {};
        for (const agent of remote.data.agents) {
          if (agent.status === "running") {
            agentHist[agent.id] = getAgentMetricsHistory(db, agent.id, limit);
          }
        }
        setAgentMetrics(agentHist);
      }

      setConnectionStatus("connected");
    } catch (error) {
      console.error("Failed to refresh metrics:", error);
      setConnectionStatus("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  return (
    <div className="flex h-screen bg-background">
      <NavSidebar connectionStatus={connectionStatus} />

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">System Metrics</h1>
              <p className="text-muted-foreground">Real-time and historical system performance</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-muted-foreground" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as "1h" | "6h" | "24h" | "7d")}
                  className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="1h">Last Hour</option>
                  <option value="6h">Last 6 Hours</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                </select>
              </div>
              <button
                onClick={refresh}
                disabled={loading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>

          {/* Current Metrics Summary */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-card border rounded-xl p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Local CPU</h3>
              <p className="text-3xl font-bold">{localMetrics?.cpu.overall.toFixed(1) ?? "—"}%</p>
              <p className="text-sm text-muted-foreground">{localMetrics?.cpu.cores.length ?? 0} cores</p>
            </div>
            <div className="bg-card border rounded-xl p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Local Memory</h3>
              <p className="text-3xl font-bold">{localMetrics?.memory.percent.toFixed(1) ?? "—"}%</p>
              <p className="text-sm text-muted-foreground">
                {(localMetrics?.memory.used ?? 0) / 1024 / 1024 / 1024 ?? 0} GB used
              </p>
            </div>
            <div className="bg-card border rounded-xl p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Remote CPU</h3>
              <p className="text-3xl font-bold">{remoteMetrics?.cpu.overall.toFixed(1) ?? "—"}%</p>
              <p className="text-sm text-muted-foreground">{remoteMetrics?.cpu.cores.length ?? 0} cores</p>
            </div>
            <div className="bg-card border rounded-xl p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Remote Memory</h3>
              <p className="text-3xl font-bold">{remoteMetrics?.memory.percent.toFixed(1) ?? "—"}%</p>
              <p className="text-sm text-muted-foreground">
                {(remoteMetrics?.memory.used ?? 0) / 1024 / 1024 / 1024 ?? 0} GB used
              </p>
            </div>
          </div>

          <SystemMetricsCharts
            localMetrics={localHistory}
            remoteMetrics={remoteHistory}
            agentMetrics={agentMetrics}
          />
        </div>
      </main>
    </div>
  );
}