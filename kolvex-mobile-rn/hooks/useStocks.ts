/**
 * Hooks for stock data fetching
 */
import { useCallback } from 'react';
import { useApi, usePaginatedApi } from './useApi';
import { stockApi, marketApi } from '@/lib/api';
import type { TrendingStock, TrendingStocksResponse, StockQuote, StockOverview, StockDiscussionsResponse } from '@/lib/types';

/** Fetch trending stocks - extracts the stocks array from the response */
export function useTrendingStocks() {
  const fetcher = useCallback(
    () => stockApi.getTrending().then(res => res.stocks),
    []
  );
  return useApi<TrendingStock[]>(fetcher);
}

/** Fetch a single stock quote */
export function useStockQuote(symbol: string) {
  const fetcher = useCallback(() => marketApi.getQuote(symbol), [symbol]);
  return useApi<StockQuote>(fetcher, { deps: [symbol] });
}

/** Fetch stock overview (quote + company info) */
export function useStockOverview(symbol: string) {
  const fetcher = useCallback(() => marketApi.getOverview(symbol), [symbol]);
  return useApi<StockOverview>(fetcher, { deps: [symbol] });
}

/** Fetch stock discussions from KOLs */
export function useStockDiscussions(ticker: string) {
  const fetcher = useCallback(
    (page: number, pageSize: number) =>
      stockApi.getDiscussions(ticker, { page, page_size: pageSize }).then(res => ({
        items: res.tweets,
        total: res.total_tweets,
        hasMore: res.has_more,
      })),
    [ticker]
  );
  return usePaginatedApi(fetcher, { pageSize: 15 });
}

/** Check if a stock is tracked */
export function useTrackedStockCheck(symbol: string) {
  const fetcher = useCallback(() => stockApi.checkTracked(symbol), [symbol]);
  return useApi<{ is_tracked: boolean; stock_id?: string }>(fetcher, { deps: [symbol] });
}

/** Fetch user's tracked stocks */
export function useTrackedStocks() {
  const fetcher = useCallback(() => stockApi.getTracked(), []);
  return useApi(fetcher);
}
