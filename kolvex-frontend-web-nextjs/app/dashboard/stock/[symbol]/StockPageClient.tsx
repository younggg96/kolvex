"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "next-themes";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TradingViewChart from "@/components/stock/TradingViewChart";
import StockInfoSkeleton from "@/components/stock/StockInfoSkeleton";
import StockInfoBoard from "@/components/stock/StockInfoBoard";
import {
  StockMobileHeader,
  StockMarketData,
  StockMobileStats,
  StockCompanyProfile,
  StockFinancialMetrics,
} from "@/components/stock/stock-detail";
import { Button } from "@/components/ui/button";
import type { StockOverview } from "@/lib/stockApi";
import {
  checkStockTracked,
  createTrackedStock,
  deleteTrackedStock,
} from "@/lib/trackedStockApi";
import { useStockOverview } from "@/hooks/useStockData";
import { toast } from "sonner";

type TrackedStatus = {
  is_tracked: boolean;
  stock_id: string | null;
};

interface StockPageClientProps {
  symbol: string;
  initialOverview: StockOverview | null;
  initialTracked: TrackedStatus;
}

export default function StockPageClient({
  symbol,
  initialOverview,
  initialTracked,
}: StockPageClientProps) {
  const router = useRouter();
  const { theme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  // Track button state
  const [isTracked, setIsTracked] = useState(initialTracked.is_tracked);
  const [trackingStockId, setTrackingStockId] = useState<string | null>(
    initialTracked.stock_id
  );
  const [isTrackLoading, setIsTrackLoading] = useState(false);

  // Client refresh for overview (SSR provides initialOverview)
  const {
    data: stockOverview,
    loading,
    error,
  } = useStockOverview(symbol, 30000, initialOverview);

  const quote = stockOverview?.quote;
  const company = stockOverview?.company;
  const financials = stockOverview?.financials;

  const checkTrackedStatus = useCallback(async () => {
    try {
      const result = await checkStockTracked(symbol);
      setIsTracked(result.is_tracked);
      setTrackingStockId(result.stock_id);
    } catch (e) {
      console.error("Failed to check tracked status:", e);
    }
  }, [symbol]);

  useEffect(() => {
    setMounted(true);
    setCanGoBack(window.history.length > 1);
    checkTrackedStatus();
  }, [checkTrackedStatus]);

  const handleToggleTrack = useCallback(async () => {
    if (isTrackLoading) return;

    setIsTrackLoading(true);
    try {
      if (isTracked && trackingStockId) {
        await deleteTrackedStock(trackingStockId);
        setIsTracked(false);
        setTrackingStockId(null);
        toast.success("Removed from watchlist");
      } else {
        const result = await createTrackedStock({
          symbol,
          companyName: quote?.name,
        });
        setIsTracked(true);
        setTrackingStockId(result.id);
        toast.success("Added to watchlist");
      }
    } catch (e) {
      toast.error(
        isTracked
          ? "Failed to remove from watchlist"
          : "Failed to add to watchlist"
      );
      console.error(e);
    } finally {
      setIsTrackLoading(false);
    }
  }, [isTrackLoading, isTracked, trackingStockId, symbol, quote?.name]);

  // Tracking state object for child components
  const trackingState = {
    isTracked,
    isLoading: isTrackLoading,
    onToggle: handleToggleTrack,
  };

  return (
    <DashboardLayout
      title={`${quote?.name || "Loading..."}`}
      hasSidebarTrigger={false}
      headerLeftAction={
        <Button
          onClick={() => {
            if (canGoBack) router.back();
            else router.push("/dashboard");
          }}
          variant="ghost"
          size="icon"
          className="flex items-center gap-2 h-8 w-8 sm:h-3.5 sm:w-3.5"
        >
          <ArrowLeft className="w-5 h-5 sm:w-4 sm:h-4" />
        </Button>
      }
    >
      <div className="flex-1 px-2 sm:px-3 py-2 overflow-y-auto">
        {/* Mobile: Stock Header Card */}
        {quote && <StockMobileHeader quote={quote} tracking={trackingState} />}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 sm:gap-3">
          {/* Main Chart Area */}
          {mounted ? (
            <div className="lg:col-span-3 space-y-2 sm:space-y-3">
              <div className="bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-2 sm:p-3 transition-colors duration-300">
                {/* TradingView Chart */}
                <div className="w-full h-[280px] sm:h-[350px] md:h-[450px] lg:h-[500px]">
                  <TradingViewChart
                    symbol={symbol}
                    theme={theme === "dark" ? "dark" : "light"}
                  />
                </div>
              </div>
              <StockInfoBoard ticker={symbol} />
            </div>
          ) : (
            <div className="lg:col-span-3 space-y-2 sm:space-y-3">
              {/* Chart Skeleton */}
              <div className="bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-2 sm:p-3 transition-colors duration-300">
                <div className="w-full h-[280px] sm:h-[350px] md:h-[450px] lg:h-[500px] animate-pulse bg-gray-200 dark:bg-white/10 rounded" />
              </div>
              {/* StockInfoBoard Skeleton */}
              <div className="bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-3 sm:p-4 transition-colors duration-300">
                <div className="animate-pulse space-y-3">
                  {/* Tabs skeleton */}
                  <div className="flex gap-2 border-b border-border-light dark:border-border-dark pb-2">
                    <div className="h-8 bg-gray-200 dark:bg-white/10 rounded w-24" />
                    <div className="h-8 bg-gray-200 dark:bg-white/10 rounded w-24" />
                    <div className="h-8 bg-gray-200 dark:bg-white/10 rounded w-24" />
                  </div>
                  {/* Content skeleton */}
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-full" />
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-5/6" />
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-4/6" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sidebar - Stock Info */}
          <div className="lg:col-span-1 space-y-2 sm:space-y-3">
            {loading && !quote ? (
              <StockInfoSkeleton />
            ) : (
              <>
                {/* Market Data Card - Desktop */}
                {quote && (
                  <StockMarketData
                    quote={quote}
                    tracking={trackingState}
                    error={error}
                  />
                )}

                {/* Error state when no quote */}
                {!quote && error && (
                  <div className="hidden lg:block bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-3 sm:p-4 transition-colors duration-300">
                    <div className="text-center text-red-500 text-sm py-4">
                      <p>Failed to load stock data</p>
                      <p className="text-xs mt-1 text-red-400">{error}</p>
                    </div>
                  </div>
                )}

                {/* Mobile: Detailed Stats */}
                {quote && <StockMobileStats quote={quote} />}

                {/* Company Profile Card */}
                {quote && company && <StockCompanyProfile company={company} />}

                {/* Financial Metrics Card */}
                {quote && financials && (
                  <StockFinancialMetrics financials={financials} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
