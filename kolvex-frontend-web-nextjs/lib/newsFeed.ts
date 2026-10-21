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
