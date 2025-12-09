// API functions for tracked stock operations
import { createClient } from "@/lib/supabase/client";

export interface TopAuthor {
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  tweet_count: number;
  sentiment?: string | null;
}

export interface TrackedStock {
  id: string;
  user_id: string;
  symbol: string;
  company_name?: string | null;
  logo_url?: string | null;
  notify: boolean;
  created_at: string;
  // KOL 数据
  mention_count: number;
  sentiment_score?: number | null;
  trending_score?: number | null;
  engagement_score?: number | null;
  unique_authors_count: number;
  top_authors: TopAuthor[];
  last_seen_at?: string | null;
}

export interface KOLOpinion {
  id: string;
  kolName: string;
  kolAvatar: string;
  sentiment: "bullish" | "bearish" | "neutral";
  summary: string;
  timestamp: string;
}

interface CreateTrackedStockParams {
  symbol: string;
  companyName?: string;
  logo?: string;
  notify?: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

/**
 * Get auth token from Supabase
 */
async function getAuthToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Create a new tracked stock (add to watchlist)
 */
export async function createTrackedStock(
  params: CreateTrackedStockParams
): Promise<TrackedStock> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("未登录，请先登录");
  }

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/stocks/tracked`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      symbol: params.symbol,
      company_name: params.companyName,
      logo_url: params.logo,
      notify: params.notify ?? true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to add stock to watchlist");
  }

  return response.json();
}

/**
 * Delete a tracked stock from watchlist
 */
export async function deleteTrackedStock(stockId: string): Promise<void> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("未登录，请先登录");
  }

  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/stocks/tracked/${stockId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to remove stock from watchlist");
  }
}

/**
 * Get all tracked stocks for current user
 */
export async function getTrackedStocks(): Promise<TrackedStock[]> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("未登录，请先登录");
  }

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/stocks/tracked`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to fetch watchlist");
  }

  const data = await response.json();
  return data.stocks || [];
}

/**
 * Update tracked stock settings (e.g., notify)
 */
export async function updateTrackedStock(
  stockId: string,
  updates: { notify?: boolean }
): Promise<TrackedStock> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("未登录，请先登录");
  }

  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/stocks/tracked/${stockId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to update stock settings");
  }

  return response.json();
}

/**
 * Check if a stock is being tracked
 */
export async function checkStockTracked(
  symbol: string
): Promise<{ symbol: string; is_tracked: boolean; stock_id: string | null }> {
  const token = await getAuthToken();
  if (!token) {
    return { symbol: symbol.toUpperCase(), is_tracked: false, stock_id: null };
  }

  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/stocks/tracked/check/${symbol}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    return { symbol: symbol.toUpperCase(), is_tracked: false, stock_id: null };
  }

  return response.json();
}
