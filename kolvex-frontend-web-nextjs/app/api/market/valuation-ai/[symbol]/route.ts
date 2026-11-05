import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 170;

// Leave time to return a JSON error before the function is terminated.
const BACKEND_TIMEOUT_MS = 150_000;
const API = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest, { params }: { params: { symbol: string } }) {
  if (!/^[A-Za-z0-9][A-Za-z0-9.\-]{0,11}$/.test(params.symbol))
    return NextResponse.json({ error: "Invalid valuation request" }, { status: 400, headers });
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const body = await request.text();
  if (body.length > 2000) return NextResponse.json({ error: "Request too large" }, { status: 413, headers });
  const timeout = AbortSignal.timeout(BACKEND_TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/api/v1/valuation/${encodeURIComponent(params.symbol)}/ai-assumptions`, {
      method: "POST", body, cache: "no-store", signal: AbortSignal.any([request.signal, timeout]),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = typeof data.detail === "string" ? data.detail : response.status === 401 ? "Unauthorized" : "ai_unavailable";
      return NextResponse.json({ error }, { status: response.status, headers });
    }
    return NextResponse.json(data, { headers });
  } catch {
    if (timeout.aborted) return NextResponse.json({ error: "ai_analysis_timeout" }, { status: 504, headers });
    if (request.signal.aborted) return NextResponse.json({ error: "Request cancelled" }, { status: 499, headers });
    return NextResponse.json({ error: "ai_unavailable" }, { status: 502, headers });
  }
}

/** The signed-in user's saved runs for this company. */
export async function GET(request: NextRequest, { params }: { params: { symbol: string } }) {
  if (!/^[A-Za-z0-9][A-Za-z0-9.\-]{0,11}$/.test(params.symbol))
    return NextResponse.json({ error: "Invalid valuation request" }, { status: 400, headers });
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const response = await fetch(`${API}/api/v1/valuation/${encodeURIComponent(params.symbol)}/ai-runs`, {
      cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: typeof data.detail === "string" ? data.detail : "ai_runs_unavailable" }, { status: response.status, headers });
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json({ error: "ai_runs_unavailable" }, { status: 502, headers });
  }
}
