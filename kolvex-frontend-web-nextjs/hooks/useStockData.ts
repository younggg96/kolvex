"use client";

import { useEffect } from "react";
import { useCachedResource } from "./useCachedResource";
import type { StockQuote, ChartData, StockOverview } from "@/lib/stockApi";

function useStockResource<T>(key: string, ttl: number, refreshInterval?: number, enabled = true) {
  const resource = useCachedResource<T>(key, async signal => {
    if (!enabled) return [] as T;
    const response = await fetch(key, { signal });
    if (!response.ok) throw new Error("Failed to fetch stock data");
    return response.json();
  }, { ttl, maxAge: Math.max(ttl, 60_000) });
  const refresh = resource.refresh;
  useEffect(() => {
    if (!refreshInterval || !enabled) return;
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval, enabled, refresh]);
  return { data: resource.data, loading: enabled && resource.loading, error: resource.error ? resource.error instanceof Error ? resource.error.message : "Failed to fetch stock data" : null };
}

export function useStockQuote(symbol: string, refreshInterval?: number) {
  const result = useStockResource<StockQuote>(`/api/stocks?action=quote&symbol=${encodeURIComponent(symbol)}`, 15_000, refreshInterval);
  return { ...result, data: result.data ?? null };
}

export function useMultipleQuotes(symbols: string[], refreshInterval?: number) {
  const normalized = [...new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean))].sort();
  const result = useStockResource<StockQuote[]>(`/api/stocks?action=multiple&symbols=${encodeURIComponent(normalized.join(","))}`, 15_000, refreshInterval, normalized.length > 0);
  return { ...result, data: result.data ?? [] };
}

export function useChartData(symbol: string, interval = "5min") {
  const result = useStockResource<ChartData[]>(`/api/stocks?action=chart&symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`, 60_000);
  return { ...result, data: result.data ?? [] };
}

export function useStockOverview(symbol: string, refreshInterval?: number, initialData?: StockOverview | null) {
  const result = useStockResource<StockOverview>(`/api/stocks?action=overview&symbol=${encodeURIComponent(symbol)}`, 5 * 60_000, refreshInterval);
  return { ...result, data: result.data ?? initialData ?? null, loading: result.loading && !initialData };
}
