export interface FeedArticle {
  id: string;
  title: string;
  publisher: string | null;
  link: string;
  publish_time: number | null;
  symbols: string[];
}
export interface FeedResponse {
  articles: FeedArticle[];
  fetched_at: string;
  source: string;
  delivery: "delayed";
  stale: boolean;
}
export const NEWS_CATEGORIES = [
  { id: "all", en: "All headlines", zh: "全部快讯" },
  { id: "equities", en: "Equities", zh: "股票" },
  { id: "macro", en: "Macro", zh: "宏观经济" },
  { id: "bonds", en: "Bonds", zh: "债券" },
  { id: "forex", en: "Forex", zh: "外汇" },
  { id: "energy", en: "Energy & commodities", zh: "能源与商品" },
  { id: "crypto", en: "Crypto", zh: "加密资产" },
] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number]["id"];
const RULES: Record<Exclude<NewsCategory, "all">, RegExp> = {
  equities: /\b(stock|stocks|equities|earnings|revenue|shares|ipo|nasdaq|s&p|buyback|dividend)\b/i,
  macro: /\b(fed|fomc|ecb|boe|boj|rba|gdp|cpi|ppi|pce|pmi|inflation|unemployment|payrolls?|employment|retail sales|interest.rate|central.bank)\b/i,
  bonds: /\b(bonds?|treasur(?:y|ies)|gilt|yields?|debt|auction|tips)\b/i,
  forex: /\b(forex|currency|currencies|dollar|yen|euro|sterling|yuan|usd|eur|gbp|jpy|cny|cad|aud|chf)\b/i,
  energy: /\b(oil|crude|brent|wti|opec|gas|energy|gold|silver|copper|hormuz|tanker|refiner[yi])\b/i,
  crypto: /\b(bitcoin|ethereum|crypto|btc|eth|stablecoin|blockchain)\b/i,
};
export function articleCategories(article: FeedArticle): NewsCategory[] {
  return (Object.keys(RULES) as Exclude<NewsCategory, "all">[]).filter(key =>
    (key === "equities" && article.symbols.some(s => !["BTC", "ETH"].includes(s))) || RULES[key].test(article.title));
}
/** Local keyword screen, never presented as FinancialJuice's Market Moving label. */
export function isFocusHeadline(article: FeedArticle) {
  return /\b(cpi|pce|nonfarm|payrolls?|rate decision|rate statement|fomc|emergency|trading halt|interest.rate (?:cut|hike)|earnings)\b/i.test(article.title);
}
export function filterNews(articles: FeedArticle[], category: NewsCategory, query: string, focus: boolean, savedOnly: boolean, saved: string[]) {
  const terms = query.trim().toLowerCase();
  const ids = new Set(saved);
  return articles.filter(a => (category === "all" || articleCategories(a).includes(category)) &&
    (!focus || isFocusHeadline(a)) && (!savedOnly || ids.has(a.id)) &&
    `${a.title} ${a.publisher ?? ""} ${a.symbols.join(" ")}`.toLowerCase().includes(terms));
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
  const updates = new Map(incoming.map(a => [a.id, a]));
  return { ...state, articles: state.articles.map(a => updates.get(a.id) ?? a), pending: mergeNews(state.pending, incoming.filter(a => !visible.has(a.id))).slice(0, 300) };
}
export function revealNews(state: FeedState): FeedState {
  return { ...state, articles: mergeNews(state.articles, state.pending).slice(0, 300), pending: [] };
}
