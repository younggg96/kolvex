import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

interface RouteParams {
  params: Promise<{ conversationId: string }>;
}

/**
 * POST /api/chat-history/conversations/[conversationId]/stream
 * Send a message and stream AI Agent response (SSE)
 * Proxies to backend: POST /api/v1/chat/conversations/{id}/stream
 *
 * SSE event types from backend:
 * - token: AI response text chunk
 * - tool_start: Agent started calling a tool
 * - tool_end: Tool call completed
 * - done: Stream completed
 * - error: Error occurred
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { conversationId } = await params;

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/chat/conversations/${conversationId}/stream?continue_on_disconnect=true`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
        signal: request.signal,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to stream message" },
        { status: response.status }
      );
    }

    // Pipe the SSE stream directly from backend to client
    if (!response.body) {
      return NextResponse.json(
        { error: "No response body" },
        { status: 500 }
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Stream API Error:", error);
    return NextResponse.json(
      { error: "Failed to stream message" },
      { status: 500 }
    );
  }
}

async function requestStreamState(method: "GET" | "DELETE", params: RouteParams["params"]) {
  try {
    const { conversationId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/chat/conversations/${conversationId}/stream`,
      {
        method,
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      }
    );
    if (!response.ok) {
      return NextResponse.json({ error: "Could not check chat generation" }, { status: response.status });
    }
    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Chat generation state request failed:", error);
    return NextResponse.json({ error: "Could not reach chat generation" }, { status: 502 });
  }
}

export function GET(_request: NextRequest, { params }: RouteParams) {
  return requestStreamState("GET", params);
}

export function DELETE(_request: NextRequest, { params }: RouteParams) {
  return requestStreamState("DELETE", params);
}
