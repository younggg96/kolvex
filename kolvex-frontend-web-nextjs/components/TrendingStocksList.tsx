"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import SectionCard from "@/components/SectionCard";
import CompanyLogo from "@/components/CompanyLogo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { TrendingStock } from "@/app/api/trending-stocks/route";
import { MessageSquare, Plus, Users } from "lucide-react";
import sp500Data from "@/data/sp500.constituents.wikilogo.json";
import { Button } from "./ui/button";
import { PLATFORM_CONFIG } from "@/lib/platformConfig";

const platformConfig = PLATFORM_CONFIG;

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
  showPlatform?: boolean;
  showMetrics?: boolean;
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
  showPlatform = true,
  showMetrics = true,
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

  return (
    <TableRow
      onClick={onClick}
      className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 cursor-pointer"
    >
      {/* Stock Info */}
      <TableCell className="py-3">
        <div className="flex items-center justify-start gap-2.5">
          <CompanyLogo
            logoUrl={logoUrl || ""}
            symbol={ticker}
            name={companyName}
            size="sm"
          />
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {ticker}
              </div>
              {/* Platform Logo Badge */}
              {showPlatform && platform && (
                <div className="p-1 rounded-md bg-gray-100 dark:bg-white/10">
                  <Image
                    src={
                      platformConfig[platform as keyof typeof platformConfig]
                        ?.icon
                    }
                    alt={
                      platformConfig[platform as keyof typeof platformConfig]
                        ?.name
                    }
                    width={12}
                    height={12}
                    className="opacity-80"
                  />
                </div>
              )}
            </div>
            {companyName && (
              <div className="text-[11px] text-gray-500 dark:text-white/50 truncate">
                {companyName}
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {/* Price or Mentions */}
      {price !== undefined ? (
        <TableCell className="text-xs text-right font-semibold text-gray-900 dark:text-white py-3">
          ${price.toFixed(2)}
        </TableCell>
      ) : showMetrics && mentionCount !== undefined ? (
        <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 py-3">
          <div className="flex items-center justify-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
            <span>{mentionCount}</span>
          </div>
        </TableCell>
      ) : null}

      {/* Change or Authors */}
      {changePercent !== undefined ? (
        <TableCell className="text-xs text-right font-semibold py-3">
          <span className={getPriceChangeColor(changePercent)}>
            {changePercent >= 0 ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        </TableCell>
      ) : showMetrics && uniqueAuthors !== undefined ? (
        <TableCell className="text-xs text-center font-semibold text-gray-800 dark:text-white/90 py-3">
          <div className="flex items-center justify-center gap-1">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span>{uniqueAuthors}</span>
          </div>
        </TableCell>
      ) : null}

      {/* Sentiment */}
      {showMetrics && sentimentScore !== undefined && (
        <TableCell className="text-xs text-center font-bold py-3">
          <span className={getSentimentColor(sentimentScore)}>
            {sentimentScore > 0 ? "+" : ""}
            {sentimentScore.toFixed(0)}
          </span>
        </TableCell>
      )}

      {/* Trending Score */}
      {showMetrics && trendingScore !== undefined && (
        <TableCell className="text-xs text-center font-bold text-gray-900 dark:text-white py-3">
          {trendingScore.toFixed(1)}
        </TableCell>
      )}
    </TableRow>
  );
}

function TrendingStockSkeleton() {
  return (
    <TableRow className="border-b border-gray-100 dark:border-white/5">
      <TableCell className="py-3">
        <div className="flex items-center justify-start gap-2.5">
          <div className="w-8 h-8 rounded bg-gray-300 dark:bg-white/10 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse" />
              <div className="w-12 h-5 bg-gray-300 dark:bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center py-3">
        <div className="w-12 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="text-center py-3">
        <div className="w-12 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="text-center py-3">
        <div className="w-12 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="text-center py-3">
        <div className="w-12 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
    </TableRow>
  );
}

export default function TrendingStocksList({
  stocks: externalStocks,
  fetchFromApi = false,
  loading: externalLoading = false,
  title = "Stock Tracker",
  showPlatform = true,
  showMetrics = true,
  enableInfiniteScroll = false,
  maxHeight = "32rem",
  onAddClick,
}: TrendingStocksListProps = {}) {
  const router = useRouter();
  const [trendingStocks, setTrendingStocks] = useState<TrendingStock[]>([]);
  const [internalLoading, setInternalLoading] = useState(fetchFromApi);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 10;

  const loading = fetchFromApi ? internalLoading : externalLoading;

  // Convert trendingStocks to StockDisplayItem format
  const convertedTrendingStocks: TrendingStockDisplayItem[] = useMemo(() => {
    return trendingStocks.map((stock) => ({
      ticker: stock.ticker,
      platform: stock.platform,
      mentionCount: stock.mention_count,
      sentimentScore: stock.sentiment_score ?? undefined,
      trendingScore: stock.trending_score ?? undefined,
      uniqueAuthors: stock.unique_authors_count,
    }));
  }, [trendingStocks]);

  const displayStocks = externalStocks || convertedTrendingStocks;

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

  // Determine if we're showing price data or metrics
  const showPriceData = displayStocks.some((s) => s.price !== undefined);

  const RightExtra = () => {
    if (onAddClick) {
      return (
        <Button onClick={onAddClick} size="sm" variant="ghost">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      );
    }
    return null;
  };

  return (
    <SectionCard
      title={title}
      padding="md"
      contentClassName="px-4 pb-4"
      headerRightExtra={<RightExtra />}
    >
      <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
        <div
          className="overflow-auto"
          style={{ maxHeight }}
          onScroll={handleScroll}
        >
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 dark:border-white/10">
                <TableHead className="text-xs font-semibold">Stock</TableHead>
                {showPriceData ? (
                  <>
                    <TableHead className="text-xs text-right font-semibold">
                      Price
                    </TableHead>
                    <TableHead className="text-xs text-right font-semibold">
                      Change
                    </TableHead>
                  </>
                ) : showMetrics ? (
                  <>
                    <TableHead className="text-xs text-center font-semibold">
                      Mentions
                    </TableHead>
                    <TableHead className="text-xs text-center font-semibold">
                      Authors
                    </TableHead>
                    <TableHead className="text-xs text-center font-semibold">
                      Sentiment
                    </TableHead>
                    <TableHead className="text-xs text-center font-semibold">
                      Trending
                    </TableHead>
                  </>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && displayStocks.length === 0 ? (
                <>
                  {[...Array(6)].map((_, i) => (
                    <TrendingStockSkeleton key={i} />
                  ))}
                </>
              ) : displayStocks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showPriceData ? 3 : showMetrics ? 5 : 1}
                    className="text-center py-8 text-sm text-gray-500 dark:text-white/50"
                  >
                    No stocks to display
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {displayStocks.map((stock, index) => {
                    const stockInfo = stockLogoMap.get(stock.ticker);
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
                        logoUrl={stock.logoUrl || stockInfo?.logoUrl}
                        companyName={stock.companyName || stockInfo?.name}
                        showPlatform={showPlatform}
                        showMetrics={showMetrics}
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
                    displayStocks.length > 0 &&
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
    </SectionCard>
  );
}
export type { TrendingStockDisplayItem };
