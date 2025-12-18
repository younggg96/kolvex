import type { StockOverview } from "@/lib/stockApi";

const NEXT_PUBLIC_BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8000";

/**
 * Server-side fetcher for stock overview.
 *
 * - Uses Next fetch caching (revalidate) since this data is not user-specific.
 * - Returns null on failure (caller can decide how to render).
 */
export async function getStockOverviewServer(
  symbol: string
): Promise<StockOverview | null> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return null;

  try {
    const res = await fetch(
      `${NEXT_PUBLIC_BACKEND_API_URL}/api/v1/market/overview/${encodeURIComponent(
        normalized
      )}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    return (await res.json()) as StockOverview;
  } catch {
    return null;
  }
}
