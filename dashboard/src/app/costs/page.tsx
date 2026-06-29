"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Download, Calendar } from "lucide-react";
import { NavSidebar } from "@/components/NavSidebar";
import { CostTable } from "@/components/CostTable";
import { fetchRemoteCostSummary, fetchRemoteCosts } from "@/lib/remote-client";
import { CostEntry, CostSummary, ConnectionStatus } from "@/lib/types";

export default function CostsPage() {
  const [summaries, setSummaries] = useState<CostSummary[]>([]);
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [dailyCosts, setDailyCosts] = useState<Array<{ date: string; cost: number }>>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  const refresh = async () => {
    try {
      setConnectionStatus("connecting");
      
      const [summaryResult, costsResult] = await Promise.all([
        fetchRemoteCostSummary(timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90),
        fetchRemoteCosts({ limit: 500 }),
      ]);

      if (summaryResult.success && summaryResult.data) {
        setSummaries(summaryResult.data.summaries || []);
        setTotalCost(summaryResult.data.totalCost || 0);
        setDailyCosts(summaryResult.data.dailyCosts || []);
      }

      if (costsResult.success && costsResult.data) {
        setEntries(costsResult.data.costs || []);
      }

      setConnectionStatus("connected");
    } catch (error) {
      console.error("Failed to refresh costs:", error);
      setConnectionStatus("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const formatCost = (cost: number) => 
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4 }).format(cost);

  const formatNumber = (num: number) => 
    new Intl.NumberFormat().format(num);

  const providers = Array.from(new Set(entries.map((e) => e.provider))).sort();

  return (
    <div className="flex h-screen bg-background">
      <NavSidebar connectionStatus={connectionStatus} />

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Cost Tracking</h1>
              <p className="text-muted-foreground">LLM API usage and cost monitoring</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as "7d" | "30d" | "90d")}
                  className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
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

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-card border rounded-xl p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Cost</h3>
              <p className="text-3xl font-bold">{formatCost(totalCost)}</p>
              <p className="text-sm text-muted-foreground">{timeRange} period</p>
            </div>
            <div className="bg-card border rounded-xl p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Calls</h3>
              <p className="text-3xl font-bold">{formatNumber(entries.length)}</p>
              <p className="text-sm text-muted-foreground">API requests</p>
            </div>
            <div className="bg-card border rounded-xl p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Tokens In</h3>
              <p className="text-3xl font-bold">
                {formatNumber(entries.reduce((sum, e) => sum + e.tokensIn, 0))}
              </p>
              <p className="text-sm text-muted-foreground">Input tokens</p>
            </div>
            <div className="bg-card border rounded-xl p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Tokens Out</h3>
              <p className="text-3xl font-bold">
                {formatNumber(entries.reduce((sum, e) => sum + e.tokensOut, 0))}
              </p>
              <p className="text-sm text-muted-foreground">Output tokens</p>
            </div>
          </div>

          {/* Cost Table */}
          <CostTable
            summaries={summaries}
            entries={entries}
            totalCost={totalCost}
            dailyCosts={dailyCosts}
          />
        </div>
      </main>
    </div>
  );
}