
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
  };
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  tracked_stocks_count: number;
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
