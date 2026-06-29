import { getDb, insertLocalMetrics, getLocalMetricsHistory } from "@/lib/db";
import { collectLocalMetrics } from "@/lib/local-metrics";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const db = getDb();
    const metrics = await collectLocalMetrics();
    insertLocalMetrics(db, metrics);
    return NextResponse.json({ success: true, data: metrics, timestamp: new Date() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date() },
      { status: 500 }
    );
  }
}