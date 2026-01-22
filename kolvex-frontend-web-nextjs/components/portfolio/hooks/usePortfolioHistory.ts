import { useState, useCallback } from "react";
import {
  getPortfolioHistory,
  type PortfolioHistoryResponse,
} from "@/lib/snaptradeApi";

// ============================================================
// Types
// ============================================================

export type PerformancePeriod = "1D" | "1W" | "1M" | "3M" | "YTD" | "ALL";

export interface PerformanceDataPoint {
  date: string;
  displayDate: string;
  value: number;
  pnl: number;
  pnlPercent: number;
}

export interface PerformanceSummary {
  startValue: number;
  endValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  highValue: number;
  lowValue: number;
  dataPoints: number;
}

export interface UsePortfolioHistoryResult {
  data: PerformanceDataPoint[];
  summary: PerformanceSummary | null;
  loading: boolean;
  error: string | null;
  period: PerformancePeriod;
  setPeriod: (period: PerformancePeriod) => void;
  refresh: () => Promise<void>;
  /** Whether the data is from real historical snapshots */
  hasRealData: boolean;
  /** Date of first available real snapshot */
  firstSnapshotDate: string | null;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Format date for display based on period
 */
function formatDisplayDate(dateStr: string, period: PerformancePeriod): string {
  const date = new Date(dateStr);
  
  switch (period) {
    case "1D":
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    case "1W":
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    case "1M":
    case "3M":
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    case "YTD":
    case "ALL":
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    default:
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
  }
}

// ============================================================
// Hook
// ============================================================

export function usePortfolioHistory(): UsePortfolioHistoryResult {
  const [period, setPeriod] = useState<PerformancePeriod>("1M");
  const [data, setData] = useState<PerformanceDataPoint[]>([]);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRealData, setHasRealData] = useState(false);
  const [firstSnapshotDate, setFirstSnapshotDate] = useState<string | null>(null);
  const [cache, setCache] = useState<Map<string, PortfolioHistoryResponse>>(new Map());

  // Fetch history data from backend
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      const cached = cache.get(period);
      let response: PortfolioHistoryResponse;

      if (cached) {
        response = cached;
      } else {
        // Fetch from API
        response = await getPortfolioHistory(period);
        
        // Cache the response
        setCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(period, response);
          return newCache;
        });
      }

      setFirstSnapshotDate(response.first_snapshot_date);

      if (response.has_real_data && response.data.length > 0) {
        const dataPoints = response.data.map((d) => ({
          date: d.date,
          displayDate: formatDisplayDate(d.date, period),
          value: d.value,
          pnl: d.pnl,
          pnlPercent: d.pnl_percent,
        }));

        const values = dataPoints.map((d) => d.value);
        const summaryData: PerformanceSummary = {
          startValue: values[0],
          endValue: values[values.length - 1],
          totalPnL: values[values.length - 1] - values[0],
          totalPnLPercent: values[0] > 0 ? ((values[values.length - 1] - values[0]) / values[0]) * 100 : 0,
          highValue: Math.max(...values),
          lowValue: Math.min(...values),
          dataPoints: values.length,
        };

        setData(dataPoints);
        setSummary(summaryData);
        setHasRealData(true);
      } else {
        // No real data available
        setData([]);
        setSummary(null);
        setHasRealData(false);
      }
    } catch (err) {
      console.error("Failed to fetch portfolio history:", err);
      setError(err instanceof Error ? err.message : "Failed to load history");
      setData([]);
      setSummary(null);
      setHasRealData(false);
    } finally {
      setLoading(false);
    }
  }, [period, cache]);

  // Handle period change
  const handleSetPeriod = useCallback((newPeriod: PerformancePeriod) => {
    setPeriod(newPeriod);
  }, []);

  // Refresh data (bypasses cache)
  const refresh = useCallback(async () => {
    // Clear cache for current period
    setCache((prev) => {
      const newCache = new Map(prev);
      newCache.delete(period);
      return newCache;
    });

    await fetchHistory();
  }, [period, fetchHistory]);

  return {
    data,
    summary,
    loading,
    error,
    period,
    setPeriod: handleSetPeriod,
    refresh,
    hasRealData,
    firstSnapshotDate,
  };
}
