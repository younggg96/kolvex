"use client";

import { useState, useEffect, useMemo } from "react";
import SectionCard from "@/components/SectionCard";
import CompanyLogo from "@/components/CompanyLogo";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { TrendingStock } from "@/app/api/trending-stocks/route";
import { MessageSquare, Plus, Users, Search, Star } from "lucide-react";
import sp500Data from "@/data/sp500.constituents.wikilogo.json";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import {
  getTrackedStocks,
  createTrackedStock,
  deleteTrackedStock,
} from "@/lib/trackedStockApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SortableHeader } from "@/components/ui/sortable-header";

interface TrendingStockDisplayItem {
  ticker: string;
  companyName?: string;
  platform?: string;
  mentionCount?: number;
  sentimentScore?: number;
  trendingScore?: number;
  uniqueAuthors?: number;
  price?: number;
  changePercent?: number;
  logoUrl?: string | null;
  topAuthors?: {
    username: string;
    displayName?: string;
    avatarUrl: string;
    tweetCount: number;
    sentiment?: string | null;
  }[];
}

interface TrendingStocksListProps {
  stocks?: TrendingStockDisplayItem[];
  fetchFromApi?: boolean;
  loading?: boolean;
  title?: string;
  showPlatform?: boolean;
  showMetrics?: boolean;
  enableInfiniteScroll?: boolean;
  maxHeight?: string;
  onAddClick?: () => void;
  withCard?: boolean;
  // 外部传入的 tracked stocks map，避免重复请求
  trackedStocksMap?: Map<string, string>;
  onTrackedStocksChange?: () => void;
}

interface TrendingStockItemProps {
  ticker: string;
  mentionCount?: number;
  sentimentScore?: number;
  trendingScore?: number;
  uniqueAuthors?: number;
  platform?: string;
  price?: number;
  changePercent?: number;
  logoUrl?: string | null;
  companyName?: string;
  topAuthors?: {
    username: string;
    displayName?: string;
    avatarUrl: string;
    tweetCount: number;
    sentiment?: string | null;
  }[];
  showPlatform?: boolean;
  showMetrics?: boolean;
  isTracked: boolean;
  onTrackToggle: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function TrendingStockItem({
  ticker,
  mentionCount,
  sentimentScore,
  trendingScore,
  uniqueAuthors,
  platform,
  price,
  changePercent,
  logoUrl,
  companyName,
  topAuthors,
  showPlatform = true,
  showMetrics = true,
  isTracked,
  onTrackToggle,
  onClick,
}: TrendingStockItemProps) {
  const getSentimentColor = (score?: number) => {
    if (!score) return "text-gray-900 dark:text-white";
    if (score > 50) return "text-green-500";
    if (score < -50) return "text-red-500";
    return "text-gray-900 dark:text-white";
  };

  const getPriceChangeColor = (change?: number) => {
    if (!change) return "text-gray-500";
    return change >= 0 ? "text-green-500" : "text-red-500";
  };

  const getSentimentBadgeColor = (sentiment?: string | null) => {
    if (!sentiment) return "bg-gray-100 dark:bg-gray-700";
    if (sentiment === "bullish") return "bg-green-100 dark:bg-green-900/30";
    if (sentiment === "bearish") return "bg-red-100 dark:bg-red-900/30";
    return "bg-gray-100 dark:bg-gray-700";
  };

  const getSentimentRingColor = (sentiment?: string | null) => {
    if (!sentiment) return "ring-gray-300 dark:ring-gray-600";
    if (sentiment === "bullish") return "ring-green-400 dark:ring-green-500";
    if (sentiment === "bearish") return "ring-red-400 dark:ring-red-500";
    return "ring-gray-300 dark:ring-gray-600";
  };

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
          {/* Track Button (visible on hover or if tracked) */}
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
                  title={`${author.displayName || author.username}: ${
                    author.tweetCount
                  } tweets (${author.sentiment || "neutral"})`}
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

function TrendingStockSkeleton() {
  return (
    <TableRow className="border-b border-gray-100 dark:border-white/5">
      <TableCell className="py-3 w-[140px] min-w-[140px]">
        <div className="flex items-center justify-start gap-2">
          <div className="w-8 h-8 rounded bg-gray-300 dark:bg-white/10 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="w-12 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mb-1" />
            <div className="w-16 h-2.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse" />
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center py-3 w-[90px]">
        <div className="w-10 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="py-3 w-[120px]">
        <div className="flex justify-center -space-x-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full bg-gray-300 dark:bg-white/10 animate-pulse ring-2 ring-white dark:ring-gray-900"
            />
          ))}
        </div>
      </TableCell>
      <TableCell className="text-center py-3 w-[90px]">
        <div className="w-8 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="text-center py-3 w-[90px]">
        <div className="w-12 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
    </TableRow>
  );
}

