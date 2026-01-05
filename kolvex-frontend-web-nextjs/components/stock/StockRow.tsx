"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
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
import MiniSparkline from "@/components/stock/MiniSparkline";
import { Button } from "@/components/ui/button";
import { MessageSquare, Star, Users, Loader2 } from "lucide-react";
import { cn, proxyImageUrl } from "@/lib/utils";
import { createTrackedStock } from "@/lib/trackedStockApi";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

/** 统一的 TopAuthor 类型 - 兼容两种 API 格式 */
export interface StockRowAuthor {
  platform?: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  tweetCount: number;
  sentiment?: string | null;
}

/** StockRow 组件的变体模式 */
export type StockRowVariant = "trending" | "tracking";

/** StockRow Props */
export interface StockRowProps {
  /** 变体模式: trending (发现) | tracking (已追踪) */
  variant: StockRowVariant;

  // === 通用字段 ===
  /** 股票代码 */
  ticker: string;
  /** 公司名称 */
  companyName?: string;
  /** KOL 作者列表 */
  topAuthors?: StockRowAuthor[];
  /** 点击整行的回调 */
  onClick?: () => void;

  // === Trending 模式字段 ===
  /** 提及次数 */
  mentionCount?: number;
  /** 独立作者数 */
  uniqueAuthors?: number;
  /** 情感分数 (-100 ~ 100) */
  sentimentScore?: number;
  /** 热度分数 */
  trendingScore?: number;
  /** 是否已添加到追踪列表 */
  isTracked?: boolean;
  /** 追踪/取消追踪后的回调 */
  onTrackChange?: (tracked: boolean) => void;

  // === Tracking 模式字段 ===
  /** 当前价格 */
  price?: number;
  /** 涨跌幅百分比 */
  changePercent?: number;
  /** Sparkline 数据 */
  sparklineData?: number[];
  /** 是否正在取消追踪 */
  isUntracking?: boolean;
  /** 取消追踪回调 */
  onUntrack?: (e: MouseEvent) => void;
}

// ============================================================
// Helper Functions
// ============================================================

const getSentimentRingColor = (sentiment?: string | null) => {
  if (!sentiment) return "ring-gray-300 dark:ring-gray-600";
  if (sentiment === "bullish") return "ring-green-400 dark:ring-green-500";
  if (sentiment === "bearish") return "ring-red-400 dark:ring-red-500";
  return "ring-gray-300 dark:ring-gray-600";
};

// ============================================================
// Sub Components
// ============================================================

