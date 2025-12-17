// API functions for tracked stock operations

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

/**
 * Create a new tracked stock (add to watchlist)
 */
export async function createTrackedStock(
  params: CreateTrackedStockParams
): Promise<TrackedStock> {
  const response = await fetch("/api/tracked-stocks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      symbol: params.symbol,
      companyName: params.companyName,
      logo: params.logo,
      notify: params.notify ?? true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to add stock to watchlist");
  }

  return response.json();
}

/**
 * Delete a tracked stock from watchlist
 */
export async function deleteTrackedStock(stockId: string): Promise<void> {
  const url = new URL("/api/tracked-stocks", window.location.origin);
  url.searchParams.set("id", stockId);

  const response = await fetch(url.toString(), {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to remove stock from watchlist");
  }
}

/**
 * Get all tracked stocks for current user
 */
export async function getTrackedStocks(): Promise<TrackedStock[]> {
  const response = await fetch("/api/tracked-stocks");

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch watchlist");
  }

  return response.json();
}

/**
 * Update tracked stock settings (e.g., notify)
 */
export async function updateTrackedStock(
  stockId: string,
  updates: { notify?: boolean }
): Promise<TrackedStock> {
  const response = await fetch("/api/tracked-stocks", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: stockId,
      ...updates,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to update stock settings");
  }

  return response.json();
}

/**
 * Check if a stock is being tracked
 */
export async function checkStockTracked(
  symbol: string
): Promise<{ symbol: string; is_tracked: boolean; stock_id: string | null }> {
  try {
    const response = await fetch(
      `/api/tracked-stocks/check/${encodeURIComponent(symbol.toUpperCase())}`
    );

    if (!response.ok) {
      return { symbol: symbol.toUpperCase(), is_tracked: false, stock_id: null };
    }

    return response.json();
  } catch {
    return { symbol: symbol.toUpperCase(), is_tracked: false, stock_id: null };
  }
}
