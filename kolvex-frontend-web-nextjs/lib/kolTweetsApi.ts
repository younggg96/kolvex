/**
 * KOL Tweets API
 * 获取 KOL 推文数据
 */

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
  value: "bullish" | "bearish" | "neutral" | null;
  confidence: number | null;
  reasoning: string | null;
}

export interface TradingSignal {
  action: "buy" | "sell" | "hold" | null;
  tickers: string[];
  confidence: number | null;
}

export interface KOLTweet {
  id: number;
  username: string;
  display_name: string | null;
  kol_description: string | null;
  avatar_url: string | null;
  tweet_text: string;
  created_at: string | null;
  permalink: string | null;
  // 媒体
  media_urls: MediaItem[] | null;
  // 转发信息
  is_repost: boolean;
  original_author: string | null;
  // 互动数据
  like_count: number;
  retweet_count: number;
  reply_count: number;
  bookmark_count: number;
  views_count: number;
  // 元数据
  scraped_at: string | null;
  category: string | null;

  // ========== AI 分析字段 ==========
  // 情感分析
  sentiment: SentimentAnalysis | null;
  // 股票代码
  tickers: string[];
  // AI 标签
  tags: string[];
  // 投资信号
  trading_signal: TradingSignal | null;
  // 摘要
  summary: string | null;
  summary_en: string | null;
  // AI 分析元数据
  ai_analyzed_at: string | null;
  ai_model: string | null;
}

export interface KOLTweetsResponse {
  tweets: KOLTweet[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface KOLProfile {
  username: string;
  display_name: string | null;
  description: string | null;
  category: string | null;
  avatar_url: string | null;
  tweet_count: number;
  total_likes: number;
  total_retweets: number;
  last_scraped_at: string | null;
}

export interface KOLProfilesResponse {
  profiles: KOLProfile[];
  total: number;
}

export interface CategoryStats {
  category: string;
  kol_count: number;
  tweet_count: number;
  total_likes: number;
  last_scraped_at: string | null;
}

export interface StatsResponse {
  total_tweets: number;
  total_kols: number;
  categories: CategoryStats[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface KOLTweetsParams {
  page?: number;
  page_size?: number;
  category?: string;
  username?: string;
  search?: string;
}

// ============================================================
// API 基础配置
// ============================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}/api/v1${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================
// API 函数
// ============================================================

/**
 * 获取 KOL 推文列表
 */
export async function getKOLTweets(
  params: KOLTweetsParams = {}
): Promise<KOLTweetsResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size) searchParams.set("page_size", String(params.page_size));
  if (params.category) searchParams.set("category", params.category);
  if (params.username) searchParams.set("username", params.username);
  if (params.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  return fetchAPI<KOLTweetsResponse>(`/kol-tweets/${query ? `?${query}` : ""}`);
}

/**
 * 获取 KOL 列表
 */
export async function getKOLProfiles(
  category?: string
): Promise<KOLProfilesResponse> {
  const query = category ? `?category=${category}` : "";
  return fetchAPI<KOLProfilesResponse>(`/kol-tweets/profiles${query}`);
}

/**
 * 获取统计信息
 */
export async function getKOLStats(): Promise<StatsResponse> {
  return fetchAPI<StatsResponse>("/kol-tweets/stats");
}

/**
 * 获取所有类别
 */
export async function getCategories(): Promise<{ categories: Category[] }> {
  return fetchAPI<{ categories: Category[] }>("/kol-tweets/categories");
}

/**
 * 获取特定用户的推文
 */
export async function getUserTweets(
  username: string,
  page: number = 1,
  pageSize: number = 20
): Promise<KOLTweetsResponse> {
  return fetchAPI<KOLTweetsResponse>(
    `/kol-tweets/user/${username}?page=${page}&page_size=${pageSize}`
  );
}

// ============================================================
// 类别配置（静态数据，用于快速渲染）
// ============================================================

export const CATEGORY_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  news_flow: {
    name: "News & Flow",
    icon: "🚨",
    color: "text-red-500",
  },
  short_macro: {
    name: "Short & Macro",
    icon: "📉",
    color: "text-orange-500",
  },
  charts_data: {
    name: "Charts & Data",
    icon: "📊",
    color: "text-blue-500",
  },
  institutional: {
    name: "Institutional",
    icon: "🐂",
    color: "text-green-500",
  },
  retail_meme: {
    name: "Retail & Meme",
    icon: "🦍",
    color: "text-purple-500",
  },
};

/**
 * 获取类别显示信息
 */
export function getCategoryInfo(category: string | null) {
  if (!category) return null;
  return CATEGORY_CONFIG[category] || null;
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

  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}天前`;
  
  return date.toLocaleDateString("zh-CN", {
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
      return "看涨";
    case "bearish":
      return "看跌";
    default:
      return "中性";
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
      return "买入";
    case "sell":
      return "卖出";
    case "hold":
      return "持有";
    default:
      return "无信号";
  }
}

/**
 * 格式化置信度为百分比
 */
export function formatConfidence(confidence: number | null): string {
  if (confidence === null || confidence === undefined) return "";
  return `${Math.round(confidence * 100)}%`;
}

