"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CompanyLogo from "@/components/stock/CompanyLogo";
import { MessageSquare, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TopAuthor,
  getSentimentColor,
  getPriceChangeColor,
  getSentimentRingColor,
} from "./types";

export interface TrendingStockItemProps {
  ticker: string;
  mentionCount?: number;
  sentimentScore?: number;
  trendingScore?: number;
  uniqueAuthors?: number;
  price?: number;
  changePercent?: number;
  logoUrl?: string | null;
  companyName?: string;
  topAuthors?: TopAuthor[];
  showMetrics?: boolean;
  isTracked: boolean;
  onTrackToggle: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export function TrendingStockItem({
  ticker,
  mentionCount,
  sentimentScore,
  trendingScore,
  uniqueAuthors,
  price,
  changePercent,
  companyName,
  topAuthors,
  showMetrics = true,
  isTracked,
  onTrackToggle,
  onClick,
}: TrendingStockItemProps) {
  return (
    <TableRow
      onClick={onClick}
      className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 cursor-pointer group"
    >
      {/* Stock Info */}
      <TableCell className="py-3 w-[140px] min-w-[140px]">
        <div className="flex items-center justify-start gap-2">
          <CompanyLogo symbol={ticker} name={companyName} size="sm" />
          <div className="min-w-0 text-left flex-1">
            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {ticker}
            </div>
            {companyName && (
              <div className="text-[11px] text-gray-500 dark:text-white/50 truncate max-w-[70px]">
                {companyName}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 flex-shrink-0 transition-opacity",
              isTracked
                ? "opacity-100 text-yellow-400 hover:text-yellow-500"
                : "opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            )}
            onClick={onTrackToggle}
          >
            <Star className={cn("h-4 w-4", isTracked && "fill-current")} />
          </Button>
        </div>
      </TableCell>

      {/* Price or Mentions */}
      {price !== undefined ? (
        <TableCell className="text-xs text-right font-semibold text-gray-900 dark:text-white py-3">
          ${price.toFixed(2)}
        </TableCell>
      ) : showMetrics && mentionCount !== undefined ? (
        <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 py-3 w-[90px]">
          <div className="flex items-center justify-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
            <span>{mentionCount}</span>
          </div>
        </TableCell>
      ) : null}

      {/* Change or Top Authors */}
      {changePercent !== undefined ? (
        <TableCell className="text-xs text-right font-semibold py-3">
          <span className={getPriceChangeColor(changePercent)}>
            {changePercent >= 0 ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        </TableCell>
      ) : showMetrics && topAuthors && topAuthors.length > 0 ? (
        <TableCell className="py-3 w-[120px]">
          <div className="flex items-center justify-center">
            <div className="flex -space-x-2">
              {topAuthors.slice(0, 4).map((author, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "relative rounded-full ring-offset-0 ring-2 ring-white dark:ring-gray-900 bg-gray-100 dark:bg-gray-800",
                    getSentimentRingColor(author.sentiment)
                  )}
                  title={`${author.displayName || author.username}: ${author.tweetCount} tweets (${author.sentiment || "neutral"})`}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={author.avatarUrl} alt={author.username} />
                    <AvatarFallback className="text-[8px] bg-gray-200 dark:bg-gray-700">
                      {author.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              ))}
              {topAuthors.length > 4 && (
                <div className="relative w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-[10px] font-medium text-text-light dark:text-text-dark">
                  +{topAuthors.length - 4}
                </div>
              )}
            </div>
          </div>
        </TableCell>
      ) : showMetrics && uniqueAuthors !== undefined ? (
        <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 py-3 w-[120px]">
          <div className="flex items-center justify-center gap-1">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span>{uniqueAuthors}</span>
          </div>
        </TableCell>
      ) : null}

      {/* Sentiment */}
      {showMetrics && sentimentScore !== undefined && (
        <TableCell className="text-xs text-center font-bold py-3 w-[90px]">
          <span className={getSentimentColor(sentimentScore)}>
            {sentimentScore > 0 ? "+" : ""}
            {sentimentScore.toFixed(0)}
          </span>
        </TableCell>
      )}

      {/* Trending Score */}
      {showMetrics && trendingScore !== undefined && (
        <TableCell className="text-xs text-center font-bold text-gray-900 dark:text-white py-3 w-[90px]">
          {trendingScore.toFixed(1)}
        </TableCell>
      )}
    </TableRow>
  );
}

