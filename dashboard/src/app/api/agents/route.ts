import { NextRequest, NextResponse } from "next/server";
import { fetchRemoteAgents, fetchRemoteAgent, startRemoteAgent, stopRemoteAgent, restartRemoteAgent, deleteRemoteAgent } from "@/lib/remote-client";

export async function GET() {
  try {
    const result = await fetchRemoteAgents();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date() },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();
    const result = await startRemoteAgent(config);
    return NextResponse.json(result, { status: result.success ? 201 : 500 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date() },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  return NextResponse.json({ success: false, error: "Method not allowed" }, { status: 405 });
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json({ success: false, error: "Method not allowed" }, { status: 405 });
}