import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initDb } from "./db.js";
import { agentManager } from "./agent-manager.js";
import { metricsCollector } from "./metrics-collector.js";
import { logAggregator } from "./log-aggregator.js";
import { costTracker } from "./cost-tracker.js";
import { setupRoutes } from "./routes.js";
import { LogEntry, LogLevel } from "./types.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

setupRoutes(app);

const wss = new WebSocketServer({ server, path: "/ws/logs" });

wss.on("connection", (ws: WebSocket, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const agentId = url.searchParams.get("agentId") || undefined;
  const levelFilter = url.searchParams.get("levels")?.split(",") as LogLevel[] | undefined;

  logAggregator.subscribe(ws, agentId, levelFilter);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "subscribe") {
        // Allow dynamic subscription changes
      }
    } catch {
      // Ignore invalid messages
    }
  });
});

agentManager.on("log", (entry: LogEntry) => {
  logAggregator.handleAgentOutput(entry.agentId, entry.message, entry.level === "error");
});

agentManager.on("cost", (costData: any) => {
  costTracker.recordCost({
    type: "cost",
    provider: costData.provider,
    model: costData.model,
    tokens_in: costData.tokensIn,
    tokens_out: costData.tokensOut,
    agent_id: costData.agentId,
  });
});

async function start(): Promise<void> {
  initDb();
  agentManager.restoreAgents();

  metricsCollector.start();

  server.listen(PORT, HOST, () => {
    console.log(`Hermes Agent Service listening on ${HOST}:${PORT}`);
    console.log(`WebSocket endpoint: ws://${HOST}:${PORT}/ws/logs`);
  });

  process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    metricsCollector.stop();
    agentManager.shutdown();
    server.close(() => {
      process.exit(0);
    });
  });
}

start().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});