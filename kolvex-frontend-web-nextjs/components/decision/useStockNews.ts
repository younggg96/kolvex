"use client";
import { loadClientCache, peekClientCache } from "@/lib/clientCache";

import { useCallback, useEffect, useState } from "react";
import { getStockNews, type StockNewsItem } from "@/lib/stockApi";

export function useStockNews(ticker: string) {
  const key = `/api/market/news/${encodeURIComponent(ticker)}`;
  const saved = peekClientCache<{ articles: StockNewsItem[]; checkedAt: number }>(key);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    ticker: string; articles: StockNewsItem[]; loading: boolean; error: boolean; updatedAt: Date | null;
  }>({ ticker, articles: saved?.articles ?? [], loading: !saved, error: false, updatedAt: saved ? new Date(saved.checkedAt) : null });

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    async function load(force = false) {
      if (controller) return;
      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(() => request.abort(), 20_000);
      setState(previous => ({
        ticker, articles: previous.ticker === ticker ? previous.articles : [],
        updatedAt: previous.ticker === ticker ? previous.updatedAt : null,
        loading: true, error: false,
      }));
      try {
        const result = await loadClientCache(key, async signal => ({ articles: await getStockNews(ticker, signal), checkedAt: Date.now() }), { ttl: 60_000, force, signal: request.signal });
        if (active) setState({ ticker, articles: result.articles, loading: false, error: false, updatedAt: new Date(result.checkedAt) });
      } catch {
        if (active) setState(previous => ({ ...previous, loading: false, error: true }));
      } finally {
        clearTimeout(timeout);
        controller = null;
      }
    }
    void load(attempt > 0);
    const refreshVisible = () => { if (!document.hidden) void load(true); };
    const timer = setInterval(refreshVisible, 300_000);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("online", refreshVisible);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("online", refreshVisible);
    };
  }, [ticker, attempt, key]);

  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  return {
    ...(state.ticker === ticker ? state : { articles: saved?.articles ?? [], loading: !saved, error: false, updatedAt: saved ? new Date(saved.checkedAt) : null }),
    refresh,
  };
}
