"use client";

import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  SentimentBadge,
  getSentimentType,
} from "@/components/ui/sentiment-badge";
import CompanyLogo from "@/components/ui/company-logo";
import { MessageSquare, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { TopAuthor, getSentimentRingColor } from "./types";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { createTrackedStock } from "@/lib/trackedStockApi";
import { toast } from "sonner";

export interface TrendingStockItemProps {
  ticker: string;
  mentionCount?: number;
  sentimentScore?: number;
  trendingScore?: number;
  uniqueAuthors?: number;
  logoUrl?: string | null;
  companyName?: string;
  topAuthors?: TopAuthor[];
}

export function TrendingStockItem({
  ticker,
  mentionCount,
  sentimentScore,
  trendingScore,
  uniqueAuthors,
  companyName,
  topAuthors,
}: TrendingStockItemProps) {
  const router = useRouter();
  const [isTracking, setIsTracking] = useState(false);
  const [isTracked, setIsTracked] = useState(false);

  const trackStock = async (e: React.MouseEvent, ticker: string) => {
    e.stopPropagation();

    if (isTracking || isTracked) return;
    setIsTracking(true);

    try {
      await createTrackedStock({
        symbol: ticker,
        companyName: companyName,
      });
      toast.success(`Added ${ticker} to watchlist`);
      setIsTracked(true);
    } catch (err: any) {
      console.error("Error tracking stock:", err);
      toast.error(err.message || "Failed to add stock to watchlist");
    } finally {
      setIsTracking(false);
    }
  };
  return (
    <TableRow>
      {/* Stock Info */}
      <TableCell className="py-3 w-[140px] min-w-[140px]">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => {
            router.push(`/dashboard/stock/${ticker}`);
          }}
        >
          <CompanyLogo symbol={ticker} name={companyName} size="sm" />
          <div className="min-w-0 flex-1">
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
            onClick={(e) => trackStock(e, ticker)}
            disabled={isTracking || isTracked}
            className={cn(
              "hover:text-yellow-400 transition-colors",
              isTracked && "text-yellow-400"
            )}
            title={isTracked ? "Already in watchlist" : "Add to watchlist"}
          >
            <Star
              className={cn(
                "w-3.5 h-3.5 transition-all",
                isTracked && "fill-current",
                isTracking && "text-gray-300"
              )}
            />
          </Button>
        </div>
      </TableCell>

      {/* Mentions */}
      {mentionCount !== undefined && (
        <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 py-3 w-[90px]">
          <div className="flex items-center justify-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
            <span>{mentionCount}</span>
          </div>
        </TableCell>
      )}

      {/* Top Authors */}
      {topAuthors && topAuthors.length > 0 ? (
        <TableCell className="py-3 w-[120px]">
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div className="flex items-center justify-center -space-x-2 cursor-pointer">
                {topAuthors.slice(0, 4).map((author, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "relative rounded-full ring-2 ring-white dark:ring-gray-900 bg-gray-100 dark:bg-gray-800",
                      getSentimentRingColor(author.sentiment)
                    )}
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarImage
                        src={author.avatarUrl}
                        alt={author.username}
                      />
                      <AvatarFallback className="text-[8px] bg-gray-200 dark:bg-gray-700">
                        {author.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                ))}
                {topAuthors.length > 4 && (
                  <div className="relative w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-[10px] font-medium">
                    +{topAuthors.length - 4}
                  </div>
                )}
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-56 p-2" side="top" align="center">
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {topAuthors.length} KOL{topAuthors.length > 1 ? "s" : ""}{" "}
                  discussing
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {topAuthors.map((author, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-primary/10 transition-colors cursor-pointer"
                      onClick={() => {
                        router.push(`/dashboard/kol/${author.username}`);
                      }}
                    >
                      <Avatar className="w-7 h-7">
                        <AvatarImage
                          src={author.avatarUrl}
                          alt={author.username}
                        />
                        <AvatarFallback className="text-[9px] bg-gray-200 dark:bg-gray-700">
                          {author.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {author.displayName || author.username}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          {author.tweetCount} tweet
                          {author.tweetCount > 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </TableCell>
      ) : uniqueAuthors !== undefined ? (
        <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 py-3 w-[120px]">
          <div className="flex items-center justify-center gap-1">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span>{uniqueAuthors}</span>
          </div>
        </TableCell>
      ) : null}

      {/* Sentiment */}
      <TableCell className="text-xs text-center font-bold py-3 w-[90px]">
        <SentimentBadge
          score={sentimentScore}
          size="sm"
          href={
            getSentimentType(sentimentScore)
              ? `/dashboard/stocks/sentiment/${getSentimentType(
                  sentimentScore
                )}`
              : undefined
          }
        />
      </TableCell>

      {/* Trending Score */}
      <TableCell className="text-xs text-center font-bold text-gray-900 dark:text-white py-3 w-[90px]">
        {trendingScore?.toFixed(1) ?? "-"}
      </TableCell>
    </TableRow>
  );
}
