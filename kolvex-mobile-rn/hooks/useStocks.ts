/**
 * Hooks for stock data fetching
 */
import { useCallback } from 'react';
import { useApi } from './useApi';
import { stockApi, marketApi } from '@/lib/api';
import type { StockQuote, StockOverview } from '@/lib/types';

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
