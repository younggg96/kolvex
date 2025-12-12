import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

export type TrackedStatus = {
  symbol: string;
  is_tracked: boolean;
  stock_id: string | null;
};

async function getServerAuthToken(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Server-side version of `checkStockTracked`.
 *
 * - Uses server Supabase session (cookies) to get access token.
 * - No-store to avoid caching user-specific state across requests.
 */
export async function checkStockTrackedServer(
  symbol: string
): Promise<TrackedStatus> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return { symbol: normalized, is_tracked: false, stock_id: null };
  }

  const token = await getServerAuthToken();
  if (!token) {
    return { symbol: normalized, is_tracked: false, stock_id: null };
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}${API_PREFIX}/stocks/tracked/check/${encodeURIComponent(
        normalized
      )}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      return { symbol: normalized, is_tracked: false, stock_id: null };
    }

    const json = (await res.json()) as TrackedStatus;
    return {
      symbol: json.symbol?.toUpperCase?.() ? json.symbol.toUpperCase() : normalized,
      is_tracked: Boolean(json.is_tracked),
      stock_id: json.stock_id ?? null,
    };
  } catch {
    return { symbol: normalized, is_tracked: false, stock_id: null };
  }
}


