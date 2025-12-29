"use client";

import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { StockPerformance } from "./types";
import { formatTimeAgo } from "./utils";

interface StockRowProps {
  performance: StockPerformance;
  onSelect: () => void;
  isSelected: boolean;
}

export function StockRow({ performance, onSelect, isSelected }: StockRowProps) {
  const bullishCount = performance.predictions.filter(
    (p) => p.sentiment === "bullish"
  ).length;
  const bearishCount = performance.predictions.filter(
    (p) => p.sentiment === "bearish"
  ).length;
  const overallSentiment =
    bullishCount > bearishCount
      ? "bullish"
      : bearishCount > bullishCount
      ? "bearish"
      : "neutral";

  const latestDate = performance.predictions[0]?.predictedAt;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200",
        "border",
        isSelected
          ? "bg-primary/5 dark:bg-primary/10 border-primary/30 dark:border-primary/30"
          : "border-gray-100 dark:border-white/5 hover:border-primary/20 dark:hover:border-primary/20 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
      )}
    >
      {/* Ticker */}
      <Link
        href={`/dashboard/stock/${performance.ticker}`}
        onClick={(e) => e.stopPropagation()}
        className="min-w-[52px]"
      >
        <span className="font-mono font-bold text-sm text-gray-900 dark:text-white hover:text-primary transition-colors">
          ${performance.ticker}
        </span>
      </Link>

      {/* Sentiment Badge */}
      <div className="flex-shrink-0">
        {overallSentiment === "bullish" ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-500/10">
            <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
            <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
              Bull
            </span>
          </div>
        ) : overallSentiment === "bearish" ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10">
            <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
              Bear
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5">
            <Minus className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Neut
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex-1 flex items-center gap-2 text-xs text-gray-500 dark:text-white/50">
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {performance.predictions.length}
        </span>
        {latestDate && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(latestDate)}
          </span>
        )}
      </div>

      {/* Price Change */}
      {performance.priceChange7d !== undefined && (
        <div
          className={cn(
            "text-xs font-medium tabular-nums px-1.5 py-0.5 rounded",
            performance.priceChange7d >= 0
              ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10"
              : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10"
          )}
        >
          {performance.priceChange7d >= 0 ? "+" : ""}
          {performance.priceChange7d.toFixed(1)}%
        </div>
      )}

      {/* Match Status */}
      <div className="flex-shrink-0">
        {performance.isMatch === true ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : performance.isMatch === false ? (
          <XCircle className="w-4 h-4 text-red-500" />
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300 dark:border-white/20" />
        )}
      </div>

      {/* Arrow */}
      <ChevronRight
        className={cn(
          "w-4 h-4 text-gray-400 dark:text-white/40 transition-transform",
          isSelected && "rotate-90"
        )}
      />
    </div>
  );
}

