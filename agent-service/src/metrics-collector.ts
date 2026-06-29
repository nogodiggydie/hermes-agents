import si from "systeminformation";
import pidusage from "pidusage";
import { db, getAllAgents, getAgent, insertSystemMetrics, insertAgentMetrics } from "./db.js";
import { SystemMetrics, AgentMetrics } from "./types.js";

export class MetricsCollector {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private lastNetworkStats: { rx: number; tx: number; timestamp: number } | null = null;

  constructor(intervalMs: number = 5000) {
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.intervalId) return;
    this.collect();
    this.intervalId = setInterval(() => this.collect(), this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async collect(): Promise<void> {
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

      if (this.lastNetworkStats) {
        const dt = (now - this.lastNetworkStats.timestamp) / 1000;
        if (dt > 0) {
          rxSec = (rxBytes - this.lastNetworkStats.rx) / dt;
          txSec = (txBytes - this.lastNetworkStats.tx) / dt;
        }
      }

      this.lastNetworkStats = { rx: rxBytes, tx: txBytes, timestamp: now };

      const systemMetrics: SystemMetrics = {
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
        network: {
          rxBytes,
          txBytes,
          rxSec,
          txSec,
        },
        timestamp: new Date(),
      };

      insertSystemMetrics(db, systemMetrics);

      const agents = getAllAgents(db);
      for (const agent of agents) {
        if (agent.status === "running" && agent.pid) {
          try {
            const usage = await pidusage(agent.pid);
            const stats = usage[agent.pid!];
            if (!stats) continue;

            const agentMetrics: AgentMetrics = {
              agentId: agent.id,
              cpuPercent: stats.cpu,
              memoryMb: stats.memory / 1024 / 1024,
              timestamp: new Date(),
            };
            insertAgentMetrics(db, agentMetrics);

            agent.cpuPercent = stats.cpu;
            agent.memoryMb = stats.memory / 1024 / 1024;
            agent.uptime = Math.floor((Date.now() - (agent.startedAt?.getTime() || Date.now())) / 1000);
          } catch {
            // Process might have exited
          }
        }
      }
    } catch (error) {
      console.error("Metrics collection error:", error);
    }
  }

  async getCurrentSystemMetrics(): Promise<SystemMetrics> {
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
      network: {
        rxBytes,
        txBytes,
        rxSec: 0,
        txSec: 0,
      },
      timestamp: new Date(),
    };
  }
}

export const metricsCollector = new MetricsCollector();