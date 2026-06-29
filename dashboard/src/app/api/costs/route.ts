import { NextRequest, NextResponse } from "next/server";
import { fetchRemoteLogs, fetchRemoteCosts, fetchRemoteCostSummary } from "@/lib/remote-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId") || undefined;
    const provider = searchParams.get("provider") || undefined;
    const since = searchParams.get("since") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const [costsResult, summaryResult] = await Promise.all([
      fetchRemoteCosts({ agentId, provider, since, limit }),
      fetchRemoteCostSummary(30),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        costs: costsResult.data?.costs || [],
        summaries: summaryResult.data?.summaries || [],
        totalCost: summaryResult.data?.totalCost || 0,
        dailyCosts: summaryResult.data?.dailyCosts || [],
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