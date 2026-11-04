"use client";

import { useCachedResource } from "./useCachedResource";
import { useVisiblePolling } from "./useVisiblePolling";
import { useMarketQuotes } from "./useMarketQuotes";
import { getStockQuote, type StockQuote, type ChartData, type StockOverview } from "@/lib/stockApi";

function useStockResource<T>(key: string, ttl: number, refreshInterval?: number, enabled = true, loader?: (signal: AbortSignal) => Promise<T>) {
  const resource = useCachedResource<T>(key, async signal => {
    if (!enabled) return [] as T;
    if (loader) return loader(signal);
    const response = await fetch(key, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Failed to fetch stock data");
    return response.json();
  }, { ttl, maxAge: Math.max(ttl, 60_000), enabled });
  const refresh = resource.refresh;
  useVisiblePolling(refresh, refreshInterval ?? 0, enabled);
  return { data: resource.data, loading: enabled && resource.loading, refreshing: enabled && resource.refreshing, refresh, error: resource.error ? resource.error instanceof Error ? resource.error.message : "Failed to fetch stock data" : null };
}

export function useStockQuote(symbol: string, refreshInterval = 15_000, enabled = true) {
  const normalized = symbol.trim().toUpperCase();
  const result = useStockResource<StockQuote>(`/api/stocks?action=quote&symbol=${encodeURIComponent(normalized)}`, 15_000, refreshInterval, enabled,
    signal => getStockQuote(normalized, signal));
  return { ...result, data: enabled && result.data?.symbol === normalized ? result.data : null };
}

export function useMultipleQuotes(symbols: string[], refreshInterval?: number) {
  const result = useMarketQuotes(symbols, true, 0, refreshInterval);
  return { ...result, data: Object.values(result.quotes), error: result.unavailable ? "Some quotes are unavailable" : null };
}

export function useChartData(symbol: string, interval = "5min") {
  const result = useStockResource<ChartData[]>(`/api/stocks?action=chart&symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`, 60_000);
  return { ...result, data: result.data ?? [] };
}

export function useStockOverview(symbol: string, refreshInterval?: number, initialData?: StockOverview | null) {
  const result = useStockResource<StockOverview>(`/api/stocks?action=overview&symbol=${encodeURIComponent(symbol)}`, 5 * 60_000, refreshInterval);
  return { ...result, data: result.data ?? initialData ?? null, loading: result.loading && !initialData };
}
