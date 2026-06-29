/**
 * Hermes Agent Node.js Template (compiled JavaScript)
 * Implements the JSON-lines stdout protocol for communication with the agent service.
 */

class HermesAgent {
  constructor(agentId) {
    this.agentId = agentId || process.env.HERMES_AGENT_ID || `agent-${this.generateId()}`;
    this.running = true;
    this.startTime = Date.now();
    this.heartbeatInterval = 10000;
    this.lastHeartbeat = 0;
  }

  generateId() {
    return Math.random().toString(36).substring(2, 10);
  }

  send(message) {
    console.log(JSON.stringify(message));
  }

  log(level, message) {
    this.send({
      type: "log",
      level,
      msg: message,
    });
  }

  heartbeat() {
    this.send({
      type: "heartbeat",
      ts: new Date().toISOString(),
      agent_id: this.agentId,
    });
  }

  status(state, message = "") {
    this.send({
      type: "status",
      state,
      msg: message,
    });
  }

  cost(provider, model, tokensIn, tokensOut) {
    this.send({
      type: "cost",
      provider,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      agent_id: this.agentId,
    });
  }

  async run() {
    this.status("initializing", "Starting up");
    await this.sleep(1000);

    this.status("running", "Agent is running");
    this.log("info", `Agent ${this.agentId} started`);

    try {
      while (this.running) {
        const now = Date.now();

        if (now - this.lastHeartbeat >= this.heartbeatInterval) {
          this.heartbeat();
          this.lastHeartbeat = now;
        }

        await this.doWork();

        await this.sleep(1000);
      }
    } catch (error) {
      this.log("error", `Agent error: ${error}`);
      this.status("error", String(error));
    } finally {
      this.status("completed", "Agent stopped");
      this.log("info", `Agent ${this.agentId} stopped`);
    }
  }

  async doWork() {
    // Override this method with your agent's main work
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  stop() {
    this.running = false;
  }
}

function main() {
  const agent = new HermesAgent();

  process.on("SIGINT", () => {
    agent.stop();
  });

  process.on("SIGTERM", () => {
    agent.stop();
  });

  agent.run().catch((error) => {
    console.error(JSON.stringify({
      type: "log",
      level: "error",
      msg: `Fatal error: ${error}`,
    }));
    process.exit(1);
  });
}

main();