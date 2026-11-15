import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

/** Proxy to the backend's cross-conversation chat memory (GET to view, DELETE to clear). */
async function forward(method: "GET" | "DELETE") {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const response = await fetch(`${BACKEND_API_URL}/api/v1/chat/memory`, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || "Chat memory request failed" },
        { status: response.status },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Chat memory API error:", error);
    return NextResponse.json({ error: "Chat memory request failed" }, { status: 500 });
  }
}

export function GET() {
  return forward("GET");
}

export function DELETE() {
  return forward("DELETE");
}
