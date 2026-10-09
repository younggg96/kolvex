import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Structured output from reasoning models can take longer than one minute.
export const maxDuration = 300;

// Leave time to return a JSON error before Vercel terminates the function.
const BACKEND_TIMEOUT_MS = 270_000;

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol } = await params;
  const timeout = AbortSignal.timeout(BACKEND_TIMEOUT_MS);
  const signal = AbortSignal.any([request.signal, timeout]);
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/market/ai-technical/${encodeURIComponent(symbol)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: await request.text(),
        cache: "no-store",
        signal,
      }
    );
    const data = await response.json().catch((error) => {
      // Body reads can time out after the response headers have arrived.
      signal.throwIfAborted();
      if (response.ok) throw error;
      return {};
    });
    if (!response.ok) {
      const detail = Array.isArray(data.detail) ? "Invalid request" : data.detail;
      return NextResponse.json(
        { error: detail || data.error || "Backend request failed" },
        { status: response.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    if (timeout.aborted) {
      console.warn("AI technical analysis backend timed out:", symbol);
      return NextResponse.json({ error: "ai_analysis_timeout" }, { status: 504 });
    }
    if (request.signal.aborted) {
      return NextResponse.json({ error: "Request cancelled" }, { status: 499 });
    }
    console.error("AI technical analysis proxy error:", error);
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}
