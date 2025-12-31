/**
 * 小红书 API
 * 获取小红书帖子数据
 * 使用统一的 kol_tweets 和 kol_profiles 表
 */

// ============================================================
// 类型定义
// ============================================================

export interface XhsPost {
  id: number;
  // 平台信息
  platform?: string;
  platform_post_id?: string;
  note_id: string; // 向后兼容
  post_hash: string | null;
  title: string | null;
  content: string | null;
  note_type: string;
  permalink: string | null;
  // 作者信息
  author_name: string | null;
  author_id: string | null;
  author_avatar: string | null;
  // 媒体资源
  cover_url: string | null;
  image_urls: string[];
  video_url: string | null;
  // 互动数据
  like_count: number;
  collect_count: number;
  comment_count: number;
  share_count: number;
  // 标签
  tags: string[];
  search_keyword: string | null;
  // AI 分析结果
  ai_sentiment: string | null;
  ai_sentiment_confidence: number;
  ai_sentiment_reasoning: string | null;
  ai_tickers: string[];
  ai_tags: string[];
  ai_summary: string | null;
  ai_trading_signal: string | { action?: string } | null;
  ai_is_stock_related: boolean;
  ai_stock_related_confidence: number;
  ai_stock_related_reason: string | null;
  ai_analyzed_at: string | null;
  ai_model: string | null;
  // 时间戳
  created_at: string | null;
  scraped_at: string | null;
  updated_at: string | null;
}

export interface XhsPostsResponse {
  posts: XhsPost[];
  total: number;
  has_more: boolean;
  offset: number;
  limit: number;
}

export interface XhsPostsParams {
  limit?: number;
  offset?: number;
  keyword?: string;
  ticker?: string;
  sentiment?: string;
  stock_related?: boolean;
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
 * 获取小红书帖子列表
 * 使用统一的 /tweets 端点，通过 platform=xiaohongshu 过滤
 */
export async function getXhsPosts(
  params: XhsPostsParams = {}
): Promise<XhsPostsResponse> {
  const searchParams = new URLSearchParams();
  
  // 固定使用 xiaohongshu 平台
  searchParams.set("platform", "xiaohongshu");

  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));
  if (params.keyword) searchParams.set("keyword", params.keyword);
  if (params.ticker) searchParams.set("ticker", params.ticker);
  if (params.sentiment) searchParams.set("sentiment", params.sentiment);
  if (params.stock_related !== undefined)
    searchParams.set("stock_related", String(params.stock_related));

  const query = searchParams.toString();
  
  // 调用统一的 tweets 端点
  const response = await fetchAPI<any>(`/tweets?${query}`);
  
  // 转换响应格式以保持兼容性
  return {
    posts: response.tweets || [],
    total: response.total || 0,
    has_more: response.has_more || false,
    offset: params.offset || 0,
    limit: params.limit || 20,
  };
}

// ============================================================
// 辅助函数
// ============================================================

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

/**
 * 获取帖子完整链接
 */
export function getXhsPermalink(noteId: string): string {
  return `https://www.xiaohongshu.com/explore/${noteId}`;
}
