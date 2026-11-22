import "server-only";
import { cache } from "react";
import type { TradingAnalysis, TradingAnalysisListResponse } from "@/lib/tradingAnalysisApi";
import type { YouTubeOpinionDashboard } from "@/lib/youtubeOpinionsApi";
import { validReportId, validTicker } from "@/lib/publicRoutes";
import { BACKEND_API_URL } from "@/lib/config/backend";
import type { RedditCommunity, RedditRanking } from "@/lib/redditOpinions";
import type { XCreator } from "@/lib/xContentApi";
import type { XhsDay, XhsDaySummary } from "@/lib/xhsSentiment";

/** Cache tag on every public read; publishing changes call `revalidateTag` with it. */
export const PUBLIC_CONTENT_TAG = "public-content";
/** Public reading data may be up to this old unless a publish change revalidates it sooner. */
export const PUBLIC_CONTENT_REVALIDATE_SECONDS = 600;

/** Public endpoints only. Never attach a session, cookie or service credential. */
async function readPublic<T>(path: string): Promise<T | null> {
  const response = await fetch(`${BACKEND_API_URL}/api/v1/${path}`, {
    next: { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS, tags: [PUBLIC_CONTENT_TAG] },
    credentials: "omit",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Public content is temporarily unavailable");
  return response.json();
}

export const getPublicOpinions = cache(async (ticker = "", offset = 0, limit = 20) => {
  if (ticker && !validTicker(ticker)) return null;
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (ticker) query.set("ticker", ticker);
  const data = await readPublic<YouTubeOpinionDashboard>(`youtube-opinions/dashboard?${query}`);
  if (
    !data ||
    !Array.isArray(data.creators) ||
    !Array.isArray(data.stocks) ||
    !Array.isArray(data.latest)
  ) {
    throw new Error("Public opinions are temporarily unavailable");
  }
  return data;
});

export const getPublicResearchList = cache(async (offset = 0, limit = 20, ticker = "") => {
  const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (ticker) {
    if (!validTicker(ticker))
      return { items: [], total: 0, offset, limit } as TradingAnalysisListResponse;
    query.set("ticker", ticker);
  }
  const data = await readPublic<TradingAnalysisListResponse>(
    `trading-analysis/public/list?${query}`,
  );
  if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0) {
    throw new Error("Published research is temporarily unavailable");
  }
  return { ...data, items: data.items.filter(isPublished) };
});

function isPublished(data: TradingAnalysis) {
  return (
    data.is_published === true &&
    data.status === "completed" &&
    validReportId(data.id) &&
    validTicker(data.ticker)
  );
}

export const getPublicResearch = cache(async (id: string) => {
  if (!validReportId(id)) return null;
  const data = await readPublic<TradingAnalysis>(
    `trading-analysis/public/${encodeURIComponent(id)}`,
  );
  // Recheck publication on every (re)validated read so unpublishing revokes the public page.
  return data && isPublished(data) ? data : null;
});

export type PublicCongressTrade = {
  id: number;
  member_name: string;
  chamber: "house" | "senate" | null;
  ticker: string | null;
  asset_name: string | null;
  trade_date: string;
  filed_date: string;
  direction: "buy" | "sell" | "exchange" | "other";
  transaction_type: string;
  amount_range: string | null;
  source_url: string | null;
};

/** Newest public congressional disclosures. `synced: false` means the importer has never run. */
export const getPublicCongressTrades = cache(async () => {
  const data = await readPublic<{ trades: PublicCongressTrade[]; synced: boolean }>(
    "congress/public/trades?limit=100",
  );
  if (!data || !Array.isArray(data.trades)) throw new Error("Congress trades are unavailable");
  return data;
});

export type PublicXSummary = {
  username: string;
  content: string;
  sources: { id: string; url: string; published_at: string }[];
  coverage_start: string;
  coverage_end: string;
};

/** Saved AI summaries of tracked X creators, each with all of its original posts. */
export const getPublicXSummaries = cache(async () => {
  const [summaries, creators] = await Promise.all([
    readPublic<{ generated_at: string; summaries: PublicXSummary[] }>("x-content/summaries"),
    readPublic<{ creators?: XCreator[] } | XCreator[]>("x-content/creators?limit=200"),
  ]);
  if (!summaries || !Array.isArray(summaries.summaries)) {
    throw new Error("X summaries are unavailable");
  }
  const list = Array.isArray(creators) ? creators : (creators?.creators ?? []);
  return { ...summaries, creators: list };
});

export const getPublicReddit = cache(async (community: RedditCommunity) => {
  const data = await readPublic<RedditRanking>(`reddit-opinions?community=${community}`);
  if (!data || !Array.isArray(data.results)) throw new Error("Reddit ranking is unavailable");
  return data;
});

export const getPublicXhsDays = cache(async () => {
  const data = await readPublic<{ days: XhsDaySummary[] }>("xhs-sentiment/days?limit=30");
  if (!data || !Array.isArray(data.days)) throw new Error("Xiaohongshu sentiment is unavailable");
  return data.days;
});

export const getPublicXhsDay = cache(async (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  // Reject impossible dates (2026-13-45) before they reach the backend as a 422.
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return null;
  return readPublic<XhsDay>(`xhs-sentiment/days/${date}`);
});
