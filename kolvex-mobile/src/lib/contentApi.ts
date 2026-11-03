import { apiRequest } from "./http";
import { demoMode } from "./config";
import type {
  BriefSummary,
  Conversation,
  DailyBrief,
  Holdings,
  NewsFeed,
  NewsItem,
  Profile,
  TradingAnalysis,
  TradingAnalysisListResponse,
  XFeed,
} from "./contentTypes";
import type { Dashboard } from "./models";
const encoded = encodeURIComponent;
const requireList = <T>(list: T[] | undefined): T[] => {
  if (!Array.isArray(list)) throw new Error("列表数据格式无效，请重试。");
  return list;
};
export async function reports(
  signal: AbortSignal,
  user: string,
  offset = 0,
  ticker = "",
  limit = 20,
) {
  const result = await apiRequest<TradingAnalysisListResponse>(
    `/trading-analysis/published/list?limit=${limit}&offset=${offset}${ticker ? `&ticker=${encoded(ticker)}` : ""}`,
    { signal, authenticated: true, expectedUser: user },
  );
  requireList(result.items);
  return result;
}
export const report = (id: string, user: string, signal: AbortSignal) =>
  apiRequest<TradingAnalysis>(`/trading-analysis/published/${encoded(id)}`, {
    signal,
    authenticated: true,
    expectedUser: user,
  });
export async function briefs(
  signal: AbortSignal,
  user: string,
  page: number,
  type: string,
  date = "",
) {
  const result = await apiRequest<{ items: BriefSummary[]; total: number }>(
    `/briefs?page=${page}${type === "all" ? "" : `&type=${encoded(type)}`}${date ? `&date=${encoded(date)}` : ""}`,
    { signal, authenticated: true, expectedUser: user },
  );
  requireList(result.items);
  return result;
}
export const brief = (id: string, user: string, signal: AbortSignal) =>
  apiRequest<{ payload: DailyBrief; revision: string }>(
    `/briefs/${encoded(id)}`,
    { signal, authenticated: true, expectedUser: user },
  );
export async function news(signal: AbortSignal, symbol?: string) {
  if (demoMode)
    return {
      articles: [],
      source: "",
      delivery: "delayed",
      fetched_at: "",
      stale: false,
    } as NewsFeed;
  if (symbol) {
    const data = await apiRequest<{ news: NewsItem[] }>(
      `/market/news/${encoded(symbol)}`,
      { signal },
    );
    return {
      articles: requireList(data.news),
      source: "股票新闻",
      delivery: "delayed",
      fetched_at: "",
      stale: false,
    } as NewsFeed;
  }
  const data = await apiRequest<NewsFeed>("/news/feed", { signal });
  requireList(data.articles);
  return data;
}
export async function xPosts(signal: AbortSignal, offset: number, ticker = "") {
  if (demoMode) return { posts: [], total: 0, limit: 20, offset } as XFeed;
  const data = await apiRequest<XFeed>(
    `/x-content/posts?limit=20&offset=${offset}${ticker ? `&ticker=${encoded(ticker)}` : ""}`,
    { signal },
  );
  requireList(data.posts);
  return data;
}
export async function youtube(
  signal: AbortSignal,
  offset: number,
  sentiment: string,
  ticker = "",
) {
  if (demoMode)
    return {
      latest: [],
      pagination: { total: 0, has_more: false, offset, limit: 20 },
    } as Dashboard;
  const result = await apiRequest<Dashboard>(
    `/youtube-opinions/dashboard?limit=20&offset=${offset}${sentiment === "all" ? "" : `&sentiment=${encoded(sentiment)}`}${ticker ? `&ticker=${encoded(ticker)}` : ""}`,
    { signal },
  );
  requireList(result.latest);
  return result;
}
export const holdings = (user: string, signal: AbortSignal) =>
  apiRequest<Holdings>("/portfolio/holdings", {
    signal,
    authenticated: true,
    expectedUser: user,
  });
export const profile = (user: string, signal: AbortSignal) =>
  apiRequest<Profile>("/users/me", {
    signal,
    authenticated: true,
    expectedUser: user,
  });
export const updateProfile = (
  user: string,
  fullName: string,
  signal: AbortSignal,
) =>
  apiRequest<Profile>("/users/me", {
    method: "PUT",
    body: { full_name: fullName || null },
    signal,
    authenticated: true,
    expectedUser: user,
  });
export const conversations = (
  user: string,
  signal: AbortSignal,
  page: number,
) =>
  apiRequest<{ conversations: Conversation[]; total: number }>(
    "/chat/conversations?page_size=20&page=" + page,
    { signal, authenticated: true, expectedUser: user },
  );
export const conversation = (id: string, user: string, signal: AbortSignal) =>
  apiRequest<Conversation>(`/chat/conversations/${encoded(id)}`, {
    signal,
    authenticated: true,
    expectedUser: user,
  });
export const createConversation = (user: string, signal: AbortSignal) =>
  apiRequest<Conversation>("/chat/conversations", {
    method: "POST",
    body: { title: "新的研究对话" },
    signal,
    authenticated: true,
    expectedUser: user,
  });
export const stockFacts = (symbol: string, signal: AbortSignal) =>
  apiRequest<{
    symbol: string;
    name?: string;
    sector?: string;
    industry?: string;
    business_summary?: string;
    website?: string;
    employees?: number;
  }>(`/market/company/${encoded(symbol)}`, { signal });

export const deleteAllConversations = (user: string, signal: AbortSignal) =>
  apiRequest<unknown>("/chat/conversations", {
    method: "DELETE",
    signal,
    authenticated: true,
    expectedUser: user,
  });
