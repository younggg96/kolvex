"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getTrackedStocks,
  createTrackedStock,
  deleteTrackedStock,
} from "@/lib/trackedStockApi";
import { toast } from "sonner";
import { TrendingStock } from "@/app/api/trending-stocks/route";

// Hook for managing tracked stocks
export function useTrackedStocks(
  externalMap?: Map<string, string>,
  onTrackedStocksChange?: () => void
) {
  const { user } = useAuth();
  const [internalTrackedStocks, setInternalTrackedStocks] = useState<
    Map<string, string>
  >(new Map());

  const trackedStocks = externalMap || internalTrackedStocks;

  useEffect(() => {
    if (user && !externalMap) {
      getTrackedStocks()
        .then((stocks) => {
          const map = new Map();
          stocks.forEach((s) => map.set(s.symbol, s.id));
          setInternalTrackedStocks(map);
        })
        .catch(console.error);
    }
  }, [user, externalMap]);

  const handleTrackToggle = useCallback(
    async (
      e: React.MouseEvent,
      ticker: string,
      companyName?: string,
      logoUrl?: string
    ) => {
      e.stopPropagation();
      if (!user) {
        toast.error("Please login to track stocks");
        return;
      }

      try {
        if (trackedStocks.has(ticker)) {
          const id = trackedStocks.get(ticker);
          if (id) {
            await deleteTrackedStock(id);
            if (onTrackedStocksChange) {
              onTrackedStocksChange();
            } else {
              setInternalTrackedStocks((prev) => {
                const next = new Map(prev);
                next.delete(ticker);
                return next;
              });
            }
            toast.success(`Removed ${ticker} from watchlist`);
          }
        } else {
          const newStock = await createTrackedStock({
            symbol: ticker,
            companyName,
            logo: logoUrl || undefined,
            notify: true,
          });
          if (onTrackedStocksChange) {
            onTrackedStocksChange();
          } else {
            setInternalTrackedStocks((prev) => {
              const next = new Map(prev);
              next.set(ticker, newStock.id);
              return next;
            });
          }
          toast.success(`Added ${ticker} to watchlist`);
        }
      } catch (err) {
        console.error("Failed to toggle track:", err);
        toast.error("Failed to update watchlist");
      }
    },
    [user, trackedStocks, onTrackedStocksChange]
  );

  return { trackedStocks, handleTrackToggle };
}

// Hook for fetching trending stocks from API with pagination
export function useTrendingStocksApi(fetchFromApi: boolean, limit = 10) {
  const [trendingStocks, setTrendingStocks] = useState<TrendingStock[]>([]);
  const [loading, setLoading] = useState(fetchFromApi);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchTrendingStocks = useCallback(
    async (reset: boolean = false) => {
      if (!fetchFromApi) return;

      const targetPage = reset ? 1 : page;

      try {
        if (reset) {
          setLoading(true);
        } else {
          setIsLoadingMore(true);
        }

        const response = await fetch(
          `/api/trending-stocks?page=${targetPage}&page_size=${limit}&sort_by=trending_score&sort_direction=desc`
        );

        if (!response.ok) throw new Error("Failed to fetch trending stocks");

        const data = await response.json();
        const newStocks = data.stocks || [];

        if (reset) {
          setTrendingStocks(newStocks);
          setPage(2);
        } else {
          setTrendingStocks((prev) => [...prev, ...newStocks]);
          setPage((p) => p + 1);
        }

        setHasMore(data.has_more ?? newStocks.length === limit);
      } catch (err) {
        console.error("Error fetching trending stocks:", err);
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [fetchFromApi, page, limit]
  );

  // Initial fetch and refresh interval
  useEffect(() => {
    if (!fetchFromApi) return;

    setTrendingStocks([]);
    setPage(1);
    setHasMore(true);
    fetchTrendingStocks(true);

    const interval = setInterval(() => fetchTrendingStocks(true), 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFromApi]);

  const fetchMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchTrendingStocks(false);
    }
  }, [isLoadingMore, hasMore, fetchTrendingStocks]);

  return {
    trendingStocks,
    loading,
    isLoadingMore,
    hasMore,
    fetchMore,
  };
}

