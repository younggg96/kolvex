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
import { TrendingStockItem } from "./TrendingStockItem";
import {
  TrendingStockSkeleton,
  LoadingMoreRow,
  NoMoreDataRow,
  EmptyRow,
} from "./TrendingStockSkeleton";
import { SectionCard } from "../layout";

const PAGE_SIZE = 10;
const SCROLL_THRESHOLD = 100;

type SortDirection = "asc" | "desc";

interface SortConfig {
  key: SortBy | null;
  direction: SortDirection | null;
}

interface TrendingStocksListProps {
  searchQuery?: string;
}

export default function TrendingStocksTable({
  searchQuery = "",
}: TrendingStocksListProps) {
  const [stocks, setStocks] = useState<TrendingStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "trending_score",
    direction: "desc",
  });
  const isFetching = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchStocks = useCallback(
    async (
      pageNum: number,
      sort: SortConfig,
      query: string,
      isInitial = false
    ) => {
      if (isFetching.current && !isInitial) return;
      isFetching.current = true;

      if (isInitial) setLoading(true);

      try {
        const sortKey = sort.key ?? "trending_score";
        let url = `/api/trending-stocks?page=${pageNum}&page_size=${PAGE_SIZE}&sort_by=${sortKey}&sort_direction=${sort.direction}`;
        if (query.trim()) {
          url += `&query=${encodeURIComponent(query.trim())}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();
        const newStocks: TrendingStock[] = data.stocks || [];

        setStocks((prev) => (isInitial ? newStocks : [...prev, ...newStocks]));
        setHasMore(data.has_more ?? newStocks.length === PAGE_SIZE);
      } catch (err) {
        console.error("Error fetching trending stocks:", err);
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
        isFetching.current = false;
      }
    },
    []
  );

  // 初始加载和搜索变化时重新加载
  useEffect(() => {
    setPage(1);
    setStocks([]);
    setHasMore(true);
    fetchStocks(1, sortConfig, searchQuery, true);
  }, [searchQuery]);

  const handleSort = useCallback(
    (key: SortBy) => {
      setSortConfig((current) => {
        if (current.key === key) {
          if (current.direction === "desc") {
            const newConfig: SortConfig = { key, direction: "asc" };
            setPage(1);
            setStocks([]);
            fetchStocks(1, newConfig, searchQuery, true);
            return newConfig;
          } else {
            // 当前 asc，再点击一次则清除排序（key 设为 null，direction 重置为 desc）
            const newConfig: SortConfig = { key: null, direction: "desc" };
            setPage(1);
            setStocks([]);
            fetchStocks(1, newConfig, searchQuery, true);
            return newConfig;
          }
        } else {
          const newConfig: SortConfig = { key, direction: "desc" };
          setPage(1);
          setStocks([]);
          fetchStocks(1, newConfig, searchQuery, true);
          return newConfig;
        }
      });
    },
    [fetchStocks, searchQuery]
  );

  // 加载更多
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isFetching.current) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchStocks(nextPage, sortConfig, searchQuery);
  }, [isLoadingMore, hasMore, page, sortConfig, searchQuery, fetchStocks]);

  // 滚动监听
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

  const COL_SPAN = 10;

  return (
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
            <EmptyRow colSpan={COL_SPAN} searchQuery={searchQuery} />
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
  );
}

export type { TrendingStockDisplayItem } from "./types";
