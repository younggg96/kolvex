export interface RedditStock {
  rank: number;
  ticker: string;
  name: string;
  mentions: number;
  upvotes: number;
  previousRank: number | null;
  previousMentions: number | null;
}

export interface RedditRanking {
  results: RedditStock[];
  fetchedAt: string;
  community: RedditCommunity;
}

export const REDDIT_COMMUNITIES = ["all-stocks", "wallstreetbets", "stocks", "investing", "options"] as const;
export type RedditCommunity = typeof REDDIT_COMMUNITIES[number];
export type RedditSort = "mentions" | "mentionChange" | "rankChange" | "upvotes";
export const REDDIT_WATCHLIST_KEY = "kolvex:reddit-watchlist";

export function isRedditCommunity(value: string): value is RedditCommunity {
  return REDDIT_COMMUNITIES.some(community => community === value);
}

/** Invalid browser storage must not break reading the ranking. */
export function parseRedditWatchlist(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value)
      ? [...new Set(value.filter((ticker): ticker is string => typeof ticker === "string" && /^[A-Z0-9.^-]{1,20}$/.test(ticker)))].slice(0, 1000)
      : [];
  } catch {
    return [];
  }
}

/** Sort a copy; absent comparison values follow every numeric value, including declines. */
export function selectRedditStocks(stocks: RedditStock[], query: string, sort: RedditSort, watchlist?: readonly string[]): RedditStock[] {
  const search = query.trim().toLowerCase().replace(/^\$/, "");
  const metric = (stock: RedditStock) => sort === "mentionChange" ? mentionChange(stock)
    : sort === "rankChange" ? (stock.previousRank === null ? null : stock.previousRank - stock.rank)
    : stock[sort];
  return stocks.filter(stock => `${stock.ticker} ${stock.name}`.toLowerCase().includes(search)
    && (!watchlist || watchlist.includes(stock.ticker))).sort((a, b) => {
    const left = metric(a);
    const right = metric(b);
    if (left === null) return right === null ? a.rank - b.rank : 1;
    if (right === null) return -1;
    return right - left || a.rank - b.rank;
  });
}

function nonnegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

/** Provider counts may be strings; null history must never become zero. */
export function parseRedditStocks(payload: unknown): RedditStock[] {
  if (!payload || typeof payload !== "object" || !("results" in payload) || !Array.isArray(payload.results)) {
    throw new Error("Invalid ApeWisdom response");
  }
  const seen = new Set<string>();
  return payload.results.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Invalid ranking row");
    const value = row as Record<string, unknown>;
    const rank = nonnegativeInteger(value.rank);
    const mentions = nonnegativeInteger(value.mentions);
    const upvotes = (typeof value.upvotes === "number" || (typeof value.upvotes === "string" && value.upvotes.trim()))
      && Number.isSafeInteger(Number(value.upvotes)) ? Number(value.upvotes) : null;
    if (!rank || mentions === null || upvotes === null || typeof value.ticker !== "string" ||
      !/^[A-Z0-9.^-]{1,20}$/.test(value.ticker) || typeof value.name !== "string" || !value.name.trim() || seen.has(value.ticker)) {
      throw new Error("Invalid ranking values");
    }
    seen.add(value.ticker);
    return {
      rank, ticker: value.ticker,
      name: value.name.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
      mentions, upvotes,
      previousRank: nonnegativeInteger(value.rank_24h_ago) || null,
      previousMentions: nonnegativeInteger(value.mentions_24h_ago),
    };
  }).sort((a, b) => a.rank - b.rank);
}

export function mentionChange(stock: RedditStock): number | null {
  return stock.previousMentions === null || stock.previousMentions === 0
    ? null
    : ((stock.mentions - stock.previousMentions) / stock.previousMentions) * 100;
}
