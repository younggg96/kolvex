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
