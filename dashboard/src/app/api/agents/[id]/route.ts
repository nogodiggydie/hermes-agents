import { NextRequest, NextResponse } from "next/server";
import { fetchRemoteAgent, stopRemoteAgent, restartRemoteAgent, deleteRemoteAgent } from "@/lib/remote-client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await fetchRemoteAgent(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date() },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action } = await request.json();

    let result;
    switch (action) {
      case "stop":
        result = await stopRemoteAgent(id);
        break;
      case "restart":
        result = await restartRemoteAgent(id);
        break;
      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date() },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await deleteRemoteAgent(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date() },
      { status: 500 }
    );
  }
}