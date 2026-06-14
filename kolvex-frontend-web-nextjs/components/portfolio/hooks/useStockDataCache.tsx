"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import type { StockOverview } from "@/lib/stockApi";

// Cache TTL: 1 hour in milliseconds
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface StockDataCacheState {
  // Sector data: symbol -> sector name
  sectors: Map<string, CacheEntry<string>>;
  // Sparkline data: symbol -> price values array
  sparklines: Map<string, CacheEntry<number[]>>;
  // Overview data: symbol -> full overview
  overviews: Map<string, CacheEntry<StockOverview>>;
}

interface StockDataCacheContextValue {
  // Get cached sector for a symbol
  getCachedSector: (symbol: string) => string | null;
  // Get cached sparkline for a symbol
  getCachedSparkline: (symbol: string) => number[] | null;
  // Get cached overview for a symbol
  getCachedOverview: (symbol: string) => StockOverview | null;

  // Fetch sector data for multiple symbols (uses cache if valid)
  fetchSectors: (symbols: string[], forceRefresh?: boolean) => Promise<Map<string, string>>;
  // Fetch sparkline data for multiple symbols (uses cache if valid)
  fetchSparklines: (symbols: string[], forceRefresh?: boolean) => Promise<Map<string, number[]>>;
  // Fetch overview data for a symbol (uses cache if valid)
  fetchOverview: (symbol: string, forceRefresh?: boolean) => Promise<StockOverview | null>;

  // Force refresh all cached data for given symbols
  refreshAllData: (symbols: string[]) => Promise<void>;

  // Check if data is being fetched
  isLoading: boolean;

  // Last refresh timestamp
  lastRefreshTime: number | null;

  // Clear all cache
  clearCache: () => void;
}

const StockDataCacheContext = createContext<StockDataCacheContextValue | null>(null);

interface StockDataCacheProviderProps {
  children: ReactNode;
}

