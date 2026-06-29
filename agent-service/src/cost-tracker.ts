import { db } from "./db.js";
import { CostEntry, CostSummary, AgentCostMessage } from "./types.js";

interface Pricing {
  provider: string;
  model: string;
  inputPricePer1k: number;
  outputPricePer1k: number;
}

export class CostTracker {
  private pricingCache: Map<string, Pricing> = new Map();

  constructor() {
    this.loadPricing();
  }

  private loadPricing(): void {
    const rows = db.prepare("SELECT * FROM pricing").all() as Pricing[];
    for (const row of rows) {
      this.pricingCache.set(`${row.provider}:${row.model}`, row);
    }
  }

  addCustomPricing(provider: string, model: string, inputPricePer1k: number, outputPricePer1k: number): void {
    db.prepare(`
      INSERT OR REPLACE INTO pricing (provider, model, input_price_per_1k, output_price_per_1k)
      VALUES (?, ?, ?, ?)
    `).run(provider, model, inputPricePer1k, outputPricePer1k);

    this.pricingCache.set(`${provider}:${model}`, {
      provider,
      model,
      inputPricePer1k,
      outputPricePer1k,
    });
  }

  getPricing(provider: string, model: string): Pricing | null {
    return this.pricingCache.get(`${provider}:${model}`) || null;
  }

  recordCost(message: AgentCostMessage): CostEntry {
    const pricing = this.getPricing(message.provider, message.model);

    let costUsd = 0;
    if (pricing) {
      costUsd = (message.tokens_in / 1000) * pricing.inputPricePer1k + (message.tokens_out / 1000) * pricing.outputPricePer1k;
    }

    const entry: CostEntry = {
      id: 0,
      agentId: message.agent_id,
      provider: message.provider,
      model: message.model,
      tokensIn: message.tokens_in,
      tokensOut: message.tokens_out,
      costUsd,
      timestamp: new Date(),
    };

    const stmt = db.prepare(`
      INSERT INTO costs (agent_id, provider, model, tokens_in, tokens_out, cost_usd, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      entry.agentId,
      entry.provider,
      entry.model,
      entry.tokensIn,
      entry.tokensOut,
      entry.costUsd,
      entry.timestamp.getTime()
    );
    entry.id = result.lastInsertRowid as number;

    return entry;
  }

  getCostSummary(
    agentId?: string,
    provider?: string,
    startDate?: Date,
    endDate?: Date
  ): CostSummary[] {
    let query = `
      SELECT
        provider,
        model,
        SUM(tokens_in) as total_tokens_in,
        SUM(tokens_out) as total_tokens_out,
        SUM(cost_usd) as total_cost_usd,
        COUNT(*) as call_count
      FROM costs
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (agentId) {
      query += " AND agent_id = ?";
      params.push(agentId);
    }
    if (provider) {
      query += " AND provider = ?";
      params.push(provider);
    }
    if (startDate) {
      query += " AND timestamp >= ?";
      params.push(startDate.getTime());
    }
    if (endDate) {
      query += " AND timestamp <= ?";
      params.push(endDate.getTime());
    }

    query += " GROUP BY provider, model ORDER BY total_cost_usd DESC";

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      totalTokensIn: row.total_tokens_in,
      totalTokensOut: row.total_tokens_out,
      totalCostUsd: row.total_cost_usd,
      callCount: row.call_count,
    }));
  }

  getCostHistory(
    agentId?: string,
    limit: number = 100,
    offset: number = 0
  ): CostEntry[] {
    let query = "SELECT * FROM costs WHERE 1=1";
    const params: (string | number)[] = [];

    if (agentId) {
      query += " AND agent_id = ?";
      params.push(agentId);
    }

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      provider: row.provider,
      model: row.model,
      tokensIn: row.tokens_in,
      tokensOut: row.tokens_out,
      costUsd: row.cost_usd,
      timestamp: new Date(row.timestamp),
    }));
  }

  getTotalCost(startDate?: Date, endDate?: Date): number {
    let query = "SELECT SUM(cost_usd) as total FROM costs WHERE 1=1";
    const params: number[] = [];

    if (startDate) {
      query += " AND timestamp >= ?";
      params.push(startDate.getTime());
    }
    if (endDate) {
      query += " AND timestamp <= ?";
      params.push(endDate.getTime());
    }

    const row = db.prepare(query).get(...params) as { total: number | null };
    return row.total || 0;
  }

  getCostsByPeriod(days: number = 30): Array<{ date: string; cost: number }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const rows = db.prepare(`
      SELECT
        date(timestamp / 1000, 'unixepoch') as date,
        SUM(cost_usd) as cost
      FROM costs
      WHERE timestamp >= ?
      GROUP BY date
      ORDER BY date
    `).all(startDate.getTime()) as { date: string; cost: number }[];

    return rows;
  }
}

export const costTracker = new CostTracker();