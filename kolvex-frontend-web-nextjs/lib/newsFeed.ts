export interface FeedArticle {
  id: string;
  title: string;
  publisher: string | null;
  link: string;
  publish_time: number | null;
  symbols: string[];
}

export const NEWS_PRESETS = [
  { id: "market", en: "Market ETFs", zh: "大盘 ETF", symbols: ["SPY", "QQQ", "DIA"] },
  { id: "tech", en: "Technology", zh: "科技", symbols: ["AAPL", "MSFT", "NVDA", "GOOGL"] },
  { id: "consumer", en: "Consumer", zh: "消费", symbols: ["AMZN", "TSLA", "WMT", "COST"] },
  { id: "crypto", en: "Crypto", zh: "加密资产", symbols: ["BTC-USD", "ETH-USD"] },
] as const;

export function parseNewsSymbols(value: string | null): string[] | null {
  const symbols = Array.from(new Set((value ?? "SPY,QQQ,DIA").split(",").map(s => s.trim().toUpperCase())));
  return symbols.length > 0 && symbols.length <= 4 && symbols.every(s => /^[A-Z0-9.^-]{1,12}$/.test(s)) ? symbols : null;
}

/** Validate provider data and use canonical URLs to deduplicate across tickers. */
export function normalizeNews(value: unknown, symbol: string): FeedArticle[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item.title !== "string" || !item.title.trim() || typeof item.link !== "string") return [];
    try {
      const url = new URL(item.link);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return [];
      url.hash = "";
      for (const key of Array.from(url.searchParams.keys())) {
        if (key.startsWith("utm_") || key === "guccounter") url.searchParams.delete(key);
      }
      return [{
        id: url.href,
        title: item.title.trim(),
        publisher: typeof item.publisher === "string" ? item.publisher : null,
        link: url.href,
        publish_time: typeof item.publish_time === "number" && Number.isFinite(item.publish_time) && item.publish_time > 0 && item.publish_time <= 8640000000000 ? item.publish_time : null,
        symbols: [symbol],
      }];
    } catch { return []; }
  });
}

export function mergeNews(...groups: FeedArticle[][]): FeedArticle[] {
  const articles = new Map<string, FeedArticle>();
  for (const article of groups.flat()) {
    const previous = articles.get(article.id);
    articles.set(article.id, { ...article, symbols: Array.from(new Set([...(previous?.symbols ?? []), ...article.symbols])).sort() });
  }
  return Array.from(articles.values()).sort((a, b) => (b.publish_time ?? 0) - (a.publish_time ?? 0) || a.id.localeCompare(b.id));
}

export interface FeedState { articles: FeedArticle[]; pending: FeedArticle[]; initialized: boolean }
export const EMPTY_FEED: FeedState = { articles: [], pending: [], initialized: false };
export function receiveNews(state: FeedState, incoming: FeedArticle[]): FeedState {
  if (!state.initialized) return { articles: mergeNews(incoming), pending: [], initialized: true };
  const visible = new Set(state.articles.map(a => a.id));
  return { ...state, pending: mergeNews(state.pending, incoming.filter(a => !visible.has(a.id))).slice(0, 300) };
}
export function revealNews(state: FeedState): FeedState {
  return { ...state, articles: mergeNews(state.articles, state.pending).slice(0, 300), pending: [] };
}
