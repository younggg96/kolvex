"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import SectionCard from "@/components/layout/SectionCard";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import sp500Data from "@/data/sp500.constituents.wikilogo.json";
import { cn } from "@/lib/utils";
import { SortableHeader } from "@/components/ui/sortable-header";

import {
  TrendingStockDisplayItem,
  TrendingStocksListProps,
  SortKey,
  SortConfig,
} from "./types";
import { useTrackedStocks, useTrendingStocksApi } from "./hooks";
import { TrendingStockItem } from "./TrendingStockItem";
import {
  TrendingStockSkeleton,
  LoadingMoreRow,
  NoMoreDataRow,
  EmptyRow,
} from "./TrendingStockSkeleton";

// Search Input Component
function SearchInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
      <Input
        placeholder="Search stocks..."
        className="h-8 pl-8 text-xs bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 focus-visible:ring-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function TrendingStocksList({
  stocks: externalStocks,
  fetchFromApi = false,
  loading: externalLoading = false,
  showMetrics = true,
  enableInfiniteScroll = false,
  maxHeight = "32rem",
  onAddClick,
  withCard = true,
  trackedStocksMap,
  onTrackedStocksChange,
}: TrendingStocksListProps = {}) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Custom hooks
  const { trackedStocks, handleTrackToggle } = useTrackedStocks(
    trackedStocksMap,
    onTrackedStocksChange
  );
  const {
    trendingStocks,
    loading: apiLoading,
    isLoadingMore,
    hasMore,
    fetchMore,
  } = useTrendingStocksApi(fetchFromApi);

  const loading = fetchFromApi ? apiLoading : externalLoading;

  // Convert API data to display format
  const convertedStocks: TrendingStockDisplayItem[] = useMemo(() => {
    return trendingStocks.map((stock) => ({
      ticker: stock.ticker,
      mentionCount: stock.mention_count,
      sentimentScore: stock.sentiment_score ?? undefined,
      trendingScore: stock.trending_score ?? undefined,
      uniqueAuthors: stock.unique_authors_count,
      topAuthors: (stock.top_authors || []).map((author) => ({
        username: author.username,
        displayName: author.display_name || undefined,
        avatarUrl: author.avatar_url || "",
        tweetCount: author.tweet_count,
        sentiment: author.sentiment,
      })),
    }));
  }, [trendingStocks]);

  const baseStocks = externalStocks || convertedStocks;

  // SP500 logo map for company info lookup
  const stockLogoMap = useMemo(() => {
    const map = new Map<string, { logoUrl: string | null; name: string }>();
    sp500Data.forEach((stock) => {
      if (stock.logoUrl) {
        map.set(stock.symbol, { logoUrl: stock.logoUrl, name: stock.name });
      }
    });
    return map;
  }, []);

  // Search & Sort processed stocks
  const processedStocks = useMemo(() => {
    let result = [...baseStocks];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          s.companyName?.toLowerCase().includes(q)
      );
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? 0;
        const bValue = b[sortConfig.key] ?? 0;

        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortConfig.direction === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [baseStocks, searchQuery, sortConfig]);

  const showPriceData = baseStocks.some((s) => s.price !== undefined);
  const colSpan = showPriceData ? 3 : showMetrics ? 5 : 1;

  const handleStockClick = useCallback(
    (ticker: string) => {
      router.push(`/dashboard/stock/${ticker}`);
    },
    [router]
  );

  // Scroll handler for infinite scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!enableInfiniteScroll || !hasMore || isLoadingMore) return;

      const target = e.currentTarget;
      const { scrollTop, scrollHeight, clientHeight } = target;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // Trigger load more when within 100px of bottom
      if (distanceFromBottom < 100) {
        fetchMore();
      }
    },
    [enableInfiniteScroll, hasMore, isLoadingMore, fetchMore]
  );

  const toggleSort = useCallback((key: SortKey) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        if (current.direction === "desc") return { key, direction: "asc" };
        return null;
      }
      return { key, direction: "desc" };
    });
  }, []);

  const tableContent = (
    <div className="flex flex-col gap-3">
      {!withCard && (
        <div className="flex justify-between items-center px-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-full max-w-xs"
          />
          {onAddClick && (
            <Button onClick={onAddClick} size="sm" variant="outline">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          )}
        </div>
      )}

      <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="overflow-y-auto overflow-x-hidden"
          style={{ maxHeight }}
          onScroll={handleScroll}
        >
          <Table className="table-fixed w-full">
            <TableHeader className="sticky top-0 bg-white dark:bg-card-dark z-10">
              <TableRow className="border-b border-gray-200 dark:border-white/10">
                <SortableHeader
                  label="Stock"
                  sortKey="ticker"
                  currentSortKey={sortConfig?.key}
                  sortDirection={sortConfig?.direction}
                  onSort={(key) => toggleSort(key as SortKey)}
                  align="left"
                  type="alpha"
                  className="w-[140px] min-w-[140px]"
                />
                {showPriceData ? (
                  <>
                    <SortableHeader
                      label="Price"
                      sortKey="price"
                      currentSortKey={sortConfig?.key}
                      sortDirection={sortConfig?.direction}
                      onSort={(key) => toggleSort(key as SortKey)}
                      align="right"
                      type="amount"
                    />
                    <SortableHeader
                      label="Change"
                      sortKey="changePercent"
                      currentSortKey={sortConfig?.key}
                      sortDirection={sortConfig?.direction}
                      onSort={(key) => toggleSort(key as SortKey)}
                      align="right"
                      type="numeric"
                    />
                  </>
                ) : showMetrics ? (
                  <>
                    <SortableHeader
                      label="Mentions"
                      sortKey="mentionCount"
                      currentSortKey={sortConfig?.key}
                      sortDirection={sortConfig?.direction}
                      onSort={(key) => toggleSort(key as SortKey)}
                      type="numeric"
                      className="w-[90px]"
                    />
                    <SortableHeader
                      label="Top KOLs"
                      sortKey="uniqueAuthors"
                      currentSortKey={sortConfig?.key}
                      sortDirection={sortConfig?.direction}
                      onSort={(key) => toggleSort(key as SortKey)}
                      type="numeric"
                      className="w-[120px]"
                    />
                    <SortableHeader
                      label="Sentiment"
                      sortKey="sentimentScore"
                      currentSortKey={sortConfig?.key}
                      sortDirection={sortConfig?.direction}
                      onSort={(key) => toggleSort(key as SortKey)}
                      type="numeric"
                      className="w-[90px]"
                    />
                    <SortableHeader
                      label="Trending"
                      sortKey="trendingScore"
                      currentSortKey={sortConfig?.key}
                      sortDirection={sortConfig?.direction}
                      onSort={(key) => toggleSort(key as SortKey)}
                      type="numeric"
                      className="w-[90px]"
                    />
                  </>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && processedStocks.length === 0 ? (
                [...Array(6)].map((_, i) => <TrendingStockSkeleton key={i} />)
              ) : processedStocks.length === 0 ? (
                <EmptyRow colSpan={colSpan} searchQuery={searchQuery} />
              ) : (
                <>
                  {processedStocks.map((stock, index) => {
                    const stockInfo = stockLogoMap.get(stock.ticker);
                    const finalCompanyName =
                      stock.companyName || stockInfo?.name;
                    const finalLogoUrl = stock.logoUrl || stockInfo?.logoUrl;

                    return (
                      <TrendingStockItem
                        key={`${stock.ticker}-${index}`}
                        ticker={stock.ticker}
                        mentionCount={stock.mentionCount}
                        sentimentScore={stock.sentimentScore}
                        trendingScore={stock.trendingScore}
                        uniqueAuthors={stock.uniqueAuthors}
                        price={stock.price}
                        changePercent={stock.changePercent}
                        logoUrl={finalLogoUrl}
                        companyName={finalCompanyName}
                        topAuthors={stock.topAuthors}
                        showMetrics={showMetrics}
                        isTracked={trackedStocks.has(stock.ticker)}
                        onTrackToggle={(e) =>
                          handleTrackToggle(
                            e,
                            stock.ticker,
                            finalCompanyName,
                            finalLogoUrl || undefined
                          )
                        }
                        onClick={() => handleStockClick(stock.ticker)}
                      />
                    );
                  })}

                  {/* Loading More Indicator */}
                  {enableInfiniteScroll && isLoadingMore && (
                    <LoadingMoreRow colSpan={colSpan} />
                  )}

                  {/* No More Data Indicator */}
                  {enableInfiniteScroll &&
                    !hasMore &&
                    processedStocks.length > 0 &&
                    !isLoadingMore && <NoMoreDataRow colSpan={colSpan} />}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );

  if (!withCard) {
    return tableContent;
  }

  return (
    <SectionCard
      useSectionHeader={false}
      padding="md"
      contentClassName="px-4 pb-4"
      headerRightExtra={
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-[140px]"
          />
          {onAddClick && (
            <Button onClick={onAddClick} size="sm" variant="ghost">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      }
    >
      {tableContent}
    </SectionCard>
  );
}

export type { TrendingStockDisplayItem } from "./types";

