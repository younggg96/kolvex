import type { RedditStock } from "./redditOpinions";

/** X cashtag heat, counted by post publication date over the last seven days. */
export interface XTickerHeat {
  ticker: string;
  posts: number;
  previous: number;
  authors: number;
  latest: string | null;
}
export interface XTickerRanking {
  tickers: XTickerHeat[];
  days: number;
  from: string;
  to: string;
}

/** Social sources joined to creator coverage; an absent source means it is unavailable. */
export interface SocialBuzz {
  reddit?: readonly RedditStock[];
  x?: readonly XTickerHeat[];
}

export const STOCK_SOURCES = [
  { key: "all", en: "All sources", zh: "全部来源" },
  { key: "youtube", en: "YouTube creators", zh: "YouTube 博主" },
  { key: "reddit", en: "Reddit", zh: "Reddit" },
  { key: "x", en: "X", zh: "X" },
] as const;
export type StockSource = (typeof STOCK_SOURCES)[number]["key"];

const safeCount = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function parseXTickerRanking(payload: unknown): XTickerRanking {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as XTickerRanking).tickers)) throw new Error("Invalid X ticker ranking");
  const value = payload as XTickerRanking;
  const seen = new Set<string>();
  const tickers = value.tickers.filter(row => {
    if (!row || typeof row.ticker !== "string" || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(row.ticker) || seen.has(row.ticker)) return false;
    if (!safeCount(row.posts) || row.posts < 1 || !safeCount(row.previous) || !safeCount(row.authors)) return false;
    seen.add(row.ticker);
    return true;
  }).map(row => ({ ticker: row.ticker, posts: row.posts, previous: row.previous, authors: row.authors,
    latest: typeof row.latest === "string" && Number.isFinite(Date.parse(row.latest)) ? row.latest : null }));
  return { tickers, days: value.days, from: value.from, to: value.to };
}
