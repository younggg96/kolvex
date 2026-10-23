"use client";

import { useEffect, useState } from "react";
import {
  getCachedStockPerformance,
  loadStockPerformance,
  type StockPerformance,
} from "@/lib/stockPerformance";

/**
 * Actual recent performance for a list of tickers.
 *
 * Cached values are seeded synchronously so revisits render instantly, then
 * missing tickers stream in batch by batch. The effect is keyed on the joined
 * ticker list only, so passing a fresh array with the same contents does not
 * refetch. Empty tickers never hit the network.
 */
export function useStockPerformance(tickers: string[]): {
  performance: Record<string, StockPerformance>;
  loading: boolean;
  error: boolean;
} {
  const tickerKey = tickers.join("|");
  const [performance, setPerformance] = useState<
    Record<string, StockPerformance>
  >(() => getCachedStockPerformance(tickers));
  const [loading, setLoading] = useState(tickers.length > 0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const symbols = tickerKey ? tickerKey.split("|") : [];
    if (!symbols.length) {
      setPerformance({});
      setLoading(false);
      setError(false);
      return;
    }

    const controller = new AbortController();
    setPerformance(getCachedStockPerformance(symbols));
    setLoading(true);
    setError(false);

    loadStockPerformance(symbols, {
      signal: controller.signal,
      onBatch: (batch) => {
        if (controller.signal.aborted) return;
        setPerformance((previous) => ({ ...previous, ...batch }));
      },
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setPerformance(result);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if ((cause as { name?: string } | null)?.name === "AbortError") return;
        setLoading(false);
        // The loader only rejects when nothing at all could be loaded.
        setError(true);
      });

    return () => controller.abort();
  }, [tickerKey]);

  return { performance, loading, error };
}
