/**
 * Hermes Agent Node.js Template
 * Implements the JSON-lines stdout protocol for communication with the agent service.
 */

interface AgentMessage {
  type: "heartbeat" | "status" | "cost" | "log";
  [key: string]: unknown;
}

interface HeartbeatMessage {
  type: "heartbeat";
  ts: string;
  agent_id: string;
}

interface StatusMessage {
  type: "status";
  state: "initializing" | "running" | "completed" | "error" | "paused";
  msg: string;
}

interface CostMessage {
  type: "cost";
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  agent_id: string;
}

interface LogMessage {
  type: "log";
  level: "debug" | "info" | "warn" | "error";
  msg: string;
}

export abstract class HermesAgent {
  protected agentId: string;
  protected running: boolean = true;
  protected startTime: number;
  protected heartbeatInterval: number = 10000;
  protected lastHeartbeat: number = 0;

  constructor(agentId?: string) {
    this.agentId = agentId || process.env.HERMES_AGENT_ID || `agent-${Math.random().toString(36).slice(2, 10)}`;
    this.startTime = Date.now();
  }

  protected send(message: AgentMessage): void {
    console.log(JSON.stringify(message));
  }

  log(level: LogMessage["level"], message: string): void {
    this.send({
      type: "log",
      level,
      msg: message,
    });
  }

  heartbeat(): void {
    this.send({
      type: "heartbeat",
      ts: new Date().toISOString(),
      agent_id: this.agentId,
    } as HeartbeatMessage);
  }

  status(state: StatusMessage["state"], message: string = ""): void {
    this.send({
      type: "status",
      state,
      msg: message,
    } as StatusMessage);
  }

  cost(provider: string, model: string, tokensIn: number, tokensOut: number): void {
    this.send({
      type: "cost",
      provider,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      agent_id: this.agentId,
    } as CostMessage);
  }

  async run(): Promise<void> {
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

  protected abstract doWork(): Promise<void>;

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  stop(): void {
    this.running = false;
  }
}

// Example usage:
// class MyAgent extends HermesAgent {
//   protected async doWork(): Promise<void> {
//     // Your work here
//   }
// }
//
// if (require.main === module) {
//   new MyAgent().run().catch(console.error);
// }