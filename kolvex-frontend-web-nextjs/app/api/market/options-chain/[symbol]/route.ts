import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const API = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";
const headers = { "Cache-Control": "private, no-store" };

/** Alpaca's free options feed is licensed per signed-in user, so this proxy forwards the session and never caches. */
export async function GET(request: NextRequest, { params }: { params: { symbol: string } }) {
  const symbol = params.symbol.toUpperCase();
  const expiration = request.nextUrl.searchParams.get("expiration");
  if (!/^[A-Z][A-Z.]{0,9}$/.test(symbol) || (expiration && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)))
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const query = expiration ? `?expiration=${expiration}` : "";
    const upstream = await fetch(`${API}/api/v1/market/options-chain/${encodeURIComponent(symbol)}${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await upstream.json().catch(() => ({}));
    if (upstream.ok) {
      if (data?.symbol !== symbol || !Array.isArray(data.contracts)) throw new Error("Invalid options response");
      return NextResponse.json(data, { headers });
    }
    // FastAPI's bare "Not Found" means a backend without this route, not a ticker without options.
    const error = upstream.status === 404 && typeof data?.detail === "string" && data.detail !== "Not Found" ? "no_options"
      : data?.detail === "options_data_not_configured" ? "not_configured"
      : upstream.status === 429 ? "rate_limited"
      : upstream.status === 401 ? "unauthorized" : "unavailable";
    return NextResponse.json({ error }, { status: upstream.status === 404 && error !== "no_options" ? 503 : upstream.status, headers });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
}
