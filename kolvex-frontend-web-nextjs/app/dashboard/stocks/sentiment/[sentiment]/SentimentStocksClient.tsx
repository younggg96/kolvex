"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TrendingStock, SortBy } from "@/app/api/trending-stocks/route";
import { TrendingStockItem } from "@/components/trending-stocks/TrendingStockItem";
import {
  TrendingStockSkeleton,
  LoadingMoreRow,
  NoMoreDataRow,
} from "@/components/trending-stocks/TrendingStockSkeleton";
import { SectionCard } from "@/components/layout";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SentimentType = "bullish" | "bearish";

const PAGE_SIZE = 20;
const SCROLL_THRESHOLD = 100;

type SortDirection = "asc" | "desc";

interface SortConfig {
  key: SortBy | null;
  direction: SortDirection | null;
}

interface SentimentStocksClientProps {
  sentiment: SentimentType;
}

const sentimentConfig: Record<
  SentimentType,
  {
    title: string;
    icon: typeof TrendingUp;
    color: string;
    bgColor: string;
    description: string;
  }
> = {
  bullish: {
    title: "Bullish Stocks",
    icon: TrendingUp,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-500/10",
    description: "Stocks with positive sentiment from KOL discussions",
  },
  bearish: {
    title: "Bearish Stocks",
    icon: TrendingDown,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-500/10",
    description: "Stocks with negative sentiment from KOL discussions",
  },
};

