import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = Array.isArray(data.detail) ? "Invalid request" : data.detail;
      return NextResponse.json(
        { error: detail || data.error || "Backend request failed" },
        { status: response.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("AI technical analysis proxy error:", error);
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}
