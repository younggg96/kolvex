/**
 * SnapTrade API Module
 * Client-side API calls for portfolio sharing functionality
 */

import type {
  SnapTradeConnectionStatus,
  SnapTradeHoldings,
  SnapTradePublicHoldings,
  SnapTradeAccount,
  PublicUserSummary,
  PublicUsersResponse,
  PrivacySettings,
} from "@/lib/supabase/database.types";

const API_PREFIX = "/api/snaptrade";

/**
 * API request wrapper
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_PREFIX}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// ========== Connection Status ==========

/**
 * Get current user's SnapTrade connection status
 */
export async function getConnectionStatus(): Promise<SnapTradeConnectionStatus> {
  return apiRequest<SnapTradeConnectionStatus>("/status");
}

/**
 * Get connection portal URL
 * @param redirectUri Optional redirect URI after connection
 */
export async function getConnectionPortalUrl(
  redirectUri?: string
): Promise<string> {
  const params = redirectUri
    ? `?redirect_uri=${encodeURIComponent(redirectUri)}`
    : "";
  const result = await apiRequest<{ redirect_url: string }>(
    `/connect${params}`,
    { method: "POST" }
  );
  return result.redirect_url;
}

// ========== Sync Operations ==========

/**
 * Sync brokerage accounts
 */
export async function syncAccounts(): Promise<SnapTradeAccount[]> {
  return apiRequest<SnapTradeAccount[]>("/sync/accounts", { method: "POST" });
}

/**
 * Sync positions data
 */
export async function syncPositions(): Promise<{
  message: string;
  success: boolean;
}> {
  return apiRequest<{ message: string; success: boolean }>("/sync/positions", {
    method: "POST",
  });
}

// ========== Holdings Data ==========

/**
 * Get current user's holdings data
 */
export async function getMyHoldings(): Promise<SnapTradeHoldings> {
  return apiRequest<SnapTradeHoldings>("/holdings");
}

/**
 * Get user's public holdings data
 * @param userId User ID to fetch public holdings for
 */
export async function getPublicHoldings(
  userId: string
): Promise<SnapTradePublicHoldings | null> {
  try {
    return await apiRequest<SnapTradePublicHoldings>(`/holdings/${userId}`);
  } catch (error) {
    // Return null for 404 errors
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

/**
 * Get list of users with public portfolios
 * @param limit Number of users to fetch
 * @param offset Pagination offset
 */
export async function getPublicUsers(
  limit: number = 20,
  offset: number = 0
): Promise<PublicUsersResponse> {
  return apiRequest<PublicUsersResponse>(
    `/public-users?limit=${limit}&offset=${offset}`
  );
}

// ========== Settings ==========

/**
 * Toggle portfolio public sharing status
 * @param isPublic Whether to make portfolio public
 */
export async function togglePublicSharing(
  isPublic: boolean
): Promise<{ message: string; success: boolean }> {
  return apiRequest<{ message: string; success: boolean }>("/toggle-public", {
    method: "POST",
    body: JSON.stringify({ is_public: isPublic }),
  });
}

/**
 * Disconnect SnapTrade connection
 */
export async function disconnectSnapTrade(): Promise<{
  message: string;
  success: boolean;
}> {
  return apiRequest<{ message: string; success: boolean }>("/disconnect", {
    method: "DELETE",
  });
}

// ========== Position Visibility ==========

/**
 * Toggle visibility of a single position
 * @param positionId Position ID to toggle
 * @param isHidden Whether to hide the position from public view
 */
export async function togglePositionVisibility(
  positionId: string,
  isHidden: boolean
): Promise<{ message: string; success: boolean }> {
  return apiRequest<{ message: string; success: boolean }>(
    `/positions/${positionId}/visibility`,
    {
      method: "POST",
      body: JSON.stringify({ is_hidden: isHidden }),
    }
  );
}

/**
 * Batch toggle visibility of multiple positions
 * @param positionIds Array of position IDs to toggle
 * @param isHidden Whether to hide the positions from public view
 */
export async function batchTogglePositionVisibility(
  positionIds: string[],
  isHidden: boolean
): Promise<{ message: string; success: boolean }> {
  return apiRequest<{ message: string; success: boolean }>(
    "/positions/visibility/batch",
    {
      method: "POST",
      body: JSON.stringify({ position_ids: positionIds, is_hidden: isHidden }),
    }
  );
}

// ========== Privacy Settings ==========

/**
 * Get current privacy settings
 */
export async function getPrivacySettings(): Promise<PrivacySettings> {
  const result = await apiRequest<{ settings: PrivacySettings }>(
    "/privacy-settings"
  );
  return result.settings;
}

/**
 * Update privacy settings
 * @param settings Partial settings to update
 */
export async function updatePrivacySettings(
  settings: Partial<PrivacySettings>
): Promise<PrivacySettings> {
  const result = await apiRequest<{ settings: PrivacySettings }>(
    "/privacy-settings",
    {
      method: "PUT",
      body: JSON.stringify(settings),
    }
  );
  return result.settings;
}

// ========== Helper Functions ==========

/**
 * Calculate total portfolio value
 * Options are multiplied by 100 (each contract represents 100 shares)
 */
export function calculateTotalValue(holdings: SnapTradeHoldings): number {
  let total = 0;
  for (const account of holdings.accounts || []) {
    for (const position of account.snaptrade_positions || []) {
      if (position.price && position.units) {
        const multiplier = position.position_type === "option" ? 100 : 1;
        total += position.price * position.units * multiplier;
      }
    }
  }
  return total;
}

/**
 * Calculate total P&L
 * For options: always calculate from current value - cost basis (API returns 0)
 * For equities: use open_pnl if available
 */
export function calculateTotalPnL(holdings: SnapTradeHoldings): number {
  let total = 0;
  for (const account of holdings.accounts || []) {
    for (const position of account.snaptrade_positions || []) {
      if (position.position_type === "option") {
        // For options: calculate P&L from current value - cost basis
        if (position.price && position.average_purchase_price) {
          const currentValue = position.price * position.units * 100;
          const costBasis = position.average_purchase_price * position.units;
          total += currentValue - costBasis;
        }
      } else {
        // For equities: use open_pnl or calculate from average_purchase_price
        if (position.open_pnl !== undefined && position.open_pnl !== null) {
          total += position.open_pnl;
        } else if (position.price && position.average_purchase_price) {
          const currentValue = position.price * position.units;
          const costBasis = position.average_purchase_price * position.units;
          total += currentValue - costBasis;
        }
      }
    }
  }
  return total;
}

/**
 * Format currency
 */
export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Get share URL for a user's portfolio
 */
export function getShareUrl(userId: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/portfolio/${userId}`;
  }
  return `/portfolio/${userId}`;
}
