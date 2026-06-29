"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Play, Square, RotateCcw, Trash2, Cpu, HardDrive, Activity } from "lucide-react";
import { Agent, AgentStatus, AgentType } from "@/lib/types";

interface AgentListProps {
  agents: Agent[];
  onStart?: (config: any) => void;
  onStop?: (id: string) => void;
  onRestart?: (id: string) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}

export function AgentList({ agents, onStart, onStop, onRestart, onDelete, loading }: AgentListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatusBadge = (status: AgentStatus) => {
    const styles: Record<AgentStatus, string> = {
      initializing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      running: "bg-success/10 text-success border-success/20",
      completed: "bg-muted/10 text-muted-foreground border-border",
      error: "bg-destructive/10 text-destructive border-destructive/20",
      paused: "bg-warning/10 text-warning border-warning/20",
    };
    return styles[status] || styles.initializing;
  };

  const getTypeBadge = (type: AgentType) => {
    return type === "python"
      ? "bg-green-500/10 text-green-500 border-green-500/20"
      : "bg-blue-500/10 text-blue-500 border-blue-500/20";
  };

  if (loading) {
    return (
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg font-semibold">Agents</h3>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-8 text-center">
        <Cpu className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No agents registered</p>
        {onStart && (
          <button
            onClick={() => onStart({ id: `agent-${Date.now()}`, type: "node", command: "node", args: ["agents/node/template.js"] })}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <RotateCcw className="w-4 h-4" />
            Create Agent
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold">Agents ({agents.length})</h3>
        {onStart && (
          <button
            onClick={() => onStart({ id: `agent-${Date.now()}`, type: "node", command: "node", args: ["agents/node/template.js"] })}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <RotateCcw className="w-4 h-4" />
            New Agent
          </button>
        )}
      </div>
      <div className="divide-y divide-border">
        {agents.map((agent) => {
          const isExpanded = expandedIds.has(agent.id);
          const statusBadge = getStatusBadge(agent.status);
          const typeBadge = getTypeBadge(agent.type);

          return (
            <div key={agent.id} className="group">
              <button
                onClick={() => toggleExpand(agent.id)}
                className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{agent.type === "python" ? "🐍" : "📦"}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{agent.id}</p>
                    <p className="text-sm text-muted-foreground">
                      PID: {agent.pid || "—"} • {formatUptime(agent.uptime)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${typeBadge}`}>
                    {agent.type}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${statusBadge}`}>
                    {agent.status}
                  </span>
                  <span className="text-sm text-muted-foreground w-20 text-right">
                    CPU: {agent.cpuPercent.toFixed(1)}%
                  </span>
                  <span className="text-sm text-muted-foreground w-24 text-right">
                    RAM: {agent.memoryMb.toFixed(1)}MB
                  </span>
                  <Activity className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="bg-muted/30 px-4 pb-4 border-t border-border">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="bg-background p-3 rounded-lg border">
                      <p className="text-xs text-muted-foreground">Command</p>
                      <p className="text-sm font-mono text-foreground break-all">{agent.config.command} {agent.config.args.join(" ")}</p>
                    </div>
                    <div className="bg-background p-3 rounded-lg border">
                      <p className="text-xs text-muted-foreground">Working Directory</p>
                      <p className="text-sm font-mono text-foreground break-all">{agent.config.cwd || "default"}</p>
                    </div>
                    <div className="bg-background p-3 rounded-lg border">
                      <p className="text-xs text-muted-foreground">Environment</p>
                      <p className="text-sm text-foreground">
                        {Object.keys(agent.config.env || {}).length > 0
                          ? Object.entries(agent.config.env || {}).map(([k, v]) => `${k}=${v}`).join(", ")
                          : "None"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                    {agent.status === "running" && onStop && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onStop(agent.id); }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90"
                      >
                        <Square className="w-4 h-4" />
                        Stop
                      </button>
                    )}
                    {onRestart && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRestart(agent.id); }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restart
                      </button>
                    )}
                    {(agent.status !== "running") && onDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(agent.id); }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                    <div className="flex-1" />
                    <span className="text-xs text-muted-foreground">
                      Started: {agent.startedAt ? new Date(agent.startedAt).toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}