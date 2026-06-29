import { NextRequest, NextResponse } from "next/server";
import { getDb, getLocalMetricsHistory, getRemoteMetricsHistory, getAgentMetricsHistory } from "@/lib/db";
import { fetchRemoteMetrics } from "@/lib/remote-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "288", 10);
    const agentId = searchParams.get("agentId");
    const includeRemote = searchParams.get("remote") === "true";

    const db = getDb();
    const localHistory = getLocalMetricsHistory(db, limit);
    let remoteHistory: any[] = [];
    let agentHistories: Record<string, any[]> = {};

    if (includeRemote) {
      try {
        const remoteMetrics = await fetchRemoteMetrics();
        insertRemoteMetrics(db, remoteMetrics);
        remoteHistory = getRemoteMetricsHistory(db, limit);
        
        if (agentId) {
          agentHistories[agentId] = getAgentMetricsHistory(db, agentId, limit);
        }
      } catch (error) {
        console.error("Failed to fetch remote metrics:", error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        local: localHistory,
        remote: remoteHistory,
        agents: agentHistories,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date() },
      { status: 500 }
    );
  }
}