"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import {
  SentimentBadge,
  getSentimentType,
} from "@/components/ui/sentiment-badge";
import MiniSparkline from "@/components/stock/MiniSparkline";
import { MessageSquare, Users } from "lucide-react";

import type { StockRowProps, StockRowAuthor } from "./types";
import { normalizeAuthors } from "./utils";
import { StockInfo } from "./StockInfo";
import { TopAuthorsCell } from "./TopAuthorsCell";
import { TrackingStarButton } from "./TrackingStarButton";

// ============================================================
// Main Component
// ============================================================

export function StockRow(props: StockRowProps) {
  const {
    variant,
    ticker,
    companyName,
    topAuthors = [],
    // Trending fields
    mentionCount,
    uniqueAuthors,
    sentimentScore,
    trendingScore,
    isTracked,
    onTrackChange,
    // Tracking fields
    price,
    changePercent,
    sparklineData,
    isUntracking,
    onUntrack,
  } = props;

  // 转换 authors 格式
  const normalizedAuthors: StockRowAuthor[] = normalizeAuthors(topAuthors);

  if (variant === "trending") {
    // ========== Trending 模式 ==========
    return (
      <TableRow className="hover:bg-muted/50 transition-colors">
        {/* Stock Info + Star */}
        <TableCell className="w-[240px] flex items-center justify-between gap-2">
          <StockInfo ticker={ticker} companyName={companyName} />
          <TrackingStarButton
            variant="trending"
            ticker={ticker}
            companyName={companyName}
            isTracked={isTracked}
            onTrackChange={onTrackChange}
          />
        </TableCell>

        {/* Mentions */}
        <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 w-[90px]">
          <div className="flex items-center justify-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
            <span>{mentionCount ?? "-"}</span>
          </div>
        </TableCell>

        {/* Top Authors */}
        {normalizedAuthors.length > 0 ? (
          <TopAuthorsCell authors={normalizedAuthors} showHoverCard />
        ) : (
          <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 w-[120px]">
            <div className="flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              <span>{uniqueAuthors ?? "-"}</span>
            </div>
          </TableCell>
        )}

        {/* Sentiment */}
        <TableCell className="text-xs text-center font-bold w-[90px]">
          <SentimentBadge
            score={sentimentScore}
            size="sm"
            href={
              getSentimentType(sentimentScore)
                ? `/dashboard/stocks/sentiment/${getSentimentType(sentimentScore)}`
                : undefined
            }
          />
        </TableCell>

        {/* Trending Score */}
        <TableCell className="text-xs text-center font-bold text-gray-900 dark:text-white w-[90px]">
          {trendingScore?.toFixed(1) ?? "-"}
        </TableCell>
      </TableRow>
    );
  }

  // ========== Tracking 模式 ==========
  return (
    <TableRow className="hover:bg-muted/50 transition-colors">
      <TableCell className="w-[240px] flex items-center justify-between gap-2">
        <StockInfo ticker={ticker} companyName={companyName} />
        <TrackingStarButton
          variant="tracking"
          ticker={ticker}
          companyName={companyName}
          isUntracking={isUntracking}
          onUntrack={onUntrack}
        />
      </TableCell>

      {/* Price */}
      <TableCell className="text-xs text-right font-semibold text-gray-900 dark:text-white w-[160px]">
        {price !== undefined ? `$${price.toFixed(2)}` : "-"}
      </TableCell>

      {/* Change Percent */}
      <TableCell className="text-xs text-right font-semibold w-[160px]">
        {changePercent !== undefined ? (
          <span
            className={changePercent >= 0 ? "text-green-500" : "text-red-500"}
          >
            {changePercent >= 0 ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        ) : (
          "-"
        )}
      </TableCell>

      {/* Sparkline */}
      <TableCell className="hidden sm:table-cell w-[160px]">
        <div className="flex justify-center">
          {sparklineData && sparklineData.length > 0 ? (
            <MiniSparkline
              data={sparklineData}
              width={60}
              height={20}
              strokeWidth={1.2}
            />
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </div>
      </TableCell>

      {/* Top Authors */}
      <TopAuthorsCell authors={normalizedAuthors} showHoverCard={true} />
    </TableRow>
  );
}

export default StockRow;

