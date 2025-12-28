"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMarketCap, formatVolume } from "@/lib/stockApi";
import type { TrackingState, APIStockQuote } from "./types";

interface StockMarketDataProps {
  quote: APIStockQuote;
  tracking: TrackingState;
  error?: string | null;
}

export default function StockMarketData({
  quote,
  tracking,
  error,
}: StockMarketDataProps) {
  const isPositive = (quote.change || 0) >= 0;

  if (error) {
    return (
      <div className="hidden lg:block bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-3 sm:p-4 transition-colors duration-300">
        <div className="text-center text-red-500 text-sm py-4">
          <p>Failed to load stock data</p>
          <p className="text-xs mt-1 text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden lg:block bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-3 sm:p-4 transition-colors duration-300">
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
              onClick={tracking.onToggle}
              disabled={tracking.isLoading}
              className={cn(
                "h-8 gap-1.5 px-2",
                tracking.isTracked
                  ? "text-amber-500 hover:text-amber-600"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Star
                className={cn(
                  "w-4 h-4",
                  tracking.isTracked && "fill-current"
                )}
              />
              <span className="text-xs">
                {tracking.isTracked ? "Tracking" : "Track"}
              </span>
            </Button>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              ${quote.current_price?.toFixed(2)}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                isPositive ? "text-green-500" : "text-red-500"
              )}
            >
              {isPositive ? "+" : ""}
              {quote.change?.toFixed(2)} ({quote.change_percent?.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Key Statistics Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <p className="text-[11px] text-gray-500 dark:text-white/50 mb-0.5">
              Open
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {quote.open ? `$${quote.open.toFixed(2)}` : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 dark:text-white/50 mb-0.5">
              Prev Close
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {quote.previous_close
                ? `$${quote.previous_close.toFixed(2)}`
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 dark:text-white/50 mb-0.5">
              High
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {quote.day_high ? `$${quote.day_high.toFixed(2)}` : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 dark:text-white/50 mb-0.5">
              Low
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {quote.day_low ? `$${quote.day_low.toFixed(2)}` : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 dark:text-white/50 mb-0.5">
              52W High
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {quote.fifty_two_week_high
                ? `$${quote.fifty_two_week_high.toFixed(2)}`
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 dark:text-white/50 mb-0.5">
              52W Low
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {quote.fifty_two_week_low
                ? `$${quote.fifty_two_week_low.toFixed(2)}`
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 dark:text-white/50 mb-0.5">
              Volume
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {quote.volume ? formatVolume(quote.volume) : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 dark:text-white/50 mb-0.5">
              Avg Volume
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {quote.avg_volume ? formatVolume(quote.avg_volume) : "N/A"}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[11px] text-gray-500 dark:text-white/50 mb-0.5">
              Market Cap
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {quote.market_cap ? formatMarketCap(quote.market_cap) : "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

