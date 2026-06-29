"use client";

import { useMemo } from "react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CostEntry, CostSummary } from "@/lib/types";

const PROVIDER_COLORS: Record<string, string> = {
  "kilo-gateway": "hsl(var(--primary))",
  gemini: "hsl(160, 70%, 45%)",
  codex: "hsl(25, 90%, 55%)",
  copilot: "hsl(220, 90%, 55%)",
  "claude-code": "hsl(340, 70%, 50%)",
};

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

function formatCost(cost: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4 }).format(cost);
}

interface CostTableProps {
  entries: CostEntry[];
  summaries: CostSummary[];
  totalCost: number;
  dailyCosts: Array<{ date: string; cost: number }>;
}

export function CostTable({ entries, summaries, totalCost, dailyCosts }: CostTableProps) {
  const providerColorMap = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(PROVIDER_COLORS).map(([k, v]) => [k, v])
      ),
    []
  );

  if (summaries.length === 0 && entries.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-8 text-center">
        <p className="text-muted-foreground">No cost data available</p>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* Summary Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Cost</p>
            <p className="text-2xl font-bold text-foreground">{formatCost(totalCost)}</p>
          </div>
          <div className="flex items-center gap-4">
            {summaries.slice(0, 5).map((s) => (
              <div key={`${s.provider}-${s.model}`} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: providerColorMap[s.provider] || "hsl(var(--muted-foreground))" }}
                />
                <span className="text-xs text-muted-foreground">
                  {s.provider}/{s.model}: {formatCost(s.totalCostUsd)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Provider Summary Table */}
      {summaries.length > 0 && (
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="pb-2 pr-4">Provider</th>
                <th className="pb-2 pr-4">Model</th>
                <th className="pb-2 pr-4 text-right">Tokens In</th>
                <th className="pb-2 pr-4 text-right">Tokens Out</th>
                <th className="pb-2 pr-4 text-right">Total Cost</th>
                <th className="pb-2 pr-4 text-right">Calls</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={`${s.provider}-${s.model}`} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 pr-4">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${providerColorMap[s.provider] || "hsl(var(--muted-foreground))"}20`,
                        color: providerColorMap[s.provider] || "hsl(var(--muted-foreground))",
                      }}
                    >
                      {s.provider}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{s.model}</td>
                  <td className="py-2 pr-4 text-right font-mono">{formatNumber(s.totalTokensIn)}</td>
                  <td className="py-2 pr-4 text-right font-mono">{formatNumber(s.totalTokensOut)}</td>
                  <td className="py-2 pr-4 text-right font-bold">{formatCost(s.totalCostUsd)}</td>
                  <td className="py-2 pr-4 text-right">{formatNumber(s.callCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily Costs Chart */}
      {dailyCosts.length > 0 && (
        <div className="p-4 border-t border-border">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Daily Costs (Last 30 Days)</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={dailyCosts.map((d) => ({ name: d.date, value: d.cost }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${formatCost(percent * totalCost)}`}
                  labelLine={false}
                >
                  {dailyCosts.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${360 / dailyCosts.length * index}, 70%, 50%)`} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatCost(value), "Cost"]}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Entries */}
      {entries.length > 0 && (
        <div className="p-4 border-t border-border">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Recent Cost Entries</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Agent</th>
                  <th className="pb-2 pr-4">Provider/Model</th>
                  <th className="pb-2 pr-4 text-right">Tokens In</th>
                  <th className="pb-2 pr-4 text-right">Tokens Out</th>
                  <th className="pb-2 pr-4 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 20).map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 pr-4 text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-4 font-mono text-sm">{entry.agentId}</td>
                    <td className="py-2 pr-4">
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: `${providerColorMap[entry.provider] || "hsl(var(--muted-foreground))"}20`,
                          color: providerColorMap[entry.provider] || "hsl(var(--muted-foreground))",
                        }}
                      >
                        {entry.provider}
                      </span>
                      /{entry.model}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">{formatNumber(entry.tokensIn)}</td>
                    <td className="py-2 pr-4 text-right font-mono">{formatNumber(entry.tokensOut)}</td>
                    <td className="py-2 pr-4 text-right font-bold">{formatCost(entry.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}