type SortKey =
  | "ticker"
  | "price"
  | "changePercent"
  | "mentionCount"
  | "uniqueAuthors"
  | "sentimentScore"
  | "trendingScore";
type SortDirection = "asc" | "desc";

export default function TrendingStocksList({
  stocks: externalStocks,
  fetchFromApi = false,
  loading: externalLoading = false,
  title = "Stocks",
  showPlatform = true,
  showMetrics = true,
  enableInfiniteScroll = false,
  maxHeight = "32rem",
  onAddClick,
  withCard = true,
  trackedStocksMap: externalTrackedStocksMap,
  onTrackedStocksChange,
}: TrendingStocksListProps = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const [trendingStocks, setTrendingStocks] = useState<TrendingStock[]>([]);
  const [internalLoading, setInternalLoading] = useState(fetchFromApi);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 10;

  // New features state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);
  const [internalTrackedStocks, setInternalTrackedStocks] = useState<
    Map<string, string>
  >(new Map()); // Symbol -> ID

  // 使用外部传入的 map 或内部状态
  const trackedStocks = externalTrackedStocksMap || internalTrackedStocks;
  const setTrackedStocks = externalTrackedStocksMap
    ? () => {} // 外部管理时不更新内部状态
    : setInternalTrackedStocks;

  const loading = fetchFromApi ? internalLoading : externalLoading;

  // 只在没有外部传入 trackedStocksMap 时才获取
  useEffect(() => {
    if (user && !externalTrackedStocksMap) {
      getTrackedStocks()
        .then((stocks) => {
          const map = new Map();
          stocks.forEach((s) => map.set(s.symbol, s.id));
          setInternalTrackedStocks(map);
        })
        .catch(console.error);
    }
  }, [user, externalTrackedStocksMap]);

  const handleTrackToggle = async (
    e: React.MouseEvent,
    ticker: string,
    companyName?: string,
    logoUrl?: string
  ) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Please login to track stocks");
      return;
    }

    try {
      if (trackedStocks.has(ticker)) {
        // Untrack
        const id = trackedStocks.get(ticker);
        if (id) {
          await deleteTrackedStock(id);
          // 如果有外部回调，调用它来刷新父组件状态
          if (onTrackedStocksChange) {
            onTrackedStocksChange();
          } else {
            setInternalTrackedStocks((prev) => {
              const next = new Map(prev);
              next.delete(ticker);
              return next;
            });
          }
          toast.success(`Removed ${ticker} from watchlist`);
        }
      } else {
        // Track
        const newStock = await createTrackedStock({
          symbol: ticker,
          companyName,
          logo: logoUrl || undefined,
          notify: true,
        });
        // 如果有外部回调，调用它来刷新父组件状态
        if (onTrackedStocksChange) {
          onTrackedStocksChange();
        } else {
          setInternalTrackedStocks((prev) => {
            const next = new Map(prev);
            next.set(ticker, newStock.id);
            return next;
          });
        }
        toast.success(`Added ${ticker} to watchlist`);
      }
    } catch (err) {
      console.error("Failed to toggle track:", err);
      toast.error("Failed to update watchlist");
    }
  };

  // Convert trendingStocks to StockDisplayItem format
  const convertedTrendingStocks: TrendingStockDisplayItem[] = useMemo(() => {
    return trendingStocks.map((stock) => ({
      ticker: stock.ticker,
      platform: stock.platform,
      mentionCount: stock.mention_count,
      sentimentScore: stock.sentiment_score ?? undefined,
      trendingScore: stock.trending_score ?? undefined,
      uniqueAuthors: stock.unique_authors_count,
      // Use top_authors from API response with all fields
      topAuthors: (stock.top_authors || []).map((author) => ({
        username: author.username,
        displayName: author.display_name || undefined,
        avatarUrl: author.avatar_url || "",
        tweetCount: author.tweet_count,
        sentiment: author.sentiment,
      })),
    }));
  }, [trendingStocks]);

  const baseStocks = externalStocks || convertedTrendingStocks;

  // Process stocks (Search & Sort)
  const processedStocks = useMemo(() => {
    let result = [...baseStocks];

    // Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          s.companyName?.toLowerCase().includes(q)
      );
    }

    // Sort
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

  // Create a Map for quick logo lookup
  const stockLogoMap = useMemo(() => {
    const map = new Map<string, { logoUrl: string | null; name: string }>();
    sp500Data.forEach((stock) => {
      if (stock.logoUrl) {
        map.set(stock.symbol, {
          logoUrl: stock.logoUrl,
          name: stock.name,
        });
      }
    });
    return map;
  }, []);

  const fetchTrendingStocks = async (reset: boolean = false) => {
    if (!fetchFromApi) return;

    try {
      if (reset) {
        setInternalLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const currentPage = reset ? 1 : Math.floor(offset / limit) + 1;
      const response = await fetch(
        `/api/trending-stocks?page=${currentPage}&page_size=${limit}&sort_by=trending_score&sort_direction=desc`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch trending stocks");
      }

      const data = await response.json();
      const newStocks = data.stocks || [];

      if (reset) {
        setTrendingStocks(newStocks);
        setOffset(newStocks.length);
      } else {
        setTrendingStocks((prev) => [...prev, ...newStocks]);
        setOffset((prev) => prev + newStocks.length);
      }

      // Check if there are more items to load
      setHasMore(data.has_more ?? newStocks.length === limit);
    } catch (err) {
      console.error("Error fetching trending stocks:", err);
    } finally {
      setInternalLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!fetchFromApi) return;

    // Reset and fetch when component mounts
    setTrendingStocks([]);
    setOffset(0);
    setHasMore(true);
    fetchTrendingStocks(true);

    // Refresh every 60 seconds
    const interval = setInterval(() => fetchTrendingStocks(true), 60000);
    return () => clearInterval(interval);
  }, [fetchFromApi]);

  const handleStockClick = (ticker: string) => {
    router.push(`/dashboard/stock/${ticker}`);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!enableInfiniteScroll || !hasMore || isLoadingMore) return;

    const target = e.currentTarget;
    const scrollPercentage =
      (target.scrollTop + target.clientHeight) / target.scrollHeight;

    // Load more when scrolled to 90% of the content
    if (scrollPercentage > 0.9) {
      fetchTrendingStocks(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        // Toggle sequence: desc -> asc -> default (null)
        if (current.direction === "desc") {
          return { key, direction: "asc" };
        }
        // If current is asc, reset to default
        return null;
      }
      return { key, direction: "desc" }; // Default to desc
    });
  };

  // Determine if we're showing price data or metrics
  const showPriceData = baseStocks.some((s) => s.price !== undefined);

  const RightExtra = () => {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            placeholder="Search stocks..."
            className="h-8 pl-8 w-[140px] text-xs bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 focus-visible:ring-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {onAddClick && (
          <Button onClick={onAddClick} size="sm" variant="ghost">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    );
  };

  const tableContent = (
    <div className="flex flex-col gap-3">
      {/* If without card, show search input above table */}
      {!withCard && (
        <div className="flex justify-between items-center px-1">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search stocks..."
              className="h-8 pl-8 text-xs bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {onAddClick && (
            <Button onClick={onAddClick} size="sm" variant="outline">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          )}
        </div>
      )}

      <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
        <div
          className="overflow-auto"
          style={{ maxHeight }}
          onScroll={handleScroll}
        >
          <Table className="table-fixed">
            <TableHeader>
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
                <>
                  {[...Array(6)].map((_, i) => (
                    <TrendingStockSkeleton key={i} />
                  ))}
                </>
              ) : processedStocks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showPriceData ? 3 : showMetrics ? 5 : 1}
                    className="text-center py-8 text-sm text-gray-500 dark:text-white/50"
                  >
                    {searchQuery
                      ? "No stocks match your search"
                      : "No stocks to display"}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {processedStocks.map((stock, index) => {
                    const stockInfo = stockLogoMap.get(stock.ticker);
                    const finalCompanyName =
                      stock.companyName || stockInfo?.name;
                    const finalLogoUrl = stock.logoUrl || stockInfo?.logoUrl;
                    const isTracked = trackedStocks.has(stock.ticker);

                    return (
                      <TrendingStockItem
                        key={`${stock.ticker}-${index}`}
                        ticker={stock.ticker}
                        mentionCount={stock.mentionCount}
                        sentimentScore={stock.sentimentScore}
                        trendingScore={stock.trendingScore}
                        uniqueAuthors={stock.uniqueAuthors}
                        platform={stock.platform}
                        price={stock.price}
                        changePercent={stock.changePercent}
                        logoUrl={finalLogoUrl}
                        companyName={finalCompanyName}
                        topAuthors={stock.topAuthors}
                        showPlatform={showPlatform}
                        showMetrics={showMetrics}
                        isTracked={isTracked}
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
                    <TableRow>
                      <TableCell
                        colSpan={showPriceData ? 3 : showMetrics ? 5 : 1}
                        className="text-center py-6"
                      >
                        <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span>Loading more stocks...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* No More Data Indicator */}
                  {enableInfiniteScroll &&
                    !hasMore &&
                    processedStocks.length > 0 &&
                    !isLoadingMore && (
                      <TableRow>
                        <TableCell
                          colSpan={showPriceData ? 3 : showMetrics ? 5 : 1}
                          className="text-center py-6 text-sm text-gray-400 dark:text-white/40 font-medium"
                        >
                          No more stocks to load
                        </TableCell>
                      </TableRow>
                    )}
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
      title={title}
      padding="md"
      contentClassName="px-4 pb-4"
      headerRightExtra={<RightExtra />}
    >
      {tableContent}
    </SectionCard>
  );
}
export type { TrendingStockDisplayItem };
