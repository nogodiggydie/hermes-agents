import { NextRequest, NextResponse } from "next/server";
import { fetchRemoteLogs } from "@/lib/remote-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const result = await fetchRemoteLogs(agentId, limit);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date() },
      { status: 500 }
    );
  }
}