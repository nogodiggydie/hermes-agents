import { Request, Response } from "express";
import { agentManager } from "./agent-manager.js";
import { metricsCollector } from "./metrics-collector.js";
import { logAggregator } from "./log-aggregator.js";
import { costTracker } from "./cost-tracker.js";
import { db, getAllAgents, getAgent, upsertAgent, deleteAgent } from "./db.js";
import {
  AgentInfo,
  AgentConfig,
  AgentType,
  AgentStatus,
  SystemMetrics,
  HealthResponse,
  ApiResponse,
  LogEntry,
  CostSummary,
  CostEntry,
} from "./types.js";

export function setupRoutes(app: any): void {
  app.get("/health", async (req: Request, res: Response) => {
    try {
      const systemMetrics = await metricsCollector.getCurrentSystemMetrics();
      const agents = getAllAgents(db);
      const runningAgents = agents.filter((a) => a.status === "running").length;

      const response: HealthResponse = {
        status: runningAgents > 0 ? "healthy" : "degraded",
        uptime: process.uptime(),
        agentCount: agents.length,
        runningAgents,
        systemMetrics,
        timestamp: new Date(),
      };

      res.json({ success: true, data: response, timestamp: new Date() });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.get("/api/agents", (req: Request, res: Response) => {
    try {
      const agents = getAllAgents(db);
      res.json({ success: true, data: agents, timestamp: new Date() });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.get("/api/agents/:id", (req: Request, res: Response) => {
    try {
      const agent = getAgent(db, req.params.id);
      if (!agent) {
        return res.status(404).json({ success: false, error: "Agent not found", timestamp: new Date() });
      }
      res.json({ success: true, data: agent, timestamp: new Date() });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.post("/api/agents", async (req: Request, res: Response) => {
    try {
      const config = req.body as AgentConfig;
      if (!config.id || !config.type || !config.command || !config.args) {
        return res.status(400).json({ success: false, error: "Missing required fields", timestamp: new Date() });
      }

      if (!["python", "node"].includes(config.type)) {
        return res.status(400).json({ success: false, error: "Invalid agent type", timestamp: new Date() });
      }

      const agent = await agentManager.startAgent(config);
      res.status(201).json({ success: true, data: agent, timestamp: new Date() });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.post("/api/agents/:id/stop", async (req: Request, res: Response) => {
    try {
      await agentManager.stopAgent(req.params.id);
      const agent = getAgent(db, req.params.id);
      res.json({ success: true, data: agent, timestamp: new Date() });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.post("/api/agents/:id/restart", async (req: Request, res: Response) => {
    try {
      const agent = await agentManager.restartAgent(req.params.id);
      res.json({ success: true, data: agent, timestamp: new Date() });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.delete("/api/agents/:id", (req: Request, res: Response) => {
    try {
      const agent = getAgent(db, req.params.id);
      if (!agent) {
        return res.status(404).json({ success: false, error: "Agent not found", timestamp: new Date() });
      }

      if (agent.status === "running") {
        return res.status(400).json({ success: false, error: "Cannot delete running agent", timestamp: new Date() });
      }

      deleteAgent(db, req.params.id);
      res.json({ success: true, timestamp: new Date() });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.get("/api/metrics", async (req: Request, res: Response) => {
    try {
      const systemMetrics = await metricsCollector.getCurrentSystemMetrics();
      const agents = getAllAgents(db);
      const agentMetrics = agents
        .filter((a) => a.status === "running")
        .map((a) => ({
          agentId: a.id,
          cpuPercent: a.cpuPercent,
          memoryMb: a.memoryMb,
        }));

      res.json({
        success: true,
        data: { system: systemMetrics, agents: agentMetrics },
        timestamp: new Date(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.get("/api/metrics/history", (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 288;
      const agentId = req.query.agentId as string;

      const { getSystemMetricsHistory, getAgentMetricsHistory } = await import("./db.js");
      const systemHistory = getSystemMetricsHistory(db, limit);

      let agentHistory: any[] = [];
      if (agentId) {
        agentHistory = getAgentMetricsHistory(db, agentId, limit);
      }

      res.json({ success: true, data: { system: systemHistory, agents: agentHistory }, timestamp: new Date() });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.get("/api/logs", (req: Request, res: Response) => {
    try {
      const agentId = req.query.agentId as string | null;
      const limit = parseInt(req.query.limit as string) || 100;

      const logs = logAggregator.getRecentLogs(agentId || undefined, limit);
      res.json({ success: true, data: logs, timestamp: new Date() });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.get("/api/costs", (req: Request, res: Response) => {
    try {
      const agentId = req.query.agentId as string | null;
      const provider = req.query.provider as string | null;
      const since = req.query.since ? new Date(req.query.since as string) : null;
      const limit = parseInt(req.query.limit as string) || 100;

      const { getCosts, getCostSummaries } = await import("./db.js");
      const costs = getCosts(db, agentId || undefined, provider || undefined, since || undefined, limit);
      const summaries = getCostSummaries(db, since || undefined);

      res.json({ success: true, data: { costs, summaries }, timestamp: new Date() });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.post("/api/costs/pricing", (req: Request, res: Response) => {
    try {
      const { provider, model, inputPrice, outputPrice } = req.body;
      if (!provider || !model || inputPrice === undefined || outputPrice === undefined) {
        return res.status(400).json({ success: false, error: "Missing required fields", timestamp: new Date() });
      }
      costTracker.addCustomPricing(provider, model, inputPrice, outputPrice);
      res.json({ success: true, timestamp: new Date() });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });

  app.get("/api/costs/summary", (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const summaries = costTracker.getCostSummary(undefined, undefined, startDate);
      const totalCost = costTracker.getTotalCost(startDate);
      const dailyCosts = costTracker.getCostsByPeriod(days);

      res.json({
        success: true,
        data: { summaries, totalCost, dailyCosts },
        timestamp: new Date(),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error), timestamp: new Date() });
    }
  });
}