export default function SentimentStocksClient({
  sentiment,
}: SentimentStocksClientProps) {
  const router = useRouter();
  const [stocks, setStocks] = useState<TrendingStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "sentiment_score",
    direction: sentiment === "bearish" ? "asc" : "desc",
  });
  const isFetching = useRef(false);

  const config = sentimentConfig[sentiment];
  const Icon = config.icon;

  const fetchStocks = useCallback(
    async (pageNum: number, sort: SortConfig, isInitial = false) => {
      if (isFetching.current && !isInitial) return;
      isFetching.current = true;

      if (isInitial) setLoading(true);

      try {
        const sortKey = sort.key ?? "sentiment_score";
        const sortDir =
          sort.direction ?? (sentiment === "bearish" ? "asc" : "desc");
        const url = `/api/stocks/sentiment/${sentiment}?page=${pageNum}&page_size=${PAGE_SIZE}&sort_by=${sortKey}&sort_direction=${sortDir}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();
        const newStocks: TrendingStock[] = data.stocks || [];

        setStocks((prev) => (isInitial ? newStocks : [...prev, ...newStocks]));
        setHasMore(data.has_more ?? false);
      } catch (err) {
        console.error("Error fetching stocks:", err);
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
        isFetching.current = false;
      }
    },
    [sentiment]
  );

  useEffect(() => {
    setPage(1);
    setStocks([]);
    setHasMore(true);
    fetchStocks(1, sortConfig, true);
  }, [sentiment]);

  const handleSort = useCallback(
    (key: SortBy) => {
      setSortConfig((current) => {
        if (current.key === key) {
          if (current.direction === "desc") {
            const newConfig: SortConfig = { key, direction: "asc" };
            setPage(1);
            setStocks([]);
            fetchStocks(1, newConfig, true);
            return newConfig;
          } else {
            const newConfig: SortConfig = { key: null, direction: "desc" };
            setPage(1);
            setStocks([]);
            fetchStocks(1, newConfig, true);
            return newConfig;
          }
        } else {
          const newConfig: SortConfig = { key, direction: "desc" };
          setPage(1);
          setStocks([]);
          fetchStocks(1, newConfig, true);
          return newConfig;
        }
      });
    },
    [fetchStocks]
  );

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isFetching.current) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchStocks(nextPage, sortConfig);
  }, [isLoadingMore, hasMore, page, sortConfig, fetchStocks]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!hasMore || isLoadingMore || isFetching.current) return;

      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD) {
        loadMore();
      }
    },
    [hasMore, isLoadingMore, loadMore]
  );

  const COL_SPAN = 5;

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            router.push("/dashboard/stocks");
          }}
          className="shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-start flex-col">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {config.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/50">
            {config.description}
          </p>
        </div>
      </div>

      {/* Sentiment Filter Tabs */}
      <div className="flex items-center gap-2">
        {(["bullish", "bearish"] as SentimentType[]).map((s) => {
          const sConfig = sentimentConfig[s];
          const SIcon = sConfig.icon;
          const isActive = s === sentiment;
          const bullishBgColor = "!bg-green-500/10 !text-green-600";
          const bearishBgColor = "!bg-red-500/10 !text-red-600";
          return (
            <Button
              key={s}
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/stocks/sentiment/${s}`)}
              className={cn(
                "flex items-center gap-1.5",
                isActive && (s === "bullish" ? bullishBgColor : bearishBgColor)
              )}
            >
              <SIcon className="w-4 h-4" />
              <span className="capitalize">{s}</span>
            </Button>
          );
        })}
      </div>

      {/* Table */}
      <SectionCard
        padding="none"
        useSectionHeader={false}
        scrollable
        contentClassName="h-full max-h-[600px] overflow-y-auto custom-scrollbar"
        onScroll={handleScroll}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-white dark:bg-card-dark z-10">
            <TableRow className="border-b border-gray-200 dark:border-white/10">
              <TableHead className="text-xs font-semibold text-left w-[140px] min-w-[140px]">
                Stock
              </TableHead>
              <SortableHeader
                label="Mentions"
                sortKey="mention_count"
                currentSortKey={sortConfig.key}
                sortDirection={sortConfig.direction}
                onSort={handleSort}
                align="center"
                type="numeric"
                className="w-[90px]"
              />
              <TableHead className="text-xs font-semibold text-center w-[120px]">
                Top KOLs
              </TableHead>
              <SortableHeader
                label="Sentiment"
                sortKey="sentiment_score"
                currentSortKey={sortConfig.key}
                sortDirection={sortConfig.direction}
                onSort={handleSort}
                align="center"
                type="numeric"
                className="w-[90px]"
              />
              <SortableHeader
                label="Trending"
                sortKey="trending_score"
                currentSortKey={sortConfig.key}
                sortDirection={sortConfig.direction}
                onSort={handleSort}
                align="center"
                type="numeric"
                className="w-[90px]"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && stocks.length === 0 ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TrendingStockSkeleton key={i} />
              ))
            ) : stocks.length === 0 ? (
              <TableRow>
                <td colSpan={COL_SPAN} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Icon
                      className={cn("w-8 h-8", config.color, "opacity-50")}
                    />
                    <p className="text-sm text-gray-500 dark:text-white/50">
                      No {sentiment} stocks found
                    </p>
                  </div>
                </td>
              </TableRow>
            ) : (
              <>
                {stocks.map((stock, index) => (
                  <TrendingStockItem
                    key={`${stock.ticker}-${index}`}
                    ticker={stock.ticker}
                    companyName={stock.company_name ?? undefined}
                    mentionCount={stock.mention_count}
                    sentimentScore={stock.sentiment_score ?? undefined}
                    trendingScore={stock.trending_score ?? undefined}
                    uniqueAuthors={stock.unique_authors_count}
                    topAuthors={stock.top_authors?.map((a) => ({
                      username: a.username,
                      displayName: a.display_name ?? undefined,
                      avatarUrl: a.avatar_url ?? "",
                      tweetCount: a.tweet_count,
                      sentiment: a.sentiment,
                    }))}
                  />
                ))}
                {isLoadingMore && <LoadingMoreRow colSpan={COL_SPAN} />}
                {!hasMore && stocks.length > 0 && !isLoadingMore && (
                  <NoMoreDataRow colSpan={COL_SPAN} />
                )}
              </>
            )}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
