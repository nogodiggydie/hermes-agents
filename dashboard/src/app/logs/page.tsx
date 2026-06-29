"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { NavSidebar } from "@/components/NavSidebar";
import { LogStream } from "@/components/LogStream";
import { fetchRemoteLogs, createLogWebSocket } from "@/lib/remote-client";
import { LogEntry, LogLevel, ConnectionStatus } from "@/lib/types";

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [agentFilter, setAgentFilter] = useState<string | "all">("all");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = async (reset = true) => {
    try {
      const result = await fetchRemoteLogs(agentFilter === "all" ? undefined : agentFilter, reset ? 500 : 100);
      if (result.success && result.data) {
        if (reset) {
          setLogs(result.data);
        } else {
          setLogs((prev) => [...result.data!, ...prev]);
        }
        setHasMore(result.data.length >= 100);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      setConnectionStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `ws://localhost:3001/ws/logs${agentFilter !== "all" ? `?agentId=${agentFilter}` : ""}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setWs(ws);

    ws.onopen = () => setConnectionStatus("connected");
    ws.onclose = () => {
      setConnectionStatus("disconnected");
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
    };
    ws.onerror = () => setConnectionStatus("error");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "log" && msg.data) {
          setLogs((prev) => [msg.data, ...prev].slice(0, 1000));
        }
      } catch {
        // Ignore parse errors
      }
    };
  }, [agentFilter]);

  useEffect(() => {
    fetchLogs(true);
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [agentFilter, connectWebSocket]);

  const handleLoadMore = () => fetchLogs(false);

  const agents = Array.from(new Set(logs.map((l) => l.agentId))).sort();

  return (
    <div className="flex h-screen bg-background">
      <NavSidebar connectionStatus={connectionStatus} />

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto h-[calc(100vh-3rem)] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Logs</h1>
              <p className="text-muted-foreground">Real-time log streaming from agent workers</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Agents</option>
                {agents.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <LogStream
            logs={logs}
            autoScroll={true}
            maxLines={500}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            loading={loading}
          />
        </div>
      </main>
    </div>
  );
}