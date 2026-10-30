import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeWatchlistTicker } from "@/lib/watchlist";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

async function handle(request: NextRequest, method: "GET" | "PUT" | "DELETE" | "POST") {
  try {
    const db = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return json({ error: "Sign in to sync your watchlist" }, 401);
    // Do not execute a request queued under an account whose cookies have changed.
    if (request.headers.get("X-Watchlist-User") !== user.id) return json({ error: "Account changed" }, 409);
    if (method === "GET") {
      const items: { ticker: string; created_at: string }[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db.from("user_watchlist").select("ticker,created_at")
          .eq("user_id", user.id).order("created_at").order("ticker").range(offset, offset + 999);
        if (error) return json({ error: "Watchlist unavailable" }, 503);
        items.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return json({ userId: user.id, items });
    }
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request" }, 400);
    if (method === "POST") {
      if (typeof body.sourceId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.sourceId) || !Array.isArray(body.tickers) || body.tickers.length > 1000) return json({ error: "Invalid tickers" }, 400);
      const tickers = body.tickers.map((value: unknown) => typeof value === "string" ? normalizeWatchlistTicker(value) : null);
      if (tickers.some((value: string | null) => !value)) return json({ error: "Invalid ticker" }, 400);
      const { error } = await db.rpc("import_user_watchlist", { tickers: [...new Set(tickers)], source_id: body.sourceId });
      return error ? json({ error: "Watchlist import failed" }, 503) : json({ userId: user.id, ok: true });
    }
    const ticker = typeof body.ticker === "string" ? normalizeWatchlistTicker(body.ticker) : null;
    if (!ticker) return json({ error: "Invalid ticker" }, 400);
    const { error } = method === "PUT"
      ? await db.from("user_watchlist").upsert({ user_id: user.id, ticker }, { onConflict: "user_id,ticker", ignoreDuplicates: true })
      : await db.from("user_watchlist").delete().eq("user_id", user.id).eq("ticker", ticker);
    return error ? json({ error: "Watchlist could not be saved" }, 503) : json({ userId: user.id, ok: true, ticker });
  } catch {
    return json({ error: "Watchlist service unavailable" }, 503);
  }
}
export function GET(request: NextRequest) { return handle(request, "GET"); }
export function PUT(request: NextRequest) { return handle(request, "PUT"); }
export function DELETE(request: NextRequest) { return handle(request, "DELETE"); }
export function POST(request: NextRequest) { return handle(request, "POST"); }