/** 股票信息单元格 (Logo + 名称) */
function StockInfoCell({
  ticker,
  companyName,
  onClick,
}: {
  ticker: string;
  companyName?: string;
  onClick?: () => void;
}) {
  return (
    <TableCell className="py-3 w-[140px] min-w-[140px]">
      <div
        className={cn("flex items-center gap-2.5", onClick && "cursor-pointer")}
        onClick={onClick}
      >
        <CompanyLogo symbol={ticker} name={companyName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {ticker}
          </div>
          {companyName && (
            <div className="text-[11px] text-gray-500 dark:text-white/50 truncate max-w-[80px]">
              {companyName}
            </div>
          )}
        </div>
      </div>
    </TableCell>
  );
}

/** Top Authors 单元格 (带 HoverCard) */
function TopAuthorsCell({
  authors,
  showHoverCard = true,
}: {
  authors: StockRowAuthor[];
  showHoverCard?: boolean;
}) {
  const router = useRouter();

  if (!authors || authors.length === 0) {
    return (
      <TableCell className="py-3 w-[120px]">
        <div className="flex justify-center">
          <span className="text-xs text-gray-400">-</span>
        </div>
      </TableCell>
    );
  }

  const avatarList = (
    <div className="flex items-center justify-center -space-x-2">
      {authors.slice(0, 4).map((author, idx) => (
        <div
          key={idx}
          className={cn(
            "relative rounded-full ring-2 ring-white dark:ring-gray-900 bg-gray-100 dark:bg-gray-800",
            getSentimentRingColor(author.sentiment)
          )}
          title={
            !showHoverCard
              ? `${author.displayName || author.username}: ${
                  author.tweetCount
                } tweets`
              : undefined
          }
        >
          <Avatar className="w-6 h-6">
            <AvatarImage
              src={proxyImageUrl(author.avatarUrl || "")}
              alt={author.username || ""}
            />
            <AvatarFallback className="text-[8px] bg-gray-200 dark:bg-gray-700">
              {author.username?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      ))}
      {authors.length > 4 && (
        <div className="relative w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-[10px] font-medium">
          +{authors.length - 4}
        </div>
      )}
    </div>
  );

  if (!showHoverCard) {
    return (
      <TableCell className="py-3 w-[120px] hidden md:table-cell">
        {avatarList}
      </TableCell>
    );
  }

  return (
    <TableCell className="py-3 w-[120px]">
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <div className="cursor-pointer">{avatarList}</div>
        </HoverCardTrigger>
        <HoverCardContent className="w-56 p-2" side="top" align="center">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              {authors.length} KOL{authors.length > 1 ? "s" : ""} discussing
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {authors.map((author, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-primary/10 transition-colors cursor-pointer"
                  onClick={() => {
                    if (author.platform) {
                      router.push(
                        `/dashboard/kol/${author.username}?platform=${author.platform}`
                      );
                    }
                  }}
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage
                      src={proxyImageUrl(author.avatarUrl || "")}
                      alt={author.username || ""}
                    />
                    <AvatarFallback className="text-[9px] bg-gray-200 dark:bg-gray-700">
                      {author.username?.[0]?.toUpperCase() || "?"}
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
  );
}

/** Star 按钮单元格 */
function StarButtonCell({
  variant,
  ticker,
  companyName,
  isTracked: initialTracked = false,
  isUntracking = false,
  onUntrack,
  onTrackChange,
}: {
  variant: StockRowVariant;
  ticker: string;
  companyName?: string;
  isTracked?: boolean;
  isUntracking?: boolean;
  onUntrack?: (e: MouseEvent) => void;
  onTrackChange?: (tracked: boolean) => void;
}) {
  const [isTracking, setIsTracking] = useState(false);
  const [isTracked, setIsTracked] = useState(initialTracked);

  // Tracking 模式：取消追踪
  if (variant === "tracking") {
    return (
      <TableCell className="py-3 w-[50px]">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-yellow-400 hover:text-yellow-500"
          onClick={onUntrack}
          disabled={isUntracking}
        >
          {isUntracking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Star className="h-4 w-4 fill-current" />
          )}
        </Button>
      </TableCell>
    );
  }

  // Trending 模式：添加追踪
  const handleTrack = async (e: MouseEvent) => {
    e.stopPropagation();
    if (isTracking || isTracked) return;

    setIsTracking(true);
    try {
      await createTrackedStock({ symbol: ticker, companyName });
      toast.success(`Added ${ticker} to watchlist`);
      setIsTracked(true);
      onTrackChange?.(true);
    } catch (err: any) {
      console.error("Error tracking stock:", err);
      toast.error(err.message || "Failed to add stock to watchlist");
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <TableCell className="py-3 w-[50px]">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleTrack}
        disabled={isTracking || isTracked}
        className={cn(
          "h-7 w-7 hover:text-yellow-400 transition-colors",
          isTracked && "text-yellow-400"
        )}
        title={isTracked ? "Already in watchlist" : "Add to watchlist"}
      >
        {isTracking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Star
            className={cn(
              "h-4 w-4 transition-all",
              isTracked && "fill-current"
            )}
          />
        )}
      </Button>
    </TableCell>
  );
}

// ============================================================
// Main Component
// ============================================================

export function StockRow(props: StockRowProps) {
  const {
    variant,
    ticker,
    companyName,
    topAuthors = [],
    onClick,
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

  const router = useRouter();
  const handleClick =
    onClick || (() => router.push(`/dashboard/stock/${ticker}`));

  // 转换 authors 格式
  const normalizedAuthors: StockRowAuthor[] = topAuthors.map((a: any) => ({
    platform: a.platform,
    username: a.username,
    displayName: a.displayName ?? a.display_name ?? undefined,
    avatarUrl: a.avatarUrl ?? a.avatar_url ?? undefined,
    tweetCount: a.tweetCount ?? a.tweet_count ?? 0,
    sentiment: a.sentiment,
  }));

  if (variant === "trending") {
    // ========== Trending 模式 ==========
    return (
      <TableRow className="hover:bg-muted/50 transition-colors">
        {/* Stock Info + Star */}
        <TableCell className="py-3 w-[160px] min-w-[160px]">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2.5 cursor-pointer flex-1"
              onClick={handleClick}
            >
              <CompanyLogo symbol={ticker} name={companyName} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {ticker}
                </div>
                {companyName && (
                  <div className="text-[11px] text-gray-500 dark:text-white/50 truncate max-w-[70px]">
                    {companyName}
                  </div>
                )}
              </div>
            </div>
            <StarButtonCell
              variant="trending"
              ticker={ticker}
              companyName={companyName}
              isTracked={isTracked}
              onTrackChange={onTrackChange}
            />
          </div>
        </TableCell>

        {/* Mentions */}
        <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 py-3 w-[90px]">
          <div className="flex items-center justify-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
            <span>{mentionCount ?? "-"}</span>
          </div>
        </TableCell>

        {/* Top Authors */}
        {normalizedAuthors.length > 0 ? (
          <TopAuthorsCell authors={normalizedAuthors} showHoverCard />
        ) : (
          <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 py-3 w-[120px]">
            <div className="flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              <span>{uniqueAuthors ?? "-"}</span>
            </div>
          </TableCell>
        )}

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

  // ========== Tracking 模式 ==========
  return (
    <TableRow className="hover:bg-muted/50 transition-colors">
      {/* Stock Info */}
      <StockInfoCell
        ticker={ticker}
        companyName={companyName}
        onClick={handleClick}
      />

      {/* Price */}
      <TableCell className="text-xs text-right font-semibold text-gray-900 dark:text-white py-3 w-[80px]">
        {price !== undefined ? `$${price.toFixed(2)}` : "-"}
      </TableCell>

      {/* Change Percent */}
      <TableCell className="text-xs text-right font-semibold py-3 w-[80px]">
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
      <TableCell className="py-3 hidden sm:table-cell w-[80px]">
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
      <TopAuthorsCell authors={normalizedAuthors} showHoverCard={false} />

      {/* Star (Untrack) */}
      <StarButtonCell
        variant="tracking"
        ticker={ticker}
        isUntracking={isUntracking}
        onUntrack={onUntrack}
      />
    </TableRow>
  );
}

export default StockRow;
