"use client";

import { useCallback, useEffect, useState } from "react";
import { getStockNews, type StockNewsItem } from "@/lib/stockApi";

export function useStockNews(ticker: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    ticker: string; articles: StockNewsItem[]; loading: boolean; error: boolean; updatedAt: Date | null;
  }>({ ticker, articles: [], loading: true, error: false, updatedAt: null });

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    async function load() {
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
        const articles = await getStockNews(ticker, request.signal);
        if (active) setState({ ticker, articles, loading: false, error: false, updatedAt: new Date() });
      } catch {
        if (active) setState(previous => ({ ...previous, loading: false, error: true }));
      } finally {
        clearTimeout(timeout);
        controller = null;
      }
    }
    void load();
    const refreshVisible = () => { if (!document.hidden) void load(); };
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
  }, [ticker, attempt]);

  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  return {
    ...(state.ticker === ticker ? state : { articles: [], loading: true, error: false, updatedAt: null }),
    refresh,
  };
}
