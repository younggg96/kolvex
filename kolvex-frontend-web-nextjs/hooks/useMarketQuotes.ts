"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCachedMarketQuotes, loadMarketQuotes } from "@/lib/marketQuotes";
import { peekClientCache, subscribeClientCacheWrites } from "@/lib/clientCache";
import { quoteKey } from "@/lib/quoteSnapshots";
import type { StockQuote } from "@/lib/stockApi";
import { useVisiblePolling } from "./useVisiblePolling";

/** The same per-symbol snapshots feed every list and single-stock reader. */
export function useMarketQuotes(symbols: readonly string[], enabled = true, refreshToken = 0, interval = 15_000) {
  const key = [...new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean))].sort().join(",");
  const [revision, setRevision] = useState(0);
  const force = useRef(false);
  const lastToken = useRef(refreshToken);
  const [state, setState] = useState(() => ({ key, quotes: getCachedMarketQuotes(key ? key.split(",") : []), loading: !!key, refreshing: false, unavailable: false }));
  const refresh = useCallback(() => { force.current = true; setRevision(value => value + 1); }, []);
  const revalidate = useCallback(() => setRevision(value => value + 1), []);
  useVisiblePolling(revalidate, interval, enabled && !!key);
  useEffect(() => {
    if (!enabled) return;
    const keys = new Map((key ? key.split(",") : []).map(symbol => [quoteKey(symbol), symbol]));
    return subscribeClientCacheWrites(changed => {
      const symbol = keys.get(changed);
      if (!symbol) return;
      const quote = peekClientCache<StockQuote>(changed);
      if (quote) setState(previous => previous.key === key ? { ...previous, quotes: { ...previous.quotes, [symbol]: quote } } : previous);
    });
  }, [key, enabled]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const requested = key ? key.split(",") : [];
    const cached = getCachedMarketQuotes(requested);
    const shouldForce = force.current || lastToken.current !== refreshToken;
    force.current = false;
    lastToken.current = refreshToken;
    setState(previous => ({ key, quotes: cached, loading: requested.some(symbol => !cached[symbol]), refreshing: !!key, unavailable: previous.key === key && previous.unavailable }));
    loadMarketQuotes(requested, controller.signal, () => {}, shouldForce).then(result => {
      if (!controller.signal.aborted) setState({ key, quotes: { ...result.quotes, ...getCachedMarketQuotes(requested) }, loading: false, refreshing: false, unavailable: result.unavailable });
    }).catch(() => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, refreshing: false, unavailable: true }));
    });
    return () => controller.abort();
  }, [key, enabled, revision, refreshToken]);
  const current = state.key === key ? state : { quotes: getCachedMarketQuotes(key ? key.split(",") : []), loading: !!key, refreshing: !!key, unavailable: false };
  return { ...current, loading: enabled && current.loading, refreshing: enabled && current.refreshing, refresh };
}
