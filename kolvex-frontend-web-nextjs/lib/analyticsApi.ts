/**
 * KOL 帖子数据分析 API
 * 提供多维度的数据分析功能
 */

// ============================================================
// 类型定义
// ============================================================

export interface TrendDataPoint {
  date: string;
  count: number;
  twitter?: number;
  xiaohongshu?: number;
  reddit?: number;
  youtube?: number;
}

export interface PlatformBreakdown {
  twitter: number;
  xiaohongshu: number;
  reddit: number;
  youtube: number;
}

export interface TrendSummary {
  total_posts: number;
  average_daily: number;
  max_daily: number;
  min_daily: number;
  peak_date: string | null;
  days_analyzed: number;
}

export interface TrendsData {
  trends: TrendDataPoint[];
  summary: TrendSummary;
  platform_breakdown?: PlatformBreakdown;
}

export interface KOLRanking {
  rank: number;
  username: string;
  avatar_url: string | null;
  total_views: number;
  total_likes: number;
  total_reposts: number;
  total_replies: number;
  total_bookmarks: number;
  post_count: number;
  engagement_rate: number;
}

export interface TopKOLsData {
  kols: KOLRanking[];
  sort_by: string;
  total_kols: number;
}

export interface SentimentDistribution {
  counts: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  percentages: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
}

export interface SentimentMetrics {
  total_analyzed: number;
  sentiment_score: number;
  sentiment_label: string;
  bull_bear_ratio: number;
}

export interface DailySentiment {
  date: string;
  bullish: number;
  bearish: number;
  neutral: number;
}

export interface SentimentData {
  distribution: SentimentDistribution;
  confidence: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  views_weighted: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  metrics: SentimentMetrics;
  daily_trends?: DailySentiment[];
}

export interface EngagementStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  total: number;
  count: number;
  p25: number;
  p75: number;
}

export interface CorrelationMatrix {
  [key: string]: {
    [key: string]: number;
  };
}

export interface EngagementData {
  statistics: {
    views: EngagementStats;
    likes: EngagementStats;
    reposts: EngagementStats;
    replies: EngagementStats;
    bookmarks: EngagementStats;
  };
  correlation_matrix: CorrelationMatrix;
  engagement_rate: {
    distribution: {
      "0-1%": number;
      "1-2%": number;
      "2-5%": number;
      "5-10%": number;
      "10%+": number;
    };
    average: number;
    median: number;
  };
  total_posts: number;
}

export interface TickerSentimentCounts {
  bullish: number;
  bearish: number;
  neutral: number;
}

export interface TickerAnalysis {
  rank: number;
  ticker: string;
  mention_count: number;
  total_views: number;
  total_likes: number;
  total_reposts: number;
  unique_author_count: number;
  sentiment_score: number;
  sentiment_counts?: TickerSentimentCounts;
}

export interface TickersData {
  tickers: TickerAnalysis[];
  total_unique_tickers: number;
  summary: {
    most_mentioned: string | null;
    most_bullish: string | null;
    most_bearish: string | null;
  };
}

export interface DashboardOverview {
  total_posts: number;
  total_views: number;
  total_engagement: number;
  unique_authors: number;
  stock_related_posts: number;
  avg_views_per_post: number;
  avg_engagement_per_post: number;
}

export interface DashboardData {
  period: {
    days: number;
    start_date: string;
    end_date: string;
  };
  overview: DashboardOverview;
  sentiment: {
    distribution: {
      bullish: number;
      bearish: number;
      neutral: number;
    };
    sentiment_score: number;
  };
  top_tickers: Array<{
    ticker: string;
    count: number;
    bullish?: number;
    bearish?: number;
    neutral?: number;
  }>;
  top_kols: Array<{
    username: string;
    total_views: number;
    post_count?: number;
    total_engagement?: number;
  }>;
  daily_trend: Array<{
    date: string;
    count: number;
    views?: number;
    bullish?: number;
    bearish?: number;
    neutral?: number;
  }>;
  data_quality?: {
    analyzed_posts: number;
    unanalyzed_posts: number;
    analysis_coverage: number;
  };
  _source?: "snapshot" | "realtime";
  _snapshot_id?: number;
  _snapshot_created_at?: string;
}

export interface SnapshotInfo {
  id: number;
  snapshot_type: string;
  period_days: number;
  start_date: string;
  end_date: string;
  total_posts: number;
  sentiment_score: number;
  analysis_coverage: number;
  created_at: string;
}

export interface GenerateSnapshotResult {
  success: boolean;
  message: string;
  snapshot: DashboardData;
  stats: {
    posts_analyzed: number;
    ai_coverage: string;
    generated_at: string;
  };
}

export interface KeywordItem {
  word: string;
  count: number;
}

export interface TagItem {
  tag: string;
  count: number;
}

export interface KeywordsData {
  keywords: KeywordItem[];
  ai_tags: TagItem[];
  total_posts_analyzed: number;
}

export interface SentimentEngagementComparison {
  post_count: number;
  avg_views: number;
  avg_likes: number;
  avg_reposts: number;
  avg_engagement_rate: number;
  total_views: number;
  total_likes: number;
}

