"use client";

import { Circle, Cpu, HardDrive, MemoryStick, Wifi, WifiOff, AlertCircle, CheckCircle } from "lucide-react";
import { SystemMetrics, LocalMetrics, Agent } from "@/lib/types";

interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  status?: "healthy" | "warning" | "error" | "unknown";
  trend?: { value: number; label: string };
}

export function StatusCard({ title, value, subtitle, icon, status = "unknown", trend }: StatusCardProps) {
  const statusColors = {
    healthy: "text-success bg-success/10 border-success/20",
    warning: "text-warning bg-warning/10 border-warning/20",
    error: "text-destructive bg-destructive/10 border-destructive/20",
    unknown: "text-muted-foreground bg-muted/10 border-border",
  };

  const statusIcons = {
    healthy: CheckCircle,
    warning: AlertCircle,
    error: AlertCircle,
    unknown: Circle,
  };

  const StatusIcon = statusIcons[status];
  const statusClass = statusColors[status];

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-sm">
              <span className={trend.value >= 0 ? "text-success" : "text-destructive"}>
                {trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${statusClass}`}>
          {icon || <StatusIcon className="w-5 h-5" />}
        </div>
      </div>
    </div>
  );
}

interface SystemStatusCardProps {
  metrics: LocalMetrics | SystemMetrics | null;
  label: string;
}

export function SystemStatusCard({ metrics, label }: SystemStatusCardProps) {
  if (!metrics) {
    return (
      <StatusCard
        title={label}
        value="—"
        subtitle="No data"
        icon={<Cpu className="w-5 h-5" />}
        status="unknown"
      />
    );
  }

  const cpuColor = metrics.cpu.overall >= 90 ? "error" : metrics.cpu.overall >= 75 ? "warning" : "healthy";
  const memColor = metrics.memory.percent >= 90 ? "error" : metrics.memory.percent >= 75 ? "warning" : "healthy";

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">CPU</p>
          <p className={`text-2xl font-bold ${cpuColor === "error" ? "text-destructive" : cpuColor === "warning" ? "text-warning" : "text-success"}`}>
            {metrics.cpu.overall.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Memory</p>
          <p className={`text-2xl font-bold ${memColor === "error" ? "text-destructive" : memColor === "warning" ? "text-warning" : "text-success"}`}>
            {metrics.memory.percent.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Disk</p>
          <p className="text-2xl font-bold text-foreground">
            {metrics.disk.percent.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Network</p>
          <p className="text-sm font-medium text-foreground">
            ↓ {formatBytes(metrics.network.rxSec)}/s
          </p>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface AgentStatusCardProps {
  agent: Agent;
}

export function AgentStatusCard({ agent }: AgentStatusCardProps) {
  const statusColors = {
    initializing: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    running: "text-success bg-success/10 border-success/20",
    completed: "text-muted-foreground bg-muted/10 border-border",
    error: "text-destructive bg-destructive/10 border-destructive/20",
    paused: "text-warning bg-warning/10 border-warning/20",
  };

  const statusIcons = {
    initializing: Cpu,
    running: CheckCircle,
    completed: CheckCircle,
    error: AlertCircle,
    paused: Circle,
  };

  const StatusIcon = statusIcons[agent.status];
  const statusClass = statusColors[agent.status];
  const typeIcon = agent.type === "python" ? "🐍" : "📦";

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{typeIcon}</span>
          <div>
            <p className="font-medium text-foreground">{agent.id}</p>
            <p className="text-sm text-muted-foreground">{agent.type} • PID: {agent.pid || "—"}</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusClass}`}>
            <StatusIcon className="w-3 h-3" />
            {agent.status}
          </span>
          <p className="text-xs text-muted-foreground mt-1">Uptime: {formatUptime(agent.uptime)}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">CPU</p>
          <p className="text-lg font-bold text-foreground">{agent.cpuPercent.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Memory</p>
          <p className="text-lg font-bold text-foreground">{agent.memoryMb.toFixed(1)} MB</p>
        </div>
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