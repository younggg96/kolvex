"use client";

import { Star, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatVolume } from "@/lib/stockApi";
import type { TrackingState, APIStockQuote } from "./types";

interface StockMobileHeaderProps {
  quote: APIStockQuote;
  tracking: TrackingState;
}

export default function StockMobileHeader({
  quote,
  tracking,
}: StockMobileHeaderProps) {
  const isPositive = (quote.change || 0) >= 0;

  return (
    <div className="lg:hidden mb-3">
      <div className="bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-4 transition-colors duration-300">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {quote.symbol}
              </h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={tracking.onToggle}
                disabled={tracking.isLoading}
                className={cn(
                  "h-8 w-8 p-0 rounded-full",
                  tracking.isTracked
                    ? "text-amber-500 bg-amber-500/10"
                    : "text-muted-foreground"
                )}
              >
                <Star
                  className={cn(
                    "w-4 h-4",
                    tracking.isTracked && "fill-current"
                  )}
                />
              </Button>
            </div>
            <p className="text-sm text-gray-500 dark:text-white/60 mt-0.5 line-clamp-1">
              {quote.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${quote.current_price?.toFixed(2)}
            </p>
            <div
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium mt-1",
                isPositive
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
              )}
            >
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>
                {isPositive ? "+" : ""}
                {quote.change?.toFixed(2)} ({quote.change_percent?.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Quick Stats */}
        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
          <div className="text-center">
            <p className="text-[10px] text-gray-500 dark:text-white/50 uppercase tracking-wide">
              Open
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
              ${quote.open?.toFixed(2) || "N/A"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 dark:text-white/50 uppercase tracking-wide">
              High
            </p>
            <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-0.5">
              ${quote.day_high?.toFixed(2) || "N/A"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 dark:text-white/50 uppercase tracking-wide">
              Low
            </p>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mt-0.5">
              ${quote.day_low?.toFixed(2) || "N/A"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 dark:text-white/50 uppercase tracking-wide">
              Vol
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
              {quote.volume ? formatVolume(quote.volume) : "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

