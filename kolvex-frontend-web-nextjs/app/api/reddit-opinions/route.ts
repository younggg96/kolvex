import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  attachRedditTrends,
  isRedditCommunity,
  parseRedditStocks,
  parseRedditTrends,
  type RedditCommunity,
  type RedditRanking,
} from "@/lib/redditOpinions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Optional: the trend sparkline lives only in the HTML ranking. Its failure never blocks the list. */
async function getTrends(community: RedditCommunity): Promise<Map<string, number[]> | null> {
  try {
    const response = await fetch(`https://apewisdom.io/${community}/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "text/html" },
    });
    if (!response.ok) return null;
    const trends = parseRedditTrends(await response.text());
    return trends.size > 0 ? trends : null;
  } catch {
    return null;
  }
}

// Cache the timestamp with the rows so it continues to describe the actual fetch.
const getRanking = unstable_cache(
  async (community: RedditCommunity): Promise<RedditRanking> => {
    const trends = getTrends(community);
    const response = await fetch(`https://apewisdom.io/api/v1.0/filter/${community}/page/1`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`ApeWisdom returned ${response.status}`);
    const results = parseRedditStocks(await response.json());
    return {
      results: attachRedditTrends(results, await trends),
      fetchedAt: new Date().toISOString(),
      community,
    };
  },
  ["reddit-stock-ranking-v3"],
  { revalidate: 300 },
);

export async function GET(request: Request) {
  const community = new URL(request.url).searchParams.get("community") ?? "all-stocks";
  if (!isRedditCommunity(community)) {
    return NextResponse.json(
      { error: "Unsupported Reddit community" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    return NextResponse.json(await getRanking(community), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Reddit ranking unavailable:", error);
    return NextResponse.json(
      { error: "Reddit ranking unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
