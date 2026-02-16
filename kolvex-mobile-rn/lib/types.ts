/**
 * API Types for Kolvex Mobile App
 * Matches the FastAPI backend at /api/v1/
 */

// ============================================================
// Common Types
// ============================================================

export type Platform = 'twitter' | 'xiaohongshu' | 'reddit' | 'youtube';
export type Sentiment = 'bullish' | 'bearish' | 'neutral';
export type TradingAction = 'buy' | 'sell' | 'hold';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// ============================================================
// KOL Posts Types
// ============================================================

export interface MediaItem {
  type: 'photo' | 'video' | 'gif' | 'card';
  url: string | null;
  poster?: string | null;
}

export interface SentimentAnalysis {
  value: Sentiment | string | null;
  confidence: number | null;
  reasoning: string | null;
}

export interface TradingSignal {
  action: TradingAction | null;
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
  platform: Platform;
  platform_post_id: string | null;
  username: string;
  display_name: string | null;
  kol_description: string | null;
  avatar_url: string | null;
  author_platform_id: string | null;
  title: string | null;
  content: string;
  post_type: string;
  created_at: string | null;
  permalink: string | null;
  cover_url: string | null;
  media_urls: MediaItem[] | null;
  video_url: string | null;
  is_repost: boolean;
  original_author: string | null;
  like_count: number;
  repost_count: number;
  reply_count: number;
  bookmark_count: number;
  views_count: number;
  collect_count: number;
  share_count: number;
  tags: string[];
  search_keyword: string | null;
  scraped_at: string | null;
  sentiment: SentimentAnalysis | null;
  tickers: string[];
  ai_tags: string[];
  trading_signal: TradingSignal | null;
  summary: string | null;
  ai_analyzed_at: string | null;
  ai_model: string | null;
  is_stock_related: IsStockRelated | null;
}

export interface KOLPostsResponse {
  posts: KOLPost[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface KOLPostsParams {
  page?: number;
  page_size?: number;
  platform?: Platform;
  username?: string;
  usernames?: string;
  search?: string;
  sentiment?: Sentiment;
  stock_related?: boolean;
  ticker?: string;
}

// ============================================================
// KOL Profile Types
// ============================================================

export interface KOLProfile {
  id: number;
  platform: Platform;
  platform_user_id: string | null;
  username: string;
  display_name: string | null;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  profile_url: string | null;
  is_verified: boolean;
  verification_type: string | null;
  followers_count: number;
  following_count: number;
  likes_count: number;
  collected_count: number;
  rest_id: string | null;
  join_date: string | null;
  red_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface KOLProfilesResponse {
  profiles: KOLProfile[];
  total: number;
}

// ============================================================
// Market / Stock Types
// ============================================================

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  pe: number;
  eps: number;
  dividend: number;
  beta: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
}

export interface StockOverview {
  quote: StockQuote;
  company: {
    name: string;
    sector: string;
    industry: string;
    description: string;
    website: string;
    employees: number;
  };
}

export interface IntradayData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ============================================================
// Trending / Popular Stocks
// ============================================================

export interface TrendingStockAuthor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  platform: string;
  tweet_count: number;
  sentiment: Sentiment | null;
}

/** Matches backend TrendingStockItem schema */
export interface TrendingStock {
  ticker: string;
  company_name: string | null;
  platform: string;
  mention_count: number;
  sentiment_score: number | null;
  trending_score: number | null;
  engagement_score: number | null;
  unique_authors_count: number;
  top_authors: TrendingStockAuthor[];
  last_seen_at: string | null;
  first_seen_at: string | null;
}

/** Matches backend TrendingStocksResponse schema */
export interface TrendingStocksResponse {
  stocks: TrendingStock[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface PopularStock {
  symbol: string;
  name?: string;
  mention_count: number;
  kol_count: number;
  avg_sentiment?: number;
}

// ============================================================
// Stock Discussions
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

export interface StockDiscussionsResponse {
  ticker: string;
  total_tweets: number;
  total_kols: number;
  kols: KOLSummary[];
  tweets: KOLPost[];
  page: number;
  page_size: number;
  has_more: boolean;
}

// ============================================================
// Tracked Stocks
// ============================================================

export interface TrackedStock {
  id: string;
  user_id: string;
  symbol: string;
  name?: string;
  notes?: string;
  target_price?: number;
  alert_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// KOL Subscriptions (Tracked KOLs)
// ============================================================

export interface TrackedKOL {
  id: string;
  user_id: string;
  username: string;
  platform: Platform;
  display_name?: string;
  avatar_url?: string;
  alert_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Chat / AI Types
// ============================================================

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
}

export interface MessagesResponse {
  messages: ChatMessage[];
  total: number;
}

export interface SendMessageResponse {
  message: ChatMessage;
  response: ChatMessage;
}

// ============================================================
// User Profile Types
// ============================================================

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  locale?: 'en' | 'zh';
  notification_settings: {
    email: boolean;
    push: boolean;
    price_alerts: boolean;
    kol_alerts: boolean;
  };
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  tracked_stocks_count: number;
  tracked_kols_count: number;
  active_alerts_count: number;
}

// ============================================================
// Notification Types
// ============================================================

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

// ============================================================
// Stock Alerts Types
// ============================================================

export interface StockAlertRule {
  id: string;
  user_id: string;
  symbol: string;
  condition: 'above' | 'below' | 'change_percent';
  value: number;
  is_active: boolean;
  created_at: string;
  triggered_at: string | null;
}

// ============================================================
// News Types
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
  ai_summary?: string | null;
  sentiment?: Sentiment | null;
  sentiment_confidence?: number | null;
  trading_action?: TradingAction | null;
  market_impact?: 'high' | 'medium' | 'low' | 'none' | null;
  ai_tickers?: string[];
  ai_tags?: string[];
  key_points?: string[];
  analyzed_at?: string | null;
}

export interface NewsListResponse {
  articles: NewsArticle[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}
