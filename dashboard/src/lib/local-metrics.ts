import si from "systeminformation";
import { LocalMetrics } from "./types";

let lastNetworkStats: { rx: number; tx: number; timestamp: number } | null = null;

export async function collectLocalMetrics(): Promise<LocalMetrics> {
  try {
    const [cpu, mem, disk, net] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
    ]);

    const totalDisk = disk.reduce((sum, d) => sum + d.size, 0);
    const usedDisk = disk.reduce((sum, d) => sum + d.used, 0);
    const rxBytes = net.reduce((sum, n) => sum + n.rx_bytes, 0);
    const txBytes = net.reduce((sum, n) => sum + n.tx_bytes, 0);

    let rxSec = 0;
    let txSec = 0;
    const now = Date.now();

    if (lastNetworkStats) {
      const dt = (now - lastNetworkStats.timestamp) / 1000;
      if (dt > 0) {
        rxSec = (rxBytes - lastNetworkStats.rx) / dt;
        txSec = (txBytes - lastNetworkStats.tx) / dt;
      }
    }

    lastNetworkStats = { rx: rxBytes, tx: txBytes, timestamp: now };

    return {
      cpu: {
        overall: cpu.currentLoad,
        cores: cpu.cpus.map((c) => c.load),
      },
      memory: {
        total: mem.total,
        used: mem.active,
        free: mem.available,
        percent: (mem.active / mem.total) * 100,
      },
      disk: {
        total: totalDisk,
        used: usedDisk,
        free: totalDisk - usedDisk,
        percent: totalDisk > 0 ? (usedDisk / totalDisk) * 100 : 0,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("Failed to collect local metrics:", error);
    return getEmptyMetrics();
  }
}

function getEmptyMetrics(): LocalMetrics {
  return {
    cpu: { overall: 0, cores: [] },
    memory: { total: 0, used: 0, free: 0, percent: 0 },
    disk: { total: 0, used: 0, free: 0, percent: 0 },
    timestamp: new Date(),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getMemoryColor(percent: number): string {
  if (percent >= 90) return "text-destructive";
  if (percent >= 75) return "text-warning";
  return "text-success";
}

export function getCpuColor(percent: number): string {
  if (percent >= 90) return "text-destructive";
  if (percent >= 75) return "text-warning";
  return "text-success";
}