"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import TradingViewChart from "@/components/stock/TradingViewChart";
import { useStockOverview } from "@/hooks/useStockData";
import { useTheme } from "next-themes";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import StockDiscussions from "@/components/stock/StockDiscussions";
import { formatMarketCap, formatVolume } from "@/lib/stockApi";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import StockInfoSkeleton from "@/components/stock/StockInfoSkeleton";
import {
  checkStockTracked,
  createTrackedStock,
  deleteTrackedStock,
} from "@/lib/trackedStockApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StockPageProps {
  params: {
    symbol: string;
  };
}

export default function StockPage({ params }: StockPageProps) {
  const router = useRouter();
  const symbol = params.symbol.toUpperCase();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  // Track button state
  const [isTracked, setIsTracked] = useState(false);
  const [trackingStockId, setTrackingStockId] = useState<string | null>(null);
  const [isTrackLoading, setIsTrackLoading] = useState(false);

  // Company profile expansion state
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);

  // Fetch stock overview data (quote, company, financials)
  const {
    data: stockOverview,
    loading,
    error,
  } = useStockOverview(symbol, 30000);

  const quote = stockOverview?.quote;
  const company = stockOverview?.company;
  const financials = stockOverview?.financials;

  // Check if stock is tracked on mount
  const checkTrackedStatus = useCallback(async () => {
    try {
      const result = await checkStockTracked(symbol);
      setIsTracked(result.is_tracked);
      setTrackingStockId(result.stock_id);
    } catch (error) {
      console.error("Failed to check tracked status:", error);
    }
  }, [symbol]);

  useEffect(() => {
    setMounted(true);
    const hasHistory = window.history.length > 1;
    setCanGoBack(hasHistory);
    checkTrackedStatus();
  }, [checkTrackedStatus]);

  // Handle track/untrack
  const handleToggleTrack = async () => {
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
    } catch (error) {
      toast.error(
        isTracked
          ? "Failed to remove from watchlist"
          : "Failed to add to watchlist"
      );
      console.error(error);
    } finally {
      setIsTrackLoading(false);
    }
  };

  const isPositive = quote ? (quote.change || 0) >= 0 : true;

  return (
    <DashboardLayout
      title={`${quote?.name || "Loading..."}`}
      headerLeftAction={
        <Button
          onClick={() => {
            if (canGoBack) {
              router.back();
            } else {
              router.push("/dashboard");
            }
          }}
          variant="ghost"
          size="icon"
          className="flex items-center gap-2 h-3.5 w-3.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
      }
    >
      <div className="flex-1 p-2 overflow-y-auto">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-2">
          {/* Main Chart Area */}
          <div className="xl:col-span-3 space-y-2">
            <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark p-3 transition-colors duration-300">
              {/* TradingView Chart */}
              {mounted && (
                <div className="w-full h-[350px] md:h-[500px]">
                  <TradingViewChart
                    symbol={symbol}
                    theme={theme === "dark" ? "dark" : "light"}
                  />
                </div>
              )}
            </div>

            {/* KOL Discussions Section */}
            {mounted && <StockDiscussions ticker={symbol} />}
          </div>

          {/* Sidebar - Stock Info */}
          <div className="xl:col-span-1 space-y-2">
            {loading && !quote ? (
              <StockInfoSkeleton />
            ) : (
              <>
                {/* Market Data Card */}
                <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark p-3 transition-colors duration-300">
                  {quote ? (
                    <div className="space-y-4">
                      {/* Main Price Info */}
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                              {quote.symbol}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-white/60">
                              {quote.name}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={handleToggleTrack}
                            disabled={isTrackLoading}
                            className={cn(
                              "h-7 gap-1",
                              isTracked
                                ? "text-amber-500 hover:text-amber-600"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Star
                              className={cn(
                                "w-3.5 h-3.5",
                                isTracked && "fill-current"
                              )}
                            />
                            <span className="text-xs">
                              {isTracked ? "Tracking" : "Track"}
                            </span>
                          </Button>
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className="text-xl font-bold text-gray-900 dark:text-white">
                            ${quote.current_price?.toFixed(2)}
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              isPositive ? "text-green-500" : "text-red-500"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {quote.change?.toFixed(2)} (
                            {quote.change_percent?.toFixed(2)}%)
                          </span>
                        </div>
                      </div>

                      {/* Key Statistics Grid */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                        <div>
                          <p className="text-[12px] text-gray-500 dark:text-white/50 mb-0.5">
                            Open
                          </p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                            {quote.open ? `$${quote.open.toFixed(2)}` : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[12px] text-gray-500 dark:text-white/50 mb-0.5">
                            Prev Close
                          </p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                            {quote.previous_close
                              ? `$${quote.previous_close.toFixed(2)}`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[12px] text-gray-500 dark:text-white/50 mb-0.5">
                            High
                          </p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                            {quote.day_high
                              ? `$${quote.day_high.toFixed(2)}`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-white/50 mb-0.5">
                            Low
                          </p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                            {quote.day_low
                              ? `$${quote.day_low.toFixed(2)}`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-white/50 mb-0.5">
                            52W High
                          </p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                            {quote.fifty_two_week_high
                              ? `$${quote.fifty_two_week_high.toFixed(2)}`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-white/50 mb-0.5">
                            52W Low
                          </p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                            {quote.fifty_two_week_low
                              ? `$${quote.fifty_two_week_low.toFixed(2)}`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-white/50 mb-0.5">
                            Volume
                          </p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                            {quote.volume ? formatVolume(quote.volume) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-white/50 mb-0.5">
                            Avg Volume
                          </p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                            {quote.avg_volume
                              ? formatVolume(quote.avg_volume)
                              : "N/A"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] text-gray-500 dark:text-white/50 mb-0.5">
                            Market Cap
                          </p>
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                            {quote.market_cap
                              ? formatMarketCap(quote.market_cap)
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="text-center text-red-500 text-xs">
                      <p>Failed to load stock data</p>
                      <p className="text-[10px] mt-1">{error}</p>
                    </div>
                  ) : null}
                </div>

                {/* Company Profile Card */}
                {quote && company && (
                  <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
                    <Accordion
                      type="single"
                      collapsible
                      defaultValue="company-profile"
                      className="w-full"
                    >
                      <AccordionItem
                        value="company-profile"
                        className="!border-b-0"
                      >
                        <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-gray-50 dark:hover:bg-white/5">
                          <span className="text-xs font-semibold text-gray-900 dark:text-white">
                            Company Profile
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3">
                          {/* Summary */}
                          <div className="mb-3">
                            <p
                              className={cn(
                                "text-xs text-gray-600 dark:text-gray-300 leading-relaxed",
                                !isProfileExpanded && "line-clamp-3"
                              )}
                            >
                              {company.business_summary}
                            </p>
                            {company.business_summary &&
                              company.business_summary.length > 150 && (
                                <button
                                  onClick={() =>
                                    setIsProfileExpanded(!isProfileExpanded)
                                  }
                                  className="mt-1.5 text-[11px] text-primary hover:text-primary/80 font-medium"
                                >
                                  {isProfileExpanded
                                    ? "Show less"
                                    : "Show more"}
                                </button>
                              )}
                          </div>

                          {/* Key Info */}
                          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-white/5">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                Sector
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {company.sector}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                Industry
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {company.industry}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                Website
                              </span>
                              {company.website ? (
                                <a
                                  href={company.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-medium text-blue-500 hover:text-blue-600"
                                >
                                  {company.website.replace(/^https?:\/\//, "")}
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  N/A
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                Employees
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {company.employees?.toLocaleString() || "N/A"}
                              </span>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}

                {/* Financial Metrics Card */}
                {quote && financials && (
                  <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
                    <Accordion
                      type="single"
                      collapsible
                      defaultValue="financial-metrics"
                      className="w-full"
                    >
                      <AccordionItem
                        value="financial-metrics"
                        className="!border-b-0"
                      >
                        <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-gray-50 dark:hover:bg-white/5">
                          <span className="text-xs font-semibold text-gray-900 dark:text-white">
                            Financial Metrics
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                P/E Ratio
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {financials.pe_ratio?.toFixed(2) || "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                EPS (TTM)
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {financials.eps_trailing?.toFixed(2) || "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                Revenue (TTM)
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {financials.total_revenue
                                  ? formatMarketCap(financials.total_revenue)
                                  : "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                Profit Margin
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {financials.profit_margins
                                  ? `${(
                                      financials.profit_margins * 100
                                    ).toFixed(2)}%`
                                  : "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                Price to Book
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {financials.price_to_book?.toFixed(2) || "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                Return on Equity
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {financials.return_on_equity
                                  ? `${(
                                      financials.return_on_equity * 100
                                    ).toFixed(2)}%`
                                  : "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                Total Cash
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {financials.total_cash
                                  ? formatMarketCap(financials.total_cash)
                                  : "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                                Total Debt
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {financials.total_debt
                                  ? formatMarketCap(financials.total_debt)
                                  : "N/A"}
                              </span>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
