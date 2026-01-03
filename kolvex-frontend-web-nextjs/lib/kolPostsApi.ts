/**
 * KOL Posts API
 * 获取 KOL 帖子数据
 * 支持多平台统一数据结构 (Twitter, Xiaohongshu, Reddit, YouTube)
 */

// ============================================================
// 平台类型
// ============================================================

export type Platform = "twitter" | "xiaohongshu" | "reddit" | "youtube";

// ============================================================
// 类型定义
// ============================================================

export interface MediaItem {
  type: "photo" | "video" | "gif" | "card";
  url: string | null;
  poster?: string | null;
}

// ========== AI 分析类型 ==========

export interface SentimentAnalysis {
  value: "bullish" | "bearish" | "neutral" | string | null;
  confidence: number | null;
  reasoning: string | null;
}

export interface TradingSignal {
  action: "buy" | "sell" | "hold" | null;
  tickers: string[];
  confidence: number | null;
  reasoning: string | null;
}

export interface IsStockRelated {
  is_related: boolean;
  confidence: number | null;
  reason: string | null;
}

export interface KOLPost {
  id: number;
  // === 平台信息 ===
  platform: Platform;
  platform_post_id: string | null;
  // === 作者信息 ===
  username: string;
  display_name: string | null;
  kol_description: string | null;
  avatar_url: string | null;
  author_platform_id: string | null;
  // === 内容 ===
  title: string | null; // 小红书帖子标题
  content: string; // 帖子内容
  post_type: string; // post, repost, note, video
  created_at: string | null;
  permalink: string | null;
  // === 媒体 ===
  cover_url: string | null; // 小红书封面图
  media_urls: MediaItem[] | null;
  video_url: string | null;
  // === 转发信息 ===
  is_repost: boolean;
  original_author: string | null;
  // === 互动数据 ===
  like_count: number;
  repost_count: number; // 转发数
  reply_count: number;
  bookmark_count: number;
  views_count: number;
  collect_count: number; // 小红书收藏数
  share_count: number; // 小红书分享数
  // === 标签 ===
  tags: string[];
  search_keyword: string | null;
  // === 元数据 ===
  scraped_at: string | null;

  // ========== AI 分析字段 ==========
  // 情感分析
  sentiment: SentimentAnalysis | null;
  // 股票代码
  tickers: string[];
  // AI 生成的标签
  ai_tags: string[];
  // 投资信号
  trading_signal: TradingSignal | null;
  // 摘要
  summary: string | null;
  // AI 分析元数据
  ai_analyzed_at: string | null;
  ai_model: string | null;
  // 股市相关性
  is_stock_related: IsStockRelated | null;
}

export interface KOLPostsResponse {
  posts: KOLPost[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface KOLProfile {
  id: number;
  // === 平台信息 ===
  platform: Platform;
  platform_user_id: string | null;
  // === 基础信息 ===
  username: string;
  display_name: string | null;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  profile_url: string | null;
  // === 认证信息 ===
  is_verified: boolean;
  verification_type: string | null;
  // === 互动数据 ===
  followers_count: number;
  following_count: number;
  likes_count: number;
  collected_count: number;
  // === Twitter 特有 ===
  rest_id: string | null;
  join_date: string | null;
  // === 小红书特有 ===
  red_id: string | null;
  // === 时间 ===
  created_at: string | null;
  updated_at: string | null;
}

export interface KOLProfilesResponse {
  profiles: KOLProfile[];
  total: number;
}

export interface CategoryStats {
  category: string;
  kol_count: number;
  last_scraped_at: string | null;
}

export interface StatsResponse {
  total_posts: number;
  total_kols: number;
  categories: CategoryStats[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface KOLPostsParams {
  page?: number;
  page_size?: number;
  platform?: Platform; // twitter, xiaohongshu, reddit, youtube
  username?: string;
  search?: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  stock_related?: boolean;
  ticker?: string;
}

// ============================================================
// 股票讨论类型定义
// ============================================================

export interface KOLSummary {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  is_verified: boolean;
  post_count: number;
  avg_sentiment: number | null;
  latest_post_at: string | null;
}

export interface StockPost {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string | null;
  permalink: string | null;
  media_urls: MediaItem[] | null;
  is_repost: boolean;
  original_author: string | null;
  like_count: number;
  repost_count: number;
  reply_count: number;
  bookmark_count: number;
  views_count: number;
  sentiment: SentimentAnalysis | null;
  tickers: string[];
  tags: string[];
  trading_signal: TradingSignal | null;
  summary: string | null;
  ai_tags: string[];
  ai_analyzed_at: string | null;
  ai_model: string | null;
}

export interface StockDiscussionsResponse {
  ticker: string;
  total_posts: number;
  total_kols: number;
  kols: KOLSummary[];
  posts: StockPost[];
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface StockDiscussionsParams {
  page?: number;
  page_size?: number;
  sort_by?: "created_at" | "engagement";
  sort_direction?: "asc" | "desc";
}

// ============================================================
// 新闻相关类型定义
// ============================================================

export interface NewsArticle {
  id: number | null;
  published_at: string;
  title: string;
  summary: string;
  url: string;
  tags: string[];
  tickers: string[];
  source: string;
  created_at: string | null;
}

export interface NewsListResponse {
  articles: NewsArticle[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface NewsParams {
  page?: number;
  page_size?: number;
  ticker?: string;
  tag?: string;
}

// ============================================================
// API 基础配置
// ============================================================

/**
 * 获取内部 API 基础 URL
 * 客户端使用相对路径，服务端需要完整 URL
 */
function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    // 客户端：使用相对路径
    return "";
  }
  // 服务端：需要完整 URL
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.detail || error.error || `API error: ${response.status}`
    );
  }

  return response.json();
}

// ============================================================
// API 函数
// ============================================================

/**
 * 获取 KOL 帖子列表（支持多平台）
 */
export async function getKOLPosts(
  params: KOLPostsParams = {}
): Promise<KOLPostsResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size) searchParams.set("page_size", String(params.page_size));
  if (params.platform) searchParams.set("platform", params.platform);
  if (params.username) searchParams.set("username", params.username);
  if (params.search) searchParams.set("search", params.search);
  if (params.sentiment) searchParams.set("sentiment", params.sentiment);
  if (params.stock_related !== undefined)
    searchParams.set("stock_related", String(params.stock_related));
  if (params.ticker) searchParams.set("ticker", params.ticker);

  const query = searchParams.toString();
  return fetchAPI<KOLPostsResponse>(`/kol-posts${query ? `?${query}` : ""}`);
}

export interface KOLProfilesParams {
  platform?: Platform;
  category?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

/**
 * 获取 KOL 列表（支持多平台）
 */
export async function getKOLProfiles(
  params: KOLProfilesParams | string = {}
): Promise<KOLProfilesResponse> {
  // 向后兼容：如果传入字符串，当作 category 处理
  if (typeof params === "string") {
    const query = params ? `?category=${params}` : "";
    return fetchAPI<KOLProfilesResponse>(`/kol-profiles${query}`);
  }

  const searchParams = new URLSearchParams();
  if (params.platform) searchParams.set("platform", params.platform);
  if (params.category) searchParams.set("category", params.category);
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) searchParams.set("sort_order", params.sort_order);

