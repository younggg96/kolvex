/**
 * API Client for Kolvex Mobile App
 * Connects to FastAPI backend at /api/v1/
 */
import { supabase } from './supabase';
import { API_BASE_URL } from '@/constants';
import type {
  KOLPost,
  KOLPostsResponse,
  KOLPostsParams,
  KOLProfile,
  KOLProfilesResponse,
  StockQuote,
  StockOverview,
  IntradayData,
  HistoricalData,
  TrendingStock,
  TrendingStocksResponse,
  StockDiscussionsResponse,
  TrackedStock,
  TrackedKOL,
  Conversation,
  ChatMessage,
  ConversationsResponse,
  MessagesResponse,
  SendMessageResponse,
  UserProfile,
  Notification,
  NotificationsResponse,
  StockAlertRule,
  NewsArticle,
  NewsListResponse,
  Platform,
  Sentiment,
} from './types';

// ============================================================
// Base API Request
// ============================================================

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, timeout = 15000 } = options;

  const token = await getAuthToken();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.message || `API Error: ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helper to build query string
function buildQuery(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

// ============================================================
// Market Data API - /market/
// ============================================================

export const marketApi = {
  /** Get real-time quote for a stock */
  getQuote: (symbol: string) =>
    apiRequest<StockQuote>(`/market/quote/${symbol.toUpperCase()}`),

  /** Batch quotes for multiple symbols */
  batchQuotes: (symbols: string[]) =>
    apiRequest<Record<string, StockQuote>>('/market/quotes', {
      method: 'POST',
      body: { symbols },
    }),

  /** Get historical data */
  getHistory: (symbol: string, period?: string, interval?: string) =>
    apiRequest<HistoricalData[]>(
      `/market/history/${symbol.toUpperCase()}${buildQuery({ period, interval })}`
    ),

  /** Get intraday data */
  getIntraday: (symbol: string, interval?: string) =>
    apiRequest<IntradayData[]>(
      `/market/intraday/${symbol.toUpperCase()}${buildQuery({ interval })}`
    ),

  /** Get company info */
  getCompany: (symbol: string) =>
    apiRequest<unknown>(`/market/company/${symbol.toUpperCase()}`),

  /** Get stock overview (quote + company + financials) */
  getOverview: (symbol: string) =>
    apiRequest<StockOverview>(`/market/overview/${symbol.toUpperCase()}`),

  /** Get analyst recommendations */
  getAnalyst: (symbol: string) =>
    apiRequest<unknown>(`/market/analyst/${symbol.toUpperCase()}`),

  /** Get earnings data */
  getEarnings: (symbol: string) =>
    apiRequest<unknown>(`/market/earnings/${symbol.toUpperCase()}`),

  /** Get related news */
  getNews: (symbol: string) =>
    apiRequest<unknown>(`/market/news/${symbol.toUpperCase()}`),
};

// ============================================================
// Stocks API - /stocks/
// ============================================================

export const stockApi = {
  /** Search stocks */
  search: (query: string) =>
    apiRequest<unknown[]>(`/stocks/search${buildQuery({ q: query })}`),

  /** Get popular stocks (by KOL mentions) */
  getPopular: () =>
    apiRequest<unknown[]>('/stocks/popular'),

  /** Autocomplete stock search */
  autocomplete: (query: string) =>
    apiRequest<unknown[]>(`/stocks/autocomplete${buildQuery({ q: query })}`),

  /** Get trending stocks with sentiment */
  getTrending: () =>
    apiRequest<TrendingStocksResponse>('/stocks/trending'),

  /** Get stock discussions from KOLs */
  getDiscussions: (ticker: string, params?: { page?: number; page_size?: number; sort_by?: string; sort_direction?: string }) =>
    apiRequest<StockDiscussionsResponse>(
      `/stocks/${ticker.toUpperCase()}/discussions${buildQuery(params || {})}`
    ),

  /** Get user's tracked stocks (requires auth) */
  getTracked: () =>
    apiRequest<TrackedStock[]>('/stocks/tracked'),

  /** Add tracked stock (requires auth) */
  addTracked: (symbol: string, notes?: string) =>
    apiRequest<TrackedStock>('/stocks/tracked', {
      method: 'POST',
      body: { symbol, notes },
    }),

  /** Remove tracked stock (requires auth) */
  removeTracked: (stockId: string) =>
    apiRequest<void>(`/stocks/tracked/${stockId}`, { method: 'DELETE' }),

  /** Check if stock is tracked */
  checkTracked: (symbol: string) =>
    apiRequest<{ is_tracked: boolean; stock_id?: string }>(
      `/stocks/tracked/check/${symbol.toUpperCase()}`
    ),
};

// ============================================================
// KOL Posts API - /kol-posts/
// ============================================================

export const kolPostsApi = {
  /** Get KOL posts list (multi-platform) */
  getPosts: (params: KOLPostsParams = {}) =>
    apiRequest<KOLPostsResponse>(`/kol-posts/${buildQuery(params)}`),

  /** Get posts by a specific user */
  getUserPosts: (username: string, params?: { page?: number; page_size?: number; platform?: Platform }) =>
    apiRequest<KOLPostsResponse>(
      `/kol-posts/user/${encodeURIComponent(username)}${buildQuery(params || {})}`
    ),

  /** Get KOL profiles list */
  getProfiles: (params?: { platform?: Platform; sort_by?: string; sort_order?: string }) =>
    apiRequest<KOLProfilesResponse>(`/kol-posts/profiles${buildQuery(params || {})}`),

  /** Get KOL profile detail */
  getProfile: (username: string) =>
    apiRequest<KOLProfile>(`/kol-posts/profile/${encodeURIComponent(username)}`),

  /** Get KOL stats */
  getStats: () =>
    apiRequest<{ total_posts: number; total_kols: number }>('/kol-posts/stats'),

  /** Get AI analysis for a post */
  getAIAnalysis: (postId: number) =>
    apiRequest<unknown>(`/kol-posts/ai/${postId}`),
};

// ============================================================
// KOL Subscriptions API - /kol-subscriptions/
// ============================================================

export const kolSubscriptionApi = {
  /** Get tracked KOLs */
  getTracked: () =>
    apiRequest<TrackedKOL[]>('/kol-subscriptions/tracked'),

  /** Add tracked KOL */
  addTracked: (username: string, platform: Platform) =>
    apiRequest<TrackedKOL>('/kol-subscriptions/tracked', {
      method: 'POST',
      body: { username, platform },
    }),

  /** Remove tracked KOL */
  removeTracked: (data: { username: string; platform: Platform }) =>
    apiRequest<void>('/kol-subscriptions/tracked', {
      method: 'DELETE',
      body: data,
    }),

  /** Check if KOL is tracked */
  checkTracked: (username: string, platform: Platform) =>
    apiRequest<{ is_tracked: boolean }>(
      `/kol-subscriptions/tracked/check${buildQuery({ username, platform })}`
    ),
};

// ============================================================
// Chat API - /chat/
// ============================================================

export const chatApi = {
  /** Get all conversations */
  getConversations: () =>
    apiRequest<ConversationsResponse>('/chat/conversations'),

  /** Create a new conversation */
  createConversation: (title?: string) =>
    apiRequest<Conversation>('/chat/conversations', {
      method: 'POST',
      body: { title },
    }),

  /** Get a specific conversation */
  getConversation: (conversationId: string) =>
    apiRequest<Conversation>(`/chat/conversations/${conversationId}`),

  /** Update conversation title */
  updateConversation: (conversationId: string, title: string) =>
    apiRequest<Conversation>(`/chat/conversations/${conversationId}`, {
      method: 'PATCH',
      body: { title },
    }),

  /** Delete a conversation */
  deleteConversation: (conversationId: string) =>
    apiRequest<void>(`/chat/conversations/${conversationId}`, { method: 'DELETE' }),

  /** Delete all conversations */
  deleteAllConversations: () =>
    apiRequest<void>('/chat/conversations', { method: 'DELETE' }),

  /** Get messages for a conversation */
  getMessages: (conversationId: string) =>
    apiRequest<MessagesResponse>(`/chat/conversations/${conversationId}/messages`),

  /** Send a message to a conversation */
  sendMessage: (conversationId: string, content: string) =>
    apiRequest<SendMessageResponse>(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: { content },
      timeout: 60000, // AI responses can take longer
    }),
};

// ============================================================
// User Profile API - /users/
// ============================================================

export const userApi = {
  /** Get current user profile */
  getProfile: () =>
    apiRequest<UserProfile>('/users/me'),

  /** Update current user profile */
  updateProfile: (data: Partial<Pick<UserProfile, 'username' | 'display_name' | 'bio' | 'avatar_url'>>) =>
    apiRequest<UserProfile>('/users/me', {
      method: 'PUT',
      body: data,
    }),

  /** Update theme preference */
  updateTheme: (theme: 'LIGHT' | 'DARK' | 'SYSTEM') =>
    apiRequest<UserProfile>('/users/me/theme', {
      method: 'PATCH',
      body: { theme },
    }),

  /** Update notification settings */
  updateNotifications: (settings: Partial<UserProfile['notification_settings']>) =>
    apiRequest<UserProfile>('/users/me/notifications', {
      method: 'PATCH',
      body: settings,
    }),

  /** Get public user profile */
  getPublicProfile: (userId: string) =>
    apiRequest<UserProfile>(`/users/${userId}`),
};

// ============================================================
// Notifications API - /notifications/
// ============================================================

export const notificationApi = {
  /** Get notifications */
  getNotifications: () =>
    apiRequest<NotificationsResponse>('/notifications'),

  /** Get unread count */
  getUnreadCount: () =>
    apiRequest<{ count: number }>('/notifications/unread-count'),

  /** Mark notification as read */
  markAsRead: (notificationId: string) =>
    apiRequest<void>(`/notifications/${notificationId}/read`, { method: 'POST' }),

  /** Mark all as read */
  markAllAsRead: () =>
    apiRequest<void>('/notifications/read-all', { method: 'POST' }),

  /** Delete notification */
  deleteNotification: (notificationId: string) =>
    apiRequest<void>(`/notifications/${notificationId}`, { method: 'DELETE' }),
};

// ============================================================
// Stock Alerts API - /stock-alerts/
// ============================================================

export const stockAlertApi = {
  /** Get alert rules */
  getRules: () =>
    apiRequest<StockAlertRule[]>('/stock-alerts/rules'),

  /** Create alert rule */
  createRule: (data: { symbol: string; condition: string; value: number }) =>
    apiRequest<StockAlertRule>('/stock-alerts/rules', {
      method: 'POST',
      body: data,
    }),

  /** Delete alert rule */
  deleteRule: (ruleId: string) =>
    apiRequest<void>(`/stock-alerts/rules/${ruleId}`, { method: 'DELETE' }),

  /** Get alert history */
  getHistory: () =>
    apiRequest<unknown[]>('/stock-alerts/history'),
};

// ============================================================
// News API - /news/
// ============================================================

export const newsApi = {
  /** Get news articles */
  getNews: (params?: { page?: number; page_size?: number; ticker?: string; tag?: string }) =>
    apiRequest<NewsListResponse>(`/news/${buildQuery(params || {})}`),

  /** Fetch news for a ticker */
  fetchForTicker: (ticker: string) =>
    apiRequest<unknown>(`/news/fetch/${ticker.toUpperCase()}`),
};

// ============================================================
// Auth API - /auth/
// ============================================================

export const authApi = {
  /** Get current user info */
  getUser: () =>
    apiRequest<unknown>('/auth/user'),

  /** Refresh access token */
  refreshToken: () =>
    apiRequest<unknown>('/auth/refresh', { method: 'POST' }),
};
