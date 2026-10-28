import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { parseRedditStocks, type RedditRanking } from "@/lib/redditOpinions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache the timestamp with the rows so it continues to describe the actual fetch.
const getRanking = unstable_cache(async (): Promise<RedditRanking> => {
  const response = await fetch("https://apewisdom.io/api/v1.0/filter/all-stocks/page/1", {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`ApeWisdom returned ${response.status}`);
  return { results: parseRedditStocks(await response.json()), fetchedAt: new Date().toISOString() };
}, ["reddit-stock-ranking-v1"], { revalidate: 300 });

export async function GET() {
  try {
    return NextResponse.json(await getRanking(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Reddit ranking unavailable:", error);
    return NextResponse.json({ error: "Reddit ranking unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
