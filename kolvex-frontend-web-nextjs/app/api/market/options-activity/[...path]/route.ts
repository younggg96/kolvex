import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const API = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";
const headers = { "Cache-Control": "private, no-store" };
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Only the three read endpoints are forwarded: runs, runs/latest, runs/{uuid}. */
function upstreamPath(path: string[], date: string | null): string | null {
  if (path[0] !== "runs" || path.length > 2) return null;
  if (path.length === 1) return date === null || DATE.test(date) ? `runs${date ? `?date=${date}` : ""}` : null;
  return path[1] === "latest" || RUN_ID.test(path[1]) ? `runs/${path[1]}` : null;
}

/** Report data comes from Alpaca's free feed, licensed per signed-in user: forward the session, never cache. */
export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  const target = upstreamPath(params.path, request.nextUrl.searchParams.get("date"));
  if (!target) return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const upstream = await fetch(`${API}/api/v1/market/options-activity/${target}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await upstream.json().catch(() => ({}));
    if (upstream.ok) return NextResponse.json(data, { headers });
    const error = upstream.status === 404 && data?.detail === "no_runs" ? "no_runs"
      : upstream.status === 401 ? "unauthorized" : "unavailable";
    return NextResponse.json({ error }, { status: error === "unavailable" ? 503 : upstream.status, headers });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
}