export interface SentimentEngagementData {
  comparison: {
    bullish: SentimentEngagementComparison;
    bearish: SentimentEngagementComparison;
    neutral: SentimentEngagementComparison;
  };
  insights: string[];
  total_posts: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ============================================================
// API 基础配置
// ============================================================

function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

async function fetchAnalyticsAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/analytics${endpoint}`;

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

  const result: ApiResponse<T> = await response.json();
  return result.data;
}

// ============================================================
// API 函数
// ============================================================

/**
 * 获取帖子趋势分析
 */
export async function getPostTrends(
  days: number = 30,
  username?: string
): Promise<TrendsData> {
  const params = new URLSearchParams({ days: String(days) });
  if (username) params.set("username", username);
  return fetchAnalyticsAPI<TrendsData>(`/trends?${params}`);
}

// 向后兼容别名
export const getTweetTrends = getPostTrends;

/**
 * 获取 KOL 影响力排名
 */
export async function getTopKOLs(
  limit: number = 10,
  sortBy: string = "views",
  days?: number
): Promise<TopKOLsData> {
  const params = new URLSearchParams({
    limit: String(limit),
    sort_by: sortBy,
  });
  if (days) params.set("days", String(days));
  return fetchAnalyticsAPI<TopKOLsData>(`/top-kols?${params}`);
}

/**
 * 获取情感分析
 */
export async function getSentimentAnalysis(
  days?: number,
  ticker?: string,
  includeDaily: boolean = false
): Promise<SentimentData> {
  const params = new URLSearchParams();
  if (days) params.set("days", String(days));
  if (ticker) params.set("ticker", ticker);
  if (includeDaily) params.set("include_daily", "true");
  const query = params.toString();
  return fetchAnalyticsAPI<SentimentData>(
    `/sentiment${query ? `?${query}` : ""}`
  );
}

/**
 * 获取互动分析
 */
export async function getEngagementAnalysis(
  days?: number
): Promise<EngagementData> {
  const params = new URLSearchParams();
  if (days) params.set("days", String(days));
  const query = params.toString();
  return fetchAnalyticsAPI<EngagementData>(
    `/engagement${query ? `?${query}` : ""}`
  );
}

/**
 * 获取股票代码热度分析
 */
export async function getTickerAnalysis(
  limit: number = 20,
  days?: number,
  includeSentiment: boolean = true
): Promise<TickersData> {
  const params = new URLSearchParams({
    limit: String(limit),
    include_sentiment: String(includeSentiment),
  });
  if (days) params.set("days", String(days));
  return fetchAnalyticsAPI<TickersData>(`/tickers?${params}`);
}

/**
 * 获取综合仪表盘数据
 */
export async function getDashboardSummary(
  days: number = 7
): Promise<DashboardData> {
  return fetchAnalyticsAPI<DashboardData>(`/dashboard?days=${days}`);
}

/**
 * 获取关键词分析
 */
export async function getKeywordAnalysis(
  limit: number = 50,
  days?: number,
  excludeTickers: boolean = true
): Promise<KeywordsData> {
  const params = new URLSearchParams({
    limit: String(limit),
    exclude_tickers: String(excludeTickers),
  });
  if (days) params.set("days", String(days));
  return fetchAnalyticsAPI<KeywordsData>(`/keywords?${params}`);
}

/**
 * 获取情感与互动交叉分析
 */
export async function getSentimentEngagementAnalysis(
  days?: number
): Promise<SentimentEngagementData> {
  const params = new URLSearchParams();
  if (days) params.set("days", String(days));
  const query = params.toString();
  return fetchAnalyticsAPI<SentimentEngagementData>(
    `/sentiment-engagement${query ? `?${query}` : ""}`
  );
}

// ============================================================
// 快照管理 API
// ============================================================

/**
 * 获取历史快照列表
 */
export async function listAnalyticsSnapshots(
  snapshotType: string = "dashboard",
  limit: number = 10
): Promise<SnapshotInfo[]> {
  const params = new URLSearchParams({
    snapshot_type: snapshotType,
    limit: String(limit),
  });
  return fetchAnalyticsAPI<SnapshotInfo[]>(`/snapshots?${params}`);
}

/**
 * 获取最新快照
 */
export async function getLatestSnapshot(
  days: number = 7
): Promise<DashboardData | null> {
  try {
    const result = await fetchAnalyticsAPI<DashboardData>(
      `/snapshots/latest?days=${days}`
    );
    return result;
  } catch {
    return null;
  }
}

/**
 * 清理旧快照
 */
export async function cleanupSnapshots(
  keepCount: number = 10
): Promise<{ deleted: number; kept: number }> {
  return fetchAnalyticsAPI<{ deleted: number; kept: number }>(
    `/snapshots/cleanup?keep_count=${keepCount}`,
    { method: "DELETE" }
  );
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 格式化大数字
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + "B";
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return String(num);
}

/**
 * 获取情感颜色类名
 */
export function getSentimentColorClass(sentiment: string): string {
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
 * 获取情感背景颜色类名
 */
export function getSentimentBgClass(sentiment: string): string {
  switch (sentiment) {
    case "bullish":
      return "bg-green-500";
    case "bearish":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

/**
 * 格式化百分比
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * 格式化情感得分
 */
export function formatSentimentScore(score: number): string {
  const sign = score >= 0 ? "+" : "";
  return `${sign}${(score * 100).toFixed(1)}%`;
}
