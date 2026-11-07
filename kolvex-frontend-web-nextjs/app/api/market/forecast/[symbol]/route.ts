import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const API = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";
const headers = { "Cache-Control": "private, max-age=600" };

/** Kronos forecasts cost model inference, so the backend only serves signed-in users. */
export async function GET(request: NextRequest, { params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase();
  const interval = request.nextUrl.searchParams.get("interval") || "1d";
  const horizon = Number(request.nextUrl.searchParams.get("horizon") || "20");
  if (!/^[A-Z][A-Z.-]{0,9}$/.test(symbol) || !["1d", "1wk"].includes(interval) || !Number.isInteger(horizon) || horizon < 5 || horizon > 60)
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const upstream = await fetch(`${API}/api/v1/market/forecast/${encodeURIComponent(symbol)}?interval=${interval}&horizon=${horizon}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(130000),
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await upstream.json().catch(() => ({}));
    if (upstream.ok) {
      if (data?.symbol !== symbol || !Array.isArray(data.points)) throw new Error("Invalid forecast response");
      return NextResponse.json(data, { headers });
    }
    const error = data?.detail === "forecast_not_configured" ? "not_configured" : upstream.status === 401 ? "unauthorized" : "unavailable";
    return NextResponse.json({ error }, { status: upstream.status === 404 ? 503 : upstream.status, headers });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
}
