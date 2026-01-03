"use client";

import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { StockPerformance } from "./types";
import { formatTimeAgo } from "./utils";

interface StockDetailProps {
  performance: StockPerformance;
}

export function StockDetail({ performance }: StockDetailProps) {
  const bullishCount = performance.predictions.filter(
    (p) => p.sentiment === "bullish"
  ).length;
  const bearishCount = performance.predictions.filter(
    (p) => p.sentiment === "bearish"
  ).length;
  const neutralCount =
    performance.predictions.length - bullishCount - bearishCount;

  return (
    <div className="mt-2 ml-4 p-4 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 space-y-4">
      {/* Sentiment Distribution */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/50 font-medium mb-2">
          Sentiment Distribution
        </p>
        <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-white/10">
          {bullishCount > 0 && (
            <div
              className="bg-green-500 transition-all rounded-l-full"
              style={{
                width: `${
                  (bullishCount / performance.predictions.length) * 100
                }%`,
              }}
            />
          )}
          {neutralCount > 0 && (
            <div
              className="bg-gray-400 transition-all"
              style={{
                width: `${
                  (neutralCount / performance.predictions.length) * 100
                }%`,
              }}
            />
          )}
          {bearishCount > 0 && (
            <div
              className="bg-red-500 transition-all rounded-r-full"
              style={{
                width: `${
                  (bearishCount / performance.predictions.length) * 100
                }%`,
              }}
            />
          )}
        </div>
        <div className="flex justify-between mt-2 text-[10px]">
          <span className="text-green-600 dark:text-green-400 font-medium">
            {bullishCount} Bullish
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {neutralCount} Neutral
          </span>
          <span className="text-red-600 dark:text-red-400 font-medium">
            {bearishCount} Bearish
          </span>
        </div>
      </div>

      {/* Recent Mentions */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-white/50 font-medium mb-2">
          Recent Mentions
        </p>
        <div className="space-y-2">
          {performance.predictions.slice(0, 3).map((pred) => (
            <div
              key={pred.postId}
              className="flex gap-2 p-2.5 rounded-lg bg-white dark:bg-black/20 border border-gray-100 dark:border-white/5"
            >
              <div className="mt-0.5 flex-shrink-0">
                {pred.sentiment === "bullish" ? (
                  <div className="w-5 h-5 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
                  </div>
                ) : pred.sentiment === "bearish" ? (
                  <div className="w-5 h-5 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                    <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                    <Minus className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 dark:text-white/80 line-clamp-2 leading-relaxed">
                  {pred.postContent.length > 120
                    ? pred.postContent.slice(0, 120) + "..."
                    : pred.postContent}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-gray-400 dark:text-white/40">
                    {formatTimeAgo(pred.predictedAt)}
                  </span>
                  {pred.confidence && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 h-4 border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50"
                    >
                      {Math.round(pred.confidence * 100)}% conf
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {performance.predictions.length > 3 && (
          <p className="text-[10px] text-center text-gray-400 dark:text-white/40 mt-3">
            +{performance.predictions.length - 3} more mentions
          </p>
        )}
      </div>
    </div>
  );
}