export function StockDataCacheProvider({ children }: StockDataCacheProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);

  // Use refs for cache to avoid re-renders on cache updates
  const cacheRef = useRef<StockDataCacheState>({
    sectors: new Map(),
    sparklines: new Map(),
    overviews: new Map(),
  });

  // Check if cache entry is valid (not expired)
  const isValidCache = useCallback((entry: CacheEntry<unknown> | undefined): boolean => {
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
  }, []);

  // Normalize symbol for consistent cache keys
  const normalizeSymbol = useCallback((symbol: string): string => {
    return symbol.trim().toUpperCase();
  }, []);

  // Get cached sector
  const getCachedSector = useCallback((symbol: string): string | null => {
    const key = normalizeSymbol(symbol);
    const entry = cacheRef.current.sectors.get(key);
    return isValidCache(entry) ? entry!.data : null;
  }, [normalizeSymbol, isValidCache]);

  // Get cached sparkline
  const getCachedSparkline = useCallback((symbol: string): number[] | null => {
    const key = normalizeSymbol(symbol);
    const entry = cacheRef.current.sparklines.get(key);
    return isValidCache(entry) ? entry!.data : null;
  }, [normalizeSymbol, isValidCache]);

  // Get cached overview
  const getCachedOverview = useCallback((symbol: string): StockOverview | null => {
    const key = normalizeSymbol(symbol);
    const entry = cacheRef.current.overviews.get(key);
    return isValidCache(entry) ? entry!.data : null;
  }, [normalizeSymbol, isValidCache]);

  // Fetch sectors for multiple symbols
  const fetchSectors = useCallback(async (
    symbols: string[],
    forceRefresh = false
  ): Promise<Map<string, string>> => {
    const result = new Map<string, string>();
    const symbolsToFetch: string[] = [];

    // Check cache first
    for (const sym of symbols) {
      const key = normalizeSymbol(sym);
      const cached = getCachedSector(key);
      if (!forceRefresh && cached) {
        result.set(key, cached);
      } else {
        symbolsToFetch.push(key);
      }
    }

    // Fetch missing symbols in batches
    if (symbolsToFetch.length > 0) {
      setIsLoading(true);
      const batchSize = 5;

      try {
        for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
          const batch = symbolsToFetch.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (symbol) => {
              try {
                const res = await fetch(`/api/stocks?action=overview&symbol=${symbol}`);
                if (res.ok) {
                  const data: StockOverview = await res.json();
                  const now = Date.now();

                  // Cache the overview
                  cacheRef.current.overviews.set(symbol, {
                    data,
                    timestamp: now,
                  });

                  // Cache the sector
                  if (data.company?.sector) {
                    cacheRef.current.sectors.set(symbol, {
                      data: data.company.sector,
                      timestamp: now,
                    });
                    result.set(symbol, data.company.sector);
                  }
                }
              } catch (error) {
                console.error(`Failed to fetch sector for ${symbol}:`, error);
              }
            })
          );
        }
        setLastRefreshTime(Date.now());
      } finally {
        setIsLoading(false);
      }
    }

    return result;
  }, [normalizeSymbol, getCachedSector]);

  // Fetch sparklines for multiple symbols
  const fetchSparklines = useCallback(async (
    symbols: string[],
    forceRefresh = false
  ): Promise<Map<string, number[]>> => {
    const result = new Map<string, number[]>();
    const symbolsToFetch: string[] = [];

    // Check cache first
    for (const sym of symbols) {
      const key = normalizeSymbol(sym);
      const cached = getCachedSparkline(key);
      if (!forceRefresh && cached) {
        result.set(key, cached);
      } else {
        symbolsToFetch.push(key);
      }
    }

    // Fetch missing symbols in parallel
    if (symbolsToFetch.length > 0) {
      setIsLoading(true);

      try {
        await Promise.all(
          symbolsToFetch.map(async (symbol) => {
            try {
              const res = await fetch(`/api/stocks?action=chart&symbol=${symbol}&interval=5m`);
              if (res.ok) {
                const data = await res.json();
                const values = data.map((d: { value: number }) => d.value);
                const now = Date.now();

                // Cache the sparkline
                cacheRef.current.sparklines.set(symbol, {
                  data: values,
                  timestamp: now,
                });
                result.set(symbol, values);
              }
            } catch (error) {
              console.error(`Failed to fetch sparkline for ${symbol}:`, error);
            }
          })
        );
        setLastRefreshTime(Date.now());
      } finally {
        setIsLoading(false);
      }
    }

    return result;
  }, [normalizeSymbol, getCachedSparkline]);

  // Fetch single overview
  const fetchOverview = useCallback(async (
    symbol: string,
    forceRefresh = false
  ): Promise<StockOverview | null> => {
    const key = normalizeSymbol(symbol);
    const cached = getCachedOverview(key);

    if (!forceRefresh && cached) {
      return cached;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/stocks?action=overview&symbol=${key}`);
      if (res.ok) {
        const data: StockOverview = await res.json();
        const now = Date.now();

        // Cache everything
        cacheRef.current.overviews.set(key, { data, timestamp: now });
        if (data.company?.sector) {
          cacheRef.current.sectors.set(key, {
            data: data.company.sector,
            timestamp: now,
          });
        }
        setLastRefreshTime(now);
        return data;
      }
    } catch (error) {
      console.error(`Failed to fetch overview for ${key}:`, error);
    } finally {
      setIsLoading(false);
    }

    return null;
  }, [normalizeSymbol, getCachedOverview]);

  // Force refresh all data for given symbols
  const refreshAllData = useCallback(async (symbols: string[]): Promise<void> => {
    const normalizedSymbols = symbols.map(normalizeSymbol);

    setIsLoading(true);
    try {
      // Fetch all data in parallel with force refresh
      await Promise.all([
        fetchSectors(normalizedSymbols, true),
        fetchSparklines(normalizedSymbols, true),
      ]);
      setLastRefreshTime(Date.now());
    } finally {
      setIsLoading(false);
    }
  }, [normalizeSymbol, fetchSectors, fetchSparklines]);

  // Clear all cache
  const clearCache = useCallback(() => {
    cacheRef.current = {
      sectors: new Map(),
      sparklines: new Map(),
      overviews: new Map(),
    };
    setLastRefreshTime(null);
  }, []);

  const value: StockDataCacheContextValue = {
    getCachedSector,
    getCachedSparkline,
    getCachedOverview,
    fetchSectors,
    fetchSparklines,
    fetchOverview,
    refreshAllData,
    isLoading,
    lastRefreshTime,
    clearCache,
  };

  return (
    <StockDataCacheContext.Provider value={value}>
      {children}
    </StockDataCacheContext.Provider>
  );
}

export function useStockDataCache(): StockDataCacheContextValue {
  const context = useContext(StockDataCacheContext);
  if (!context) {
    throw new Error("useStockDataCache must be used within StockDataCacheProvider");
  }
  return context;
}

// Helper hook to get all symbols from holdings - memoized to prevent infinite loops
export function usePortfolioSymbols(
  accounts:
    | Array<{
        portfolio_positions?: Array<{
          symbol: string;
          underlying_symbol?: string | null;
          position_type?: string;
          is_hidden?: boolean;
        }>;
      }>
    | undefined
): string[] {
  return useMemo(() => {
    if (!accounts) return [];

    const symbols = new Set<string>();
    accounts.forEach((account) => {
      account.portfolio_positions?.forEach((pos) => {
        if (pos.is_hidden) return;
        const symbol =
          pos.position_type === "option"
            ? pos.underlying_symbol || pos.symbol
            : pos.symbol;
        if (symbol) symbols.add(symbol.trim().toUpperCase());
      });
    });

    return Array.from(symbols);
  }, [accounts]);
}
