import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseFearGreed, type FearGreedSnapshot } from "@/lib/fearGreed";

export const dynamic = "force-dynamic";
const TTL = 15 * 60_000;
const MAX_STALE = 24 * 60 * 60_000;
let cached: { snapshot: FearGreedSnapshot; fetchedAt: number } | null = null;
let retryAfter = 0;
let pending: Promise<void> | null = null;

async function refresh() {
  try {
    const response = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("CNN sentiment unavailable");
    const snapshot = parseFearGreed(await response.json());
    cached = { snapshot, fetchedAt: Date.now() };
  } catch {
    // Do not hammer an unavailable source or evade its access restrictions.
    retryAfter = Date.now() + 60_000;
  }
}

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  // Enable numerical redistribution only after confirming display rights for Kolvex.
  if (process.env.CNN_FEAR_GREED_DISPLAY_ENABLED !== "true") {
    return NextResponse.json({ status: "source_only" }, { headers });
  }
  if ((!cached || Date.now() - cached.fetchedAt >= TTL) && Date.now() >= retryAfter) {
    if (!pending) pending = refresh().finally(() => { pending = null; });
    await pending;
  }
  if (!cached || Date.now() - cached.fetchedAt > MAX_STALE) {
    return NextResponse.json({ error: "CNN sentiment unavailable" }, { status: 503, headers });
  }
  return NextResponse.json({ ...cached.snapshot, status: Date.now() - cached.fetchedAt >= TTL ? "stale" : "ready" }, { headers });
}