  const query = searchParams.toString();
  return fetchAPI<KOLProfilesResponse>(
    `/kol-profiles${query ? `?${query}` : ""}`
  );
}

/**
 * 获取统计信息
 */
export async function getKOLStats(): Promise<StatsResponse> {
  return fetchAPI<StatsResponse>("/kol-stats");
}

/**
 * 获取所有类别
 */
export async function getCategories(): Promise<{ categories: Category[] }> {
  return fetchAPI<{ categories: Category[] }>("/kol-categories");
}

/**
 * 获取特定用户的帖子（支持多平台）
 */
export async function getUserPosts(
  username: string,
  page: number = 1,
  pageSize: number = 20,
  platform?: Platform
): Promise<KOLPostsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("page_size", String(pageSize));
  if (platform) searchParams.set("platform", platform);

  return fetchAPI<KOLPostsResponse>(
    `/kol-posts/user/${encodeURIComponent(username)}?${searchParams.toString()}`
  );
}

/**
 * 获取股票相关讨论
 * @param ticker 股票代码 (如 NVDA, AAPL)
 * @param params 查询参数
 */
export async function getStockDiscussions(
  ticker: string,
  params: StockDiscussionsParams = {}
): Promise<StockDiscussionsResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size) searchParams.set("page_size", String(params.page_size));
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_direction)
    searchParams.set("sort_direction", params.sort_direction);

  const query = searchParams.toString();
  return fetchAPI<StockDiscussionsResponse>(
    `/stocks/${ticker.toUpperCase()}/discussions${query ? `?${query}` : ""}`
  );
}

/**
 * 获取股票相关新闻
 * @param params 查询参数
 */
export async function getStockNews(
  params: NewsParams = {}
): Promise<NewsListResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size) searchParams.set("page_size", String(params.page_size));
  if (params.ticker) searchParams.set("ticker", params.ticker.toUpperCase());
  if (params.tag) searchParams.set("tag", params.tag);

  const query = searchParams.toString();
  return fetchAPI<NewsListResponse>(`/news${query ? `?${query}` : ""}`);
}

/**
 * 格式化数字 (1000 -> 1K)
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return String(num);
}

/**
 * 格式化时间
 */
export function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ============================================================
// AI 分析辅助函数
// ============================================================

/**
 * 获取情感颜色
 */
export function getSentimentColor(sentiment: string | null): string {
  switch (sentiment) {
    case "bullish":
      return "text-green-500";
    case "bearish":
      return "text-red-500";
    default:
      return "text-gray-500";
  }
}

/**
 * 获取情感背景颜色
 */
export function getSentimentBgColor(sentiment: string | null): string {
  switch (sentiment) {
    case "bullish":
      return "bg-green-500/10";
    case "bearish":
      return "bg-red-500/10";
    default:
      return "bg-gray-500/10";
  }
}

/**
 * 获取情感图标
 */
export function getSentimentIcon(sentiment: string | null): string {
  switch (sentiment) {
    case "bullish":
      return "📈";
    case "bearish":
      return "📉";
    default:
      return "➖";
  }
}

/**
 * 获取情感标签
 */
export function getSentimentLabel(sentiment: string | null): string {
  switch (sentiment) {
    case "bullish":
      return "Bullish";
    case "bearish":
      return "Bearish";
    default:
      return "Neutral";
  }
}

/**
 * 获取交易信号颜色
 */
export function getTradingSignalColor(action: string | null): string {
  switch (action) {
    case "buy":
      return "text-green-500";
    case "sell":
      return "text-red-500";
    case "hold":
      return "text-yellow-500";
    default:
      return "text-gray-500";
  }
}

/**
 * 获取交易信号标签
 */
export function getTradingSignalLabel(action: string | null): string {
  switch (action) {
    case "buy":
      return "Buy";
    case "sell":
      return "Sell";
    case "hold":
      return "Hold";
    default:
      return "None";
  }
}

/**
 * 格式化置信度为百分比
 */
export function formatConfidence(confidence: number | null): string {
  if (confidence === null || confidence === undefined) return "";
  return `${Math.round(confidence * 100)}%`;
}
