"use client";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { SystemMetrics, AgentMetrics, LocalMetrics } from "@/lib/types";

interface MetricDataPoint {
  time: string;
  [key: string]: number | string;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function systemMetricsToData(metrics: SystemMetrics[]): MetricDataPoint[] {
  return metrics.map((m) => ({
    time: formatTime(m.timestamp),
    cpu: m.cpu.overall,
    memory: m.memory.percent,
    disk: m.disk.percent,
    networkRx: m.network.rxSec / 1024 / 1024,
    networkTx: m.network.txSec / 1024 / 1024,
  }));
}

function localMetricsToData(metrics: LocalMetrics[]): MetricDataPoint[] {
  return metrics.map((m) => ({
    time: formatTime(m.timestamp),
    cpu: m.cpu.overall,
    memory: m.memory.percent,
    disk: m.disk.percent,
  }));
}

function agentMetricsToData(metrics: AgentMetrics[]): MetricDataPoint[] {
  return metrics.map((m) => ({
    time: formatTime(m.timestamp),
    cpu: m.cpuPercent,
    memory: m.memoryMb,
  }));
}

interface MetricsChartProps {
  title: string;
  data: MetricDataPoint[];
  metrics: ("cpu" | "memory" | "disk" | "networkRx" | "networkTx")[];
  colors?: Record<string, string>;
  height?: number;
  showArea?: boolean;
}

export function MetricsChart({ title, data, metrics, colors = {}, height = 300, showArea = false }: MetricsChartProps) {
  const defaultColors = {
    cpu: "hsl(var(--primary))",
    memory: "hsl(var(--success))",
    disk: "hsl(var(--warning))",
    networkRx: "hsl(var(--destructive))",
    networkTx: "hsl(200, 70%, 50%)",
  };

  const metricConfigs = metrics.map((key) => ({
    key,
    label: key === "cpu" ? "CPU %" : key === "memory" ? "Memory %" : key === "disk" ? "Disk %" : key === "networkRx" ? "RX MB/s" : "TX MB/s",
    color: colors[key] || defaultColors[key as keyof typeof defaultColors],
  }));

  if (data.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-8 text-center">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const ChartComponent = showArea ? AreaChart : LineChart;
  const SeriesComponent = showArea ? Area : Line;

  return (
    <div className="bg-card border rounded-xl p-5">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="h-[{height}px]">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              formatter={(value: number, name: string) => {
                const config = metricConfigs.find((m) => m.key === name);
                if (name.includes("network")) return [`${value.toFixed(2)} MB/s`, config?.label || name];
                if (name === "cpu" || name === "memory" || name === "disk") return [`${value.toFixed(1)}%`, config?.label || name];
                return [value, config?.label || name];
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: "10px" }}
              formatter={(value) => {
                const config = metricConfigs.find((m) => m.key === value);
                return config?.label || value;
              }}
            />
            {metricConfigs.map(({ key, color }) => (
              <SeriesComponent
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                fill={color}
                fillOpacity={showArea ? 0.1 : 0}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            ))}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface SystemMetricsChartsProps {
  localMetrics: LocalMetrics[];
  remoteMetrics: SystemMetrics[];
  agentMetrics: Record<string, AgentMetrics[]>;
}

export function SystemMetricsCharts({ localMetrics, remoteMetrics, agentMetrics }: SystemMetricsChartsProps) {
  const localData = localMetricsToData(localMetrics);
  const remoteData = systemMetricsToData(remoteMetrics);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <MetricsChart
          title="Local System Metrics"
          data={localData}
          metrics={["cpu", "memory", "disk"]}
          height={300}
          showArea
        />
        <MetricsChart
          title="Remote System Metrics"
          data={remoteData}
          metrics={["cpu", "memory", "disk", "networkRx", "networkTx"]}
          height={300}
          showArea
        />
      </div>

      {Object.keys(agentMetrics).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Agent Metrics</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {Object.entries(agentMetrics).map(([agentId, metrics]) => (
              <MetricsChart
                key={agentId}
                title={`Agent: ${agentId}`}
                data={agentMetricsToData(metrics)}
                metrics={["cpu", "memory"]}
                height={250}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}