import "server-only";
import { cache } from "react";
import type { TradingAnalysis, TradingAnalysisListResponse } from "@/lib/tradingAnalysisApi";
import type { YouTubeOpinionDashboard } from "@/lib/youtubeOpinionsApi";
import { validReportId, validTicker } from "@/lib/publicRoutes";

/** Public endpoints only. Never attach a session, cookie or service credential. */
async function readPublic<T>(path: string): Promise<T | null> {
  const backend = (process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080").replace(/\/$/, "");
  const response = await fetch(`${backend}/api/v1/${path}`, {
    cache: "no-store",
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
  if (!data || !Array.isArray(data.creators) || !Array.isArray(data.stocks) || !Array.isArray(data.latest)) {
    throw new Error("Public opinions are temporarily unavailable");
  }
  return data;
});

export const getPublicResearchList = cache(async (offset = 0, limit = 20, ticker = "") => {
  const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (ticker) {
    if (!validTicker(ticker)) return { items: [], total: 0, offset, limit } as TradingAnalysisListResponse;
    query.set("ticker", ticker);
  }
  const data = await readPublic<TradingAnalysisListResponse>(`trading-analysis/published/list?${query}`);
  if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0) {
    throw new Error("Published research is temporarily unavailable");
  }
  return { ...data, items: data.items.filter(isPublished) };
});

function isPublished(data: TradingAnalysis) {
  return data.is_published === true && data.status === "completed" && validReportId(data.id) && validTicker(data.ticker);
}

export const getPublicResearch = cache(async (id: string) => {
  if (!validReportId(id)) return null;
  const data = await readPublic<TradingAnalysis>(`trading-analysis/published/${encodeURIComponent(id)}`);
  // Recheck publication on every read so unpublishing revokes the public page.
  return data && isPublished(data) ? data : null;
});
