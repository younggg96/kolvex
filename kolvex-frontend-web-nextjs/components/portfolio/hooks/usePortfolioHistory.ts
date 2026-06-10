import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

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
  valueChange: number;
  valueChangePercent: number;
  startPnL: number;
  endPnL: number;
  pnlChange: number;
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

interface UsePortfolioHistoryOptions {
  /** User ID to fetch history for. If not provided, fetches current user's history */
  userId?: string;
}

interface SnapshotRow {
  snapshot_date: string;
  total_value: number;
  unrealized_pnl: number | null;
  unrealized_pnl_percent: number | null;
  positions_count: number | null;
  calculation_version: number | null;
}

const SNAPSHOT_COLUMNS =
  "snapshot_date, total_value, unrealized_pnl, unrealized_pnl_percent, positions_count, calculation_version";
const LEGACY_SNAPSHOT_COLUMNS =
  "snapshot_date, total_value, unrealized_pnl, unrealized_pnl_percent, positions_count";

function isMissingCalculationVersionError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const message = (error.message || "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    (message.includes("calculation_version") &&
      (message.includes("schema cache") || message.includes("could not find")))
  );
}

async function fetchSnapshotRows(
  userId: string,
  startDate: string,
): Promise<SnapshotRow[]> {
  const supabase = createClient();
  const currentSchemaResult = await supabase
    .from("portfolio_snapshots")
    .select(SNAPSHOT_COLUMNS)
    .eq("user_id", userId)
    .gte("calculation_version", 2)
    .gte("snapshot_date", startDate)
    .order("snapshot_date", { ascending: true });

  if (!currentSchemaResult.error) {
    return (currentSchemaResult.data || []) as SnapshotRow[];
  }

  if (!isMissingCalculationVersionError(currentSchemaResult.error)) {
    throw new Error(currentSchemaResult.error.message);
  }

  console.warn(
    "portfolio_snapshots.calculation_version is unavailable; using legacy snapshots until the migration is applied.",
  );
  const legacyResult = await supabase
    .from("portfolio_snapshots")
    .select(LEGACY_SNAPSHOT_COLUMNS)
    .eq("user_id", userId)
    .gte("snapshot_date", startDate)
    .order("snapshot_date", { ascending: true });

  if (legacyResult.error) {
    throw new Error(legacyResult.error.message);
  }

  return (legacyResult.data || []).map((snapshot) => ({
    ...snapshot,
    calculation_version: null,
  })) as SnapshotRow[];
}

// ============================================================
// Module-level Cache (persists across page navigations)
// ============================================================

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  snapshots: SnapshotRow[];
  timestamp: number;
}

/** Global cache map: keyed by "userId-period" */
const globalCache = new Map<string, CacheEntry>();

function getCachedSnapshots(key: string): SnapshotRow[] | null {
  const entry = globalCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    globalCache.delete(key);
    return null;
  }
  return entry.snapshots;
}

function setCachedSnapshots(key: string, snapshots: SnapshotRow[]): void {
  globalCache.set(key, { snapshots, timestamp: Date.now() });
}

function invalidateCache(key: string): void {
  globalCache.delete(key);
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

/**
 * Calculate the start date based on period
 */
function getStartDate(period: PerformancePeriod): Date {
  const now = new Date();
  
  switch (period) {
    case "1D":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "1W":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "1M":
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "3M":
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "YTD":
      return new Date(now.getFullYear(), 0, 1);
    case "ALL":
    default:
      return new Date(2000, 0, 1); // Far past date
  }
}

// ============================================================
// Hook
// ============================================================

export function usePortfolioHistory(
  options: UsePortfolioHistoryOptions = {}
): UsePortfolioHistoryResult {
  const { userId } = options;
  
  const [period, setPeriod] = useState<PerformancePeriod>("1W");
  const [data, setData] = useState<PerformanceDataPoint[]>([]);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRealData, setHasRealData] = useState(false);
  const [firstSnapshotDate, setFirstSnapshotDate] = useState<string | null>(null);

  // Use ref to track firstSnapshotDate without adding it to callback deps
  const firstSnapshotDateRef = useRef<string | null>(null);
  
  // Process snapshots into display data and summary
  const processSnapshots = useCallback((snapshots: SnapshotRow[], currentPeriod: PerformancePeriod) => {
    // Track first snapshot date
    if (!firstSnapshotDateRef.current && snapshots.length > 0) {
      firstSnapshotDateRef.current = snapshots[0].snapshot_date;
      setFirstSnapshotDate(snapshots[0].snapshot_date);
    }

    if (snapshots.length > 0) {
      const dataPoints = snapshots.map((s) => ({
        date: s.snapshot_date,
        displayDate: formatDisplayDate(s.snapshot_date, currentPeriod),
        value: Number(s.total_value) || 0,
        pnl: Number(s.unrealized_pnl) || 0,
        pnlPercent: Number(s.unrealized_pnl_percent) || 0,
      }));

      const values = dataPoints.map((d) => d.value);
      const first = dataPoints[0];
      const last = dataPoints[dataPoints.length - 1];
      const summaryData: PerformanceSummary = {
        startValue: first.value,
        endValue: last.value,
        valueChange: last.value - first.value,
        valueChangePercent:
          first.value > 0
            ? ((last.value - first.value) / first.value) * 100
            : 0,
        startPnL: first.pnl,
        endPnL: last.pnl,
        pnlChange: last.pnl - first.pnl,
        totalPnL: last.pnl,
        totalPnLPercent: last.pnlPercent,
        highValue: Math.max(...values),
        lowValue: Math.min(...values),
        dataPoints: values.length,
      };

      setData(dataPoints);
      setSummary(summaryData);
      setHasRealData(true);
    } else {
      setData([]);
      setSummary(null);
      setHasRealData(false);
    }
  }, []);

  // Fetch history data directly from Supabase
  const fetchHistory = useCallback(async () => {
    if (!userId) {
      setData([]);
      setSummary(null);
      setHasRealData(false);
      return;
    }

    const cacheKey = `${userId}-${period}`;

    // Check global cache first — if hit, restore data synchronously (no loading flash)
    const cached = getCachedSnapshots(cacheKey);
    if (cached) {
      processSnapshots(cached, period);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startDate = getStartDate(period);
      const snapshots = await fetchSnapshotRows(
        userId,
        startDate.toISOString().split("T")[0],
      );
      
      // Store in global cache
      setCachedSnapshots(cacheKey, snapshots);

      processSnapshots(snapshots, period);
    } catch (err) {
      console.error("Failed to fetch portfolio history:", err);
      setError(err instanceof Error ? err.message : "Failed to load history");
      setData([]);
      setSummary(null);
      setHasRealData(false);
    } finally {
      setLoading(false);
    }
  }, [userId, period, processSnapshots]);

  // Fetch data when userId or period changes
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Handle period change
  const handleSetPeriod = useCallback((newPeriod: PerformancePeriod) => {
    setPeriod(newPeriod);
  }, []);

  // Refresh data (bypasses global cache)
  const refresh = useCallback(async () => {
    if (!userId) return;
    
    // Invalidate global cache for current period
    invalidateCache(`${userId}-${period}`);

    setLoading(true);
    setError(null);

    try {
      const startDate = getStartDate(period);
      const snapshots = await fetchSnapshotRows(
        userId,
        startDate.toISOString().split("T")[0],
      );
      setCachedSnapshots(`${userId}-${period}`, snapshots);
      processSnapshots(snapshots, period);
    } catch (err) {
      console.error("Failed to refresh portfolio history:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh history");
    } finally {
      setLoading(false);
    }
  }, [userId, period, processSnapshots]);

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
