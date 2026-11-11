// The Web's creator-buzz ranking (lib/stockDiscovery.ts creatorHeat + selectObservationSymbols):
// YouTube opinions (7d) + Reddit mentions (24h) + X posts (7d), fused by each source's place.
import { apiRequest } from "./http";
import { opinionDay } from "./opinionDates";
import { parseRedditStocks, redditRanking, type RedditStock } from "./reddit";

export type BuzzSource = "all" | "youtube" | "reddit" | "x";
export const BUZZ_SOURCES: [BuzzSource, string][] = [
  ["all", "全部来源"],
  ["youtube", "YouTube 博主"],
  ["reddit", "Reddit"],
  ["x", "X"],
];
export interface YouTubeStockHeat {
  ticker: string;
  company_name?: string;
  discussion_heat?: {
    recent: number;
    previous: number;
    from: string;
    to: string;
  };
  latest_evidence?: {
    video_published_at?: string | null;
    opinion_date?: string | null;
  };
}
export interface XTickerHeat {
  ticker: string;
  posts: number;
  previous: number;
  authors: number;
  latest: string | null;
}
export interface BuzzData {
  youtube: YouTubeStockHeat[] | null;
  reddit: RedditStock[] | null;
  x: XTickerHeat[] | null;
}
const validTicker = (ticker: string) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker);
const FUSION_K = 10;

/** Each source loads on its own, so one failing source never hides the others. */
export async function loadBuzz(signal: AbortSignal): Promise<BuzzData> {
  const [youtube, reddit, x] = await Promise.allSettled([
    apiRequest<{ stocks?: YouTubeStockHeat[] }>(
      "/youtube-opinions/dashboard?limit=20",
      { signal, timeout: 40_000 },
    ),
    redditRanking("all-stocks", signal),
    apiRequest<{ tickers?: XTickerHeat[] }>("/x-content/tickers", {
      signal,
      timeout: 20_000,
    }),
  ]);
  if ([youtube, reddit, x].every((r) => r.status === "rejected"))
    throw new Error("博主线索暂不可用。");
  return {
    youtube:
      youtube.status === "fulfilled" ? (youtube.value.stocks ?? []) : null,
    reddit:
      reddit.status === "fulfilled" ? parseRedditStocks(reddit.value) : null,
    x:
      x.status === "fulfilled"
        ? (x.value.tickers ?? []).filter(
            (row) => validTicker(row.ticker) && row.posts > 0,
          )
        : null,
  };
}

function latestOpinion(stock: YouTubeStockHeat | undefined, now: number) {
  const source =
    stock?.latest_evidence?.video_published_at ||
    stock?.latest_evidence?.opinion_date;
  if (!source) return null;
  const day = opinionDay(source);
  const timestamp = Date.parse(
    source.length === 10 ? `${source}T12:00:00Z` : source,
  );
  if (
    !day ||
    !Number.isFinite(timestamp) ||
    day > opinionDay(new Date(now).toISOString()) ||
    (source.length > 10 && timestamp > now)
  )
    return null;
  return source;
}
function recentCount(stock: YouTubeStockHeat, now: number) {
  const heat = stock.discussion_heat;
  // A cached seven-day aggregate must describe the current New York calendar day.
  if (
    !heat ||
    heat.to !== opinionDay(new Date(now).toISOString()) ||
    !Number.isSafeInteger(heat.recent) ||
    heat.recent < 0
  )
    return null;
  return heat.recent;
}

/** Symbols for the creator-buzz list, sorted by fused heat or by latest dated opinion. */
export function buzzSymbols(
  data: BuzzData,
  source: BuzzSource,
  sort: "heat" | "latest",
  now = Date.now(),
): string[] {
  const stocks = data.youtube ?? [];
  const coverage = new Map(stocks.map((stock) => [stock.ticker, stock]));
  const youtube = stocks
    .filter(
      (stock) =>
        validTicker(stock.ticker) && (recentCount(stock, now) ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        (recentCount(b, now) ?? 0) - (recentCount(a, now) ?? 0) ||
        (latestOpinion(b, now) ?? "").localeCompare(
          latestOpinion(a, now) ?? "",
        ) ||
        a.ticker.localeCompare(b.ticker),
    )
    .map((stock) => stock.ticker);
  const reddit = (data.reddit ?? [])
    .filter((stock) => stock.mentions > 0 && validTicker(stock.ticker))
    .sort((a, b) => b.mentions - a.mentions || a.rank - b.rank)
    .map((stock) => stock.ticker);
  const x = [...(data.x ?? [])]
    .sort(
      (a, b) =>
        b.posts - a.posts ||
        b.authors - a.authors ||
        a.ticker.localeCompare(b.ticker),
    )
    .map((stock) => stock.ticker);
  const rank = (list: string[]) =>
    new Map(list.map((ticker, index) => [ticker, index]));
  const heat = { youtube: rank(youtube), reddit: rank(reddit), x: rank(x) };
  const sources =
    source === "all" ? [heat.youtube, heat.reddit, heat.x] : [heat[source]];
  const xLatest = new Map(
    (data.x ?? []).map((stock) => [stock.ticker, stock.latest]),
  );
  const latest = (symbol: string) => {
    const dates = [
      source !== "x" ? latestOpinion(coverage.get(symbol), now) : null,
      source !== "youtube" ? xLatest.get(symbol) : null,
    ].filter(
      (value): value is string => Boolean(value) && Date.parse(value!) <= now,
    );
    return dates.length
      ? Math.max(
          ...dates.map((value) =>
            Date.parse(value.length === 10 ? `${value}T12:00:00Z` : value),
          ),
        )
      : null;
  };
  const fused = (symbol: string) =>
    sources.reduce(
      (score, ranks) =>
        score + (ranks.has(symbol) ? 1 / (FUSION_K + ranks.get(symbol)!) : 0),
      0,
    );
  if (sort === "latest")
    return [
      ...new Set([...stocks.map((stock) => stock.ticker), ...xLatest.keys()]),
    ]
      .filter((symbol) => validTicker(symbol) && latest(symbol) !== null)
      .sort((a, b) => latest(b)! - latest(a)! || a.localeCompare(b));
  return [...new Set(sources.flatMap((ranks) => [...ranks.keys()]))].sort(
    (a, b) => fused(b) - fused(a) || a.localeCompare(b),
  );
}
