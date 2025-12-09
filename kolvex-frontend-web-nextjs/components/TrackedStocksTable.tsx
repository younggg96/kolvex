"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TrackedStock,
  TopAuthor,
  deleteTrackedStock,
} from "@/lib/trackedStockApi";
import { Building2, Plus, Star, Loader2, MessageSquare } from "lucide-react";
import { useMultipleQuotes } from "@/hooks/useStockData";
import SectionCard from "@/components/SectionCard";
import CompanyLogo from "@/components/CompanyLogo";
import MiniSparkline from "@/components/MiniSparkline";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// 15 minutes refresh interval
const REFRESH_INTERVAL = 15 * 60 * 1000;

interface TrackedStocksTableProps {
  stocks: TrackedStock[];
  onUpdate: () => void;
  loading?: boolean;
  onAddClick?: () => void;
  withCard?: boolean;
}

interface StockRowProps {
  id: string;
  symbol: string;
  companyName: string;
  logo: string | null;
  price: number;
  changePercent: number;
  sparklineData: number[];
  mentionCount: number;
  topAuthors: TopAuthor[];
  isUntracking: boolean;
  onUntrack: (e: React.MouseEvent) => void;
  onClick: () => void;
}

const getSentimentRingColor = (sentiment?: string | null) => {
  if (!sentiment) return "ring-gray-300 dark:ring-gray-600";
  if (sentiment === "bullish") return "ring-green-400 dark:ring-green-500";
  if (sentiment === "bearish") return "ring-red-400 dark:ring-red-500";
  return "ring-gray-300 dark:ring-gray-600";
};

function StockRow({
  id,
  symbol,
  companyName,
  logo,
  price,
  changePercent,
  sparklineData,
  mentionCount,
  topAuthors,
  isUntracking,
  onUntrack,
  onClick,
}: StockRowProps) {
  const getPriceChangeColor = (change: number) => {
    return change >= 0 ? "text-green-500" : "text-red-500";
  };

  return (
    <TableRow
      onClick={onClick}
      className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 cursor-pointer group"
    >
      {/* Stock Info */}
      <TableCell className="py-3">
        <div className="flex items-center justify-start gap-2.5">
          <CompanyLogo symbol={symbol} name={companyName} size="sm" />
          <div className="min-w-0 text-left">
            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {symbol}
            </div>
            {companyName && (
              <div className="text-[11px] text-gray-500 dark:text-white/50 truncate max-w-[100px]">
                {companyName}
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {/* Price */}
      <TableCell className="text-xs text-right font-semibold text-gray-900 dark:text-white py-3">
        ${price.toFixed(2)}
      </TableCell>

      {/* Change Percent */}
      <TableCell className="text-xs text-right font-semibold py-3">
        <span className={getPriceChangeColor(changePercent)}>
          {changePercent >= 0 ? "+" : ""}
          {changePercent.toFixed(2)}%
        </span>
      </TableCell>

      {/* Sparkline Chart */}
      <TableCell className="py-3 hidden sm:table-cell">
        <div className="flex justify-center">
          <MiniSparkline
            data={sparklineData}
            width={60}
            height={20}
            strokeWidth={1.2}
          />
        </div>
      </TableCell>

      {/* KOL Mentions */}
      <TableCell className="py-3 hidden md:table-cell">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-white/60">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-medium">{mentionCount}</span>
          </div>
          {topAuthors.length > 0 && (
            <div className="flex -space-x-2">
              {topAuthors.slice(0, 4).map((author, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "relative rounded-full ring-offset-0 ring-2 ring-white dark:ring-gray-900 bg-gray-100 dark:bg-gray-800",
                    getSentimentRingColor(author.sentiment)
                  )}
                  title={`${author.display_name || author.username}: ${
                    author.tweet_count
                  } tweets (${author.sentiment || "neutral"})`}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage
                      src={author.avatar_url || ""}
                      alt={author.username}
                    />
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
          )}
        </div>
      </TableCell>

      {/* Untrack Action */}
      <TableCell className="py-3">
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
    </TableRow>
  );
}

function StockRowSkeleton() {
  return (
    <TableRow className="border-b border-gray-100 dark:border-white/5">
      <TableCell className="py-3">
        <div className="flex items-center justify-start gap-2.5">
          <div className="w-8 h-8 rounded bg-gray-300 dark:bg-white/10 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="w-16 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mb-1" />
            <div className="w-24 h-3 bg-gray-300 dark:bg-white/10 rounded animate-pulse" />
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right py-3">
        <div className="w-16 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse ml-auto" />
      </TableCell>
      <TableCell className="text-right py-3">
        <div className="w-12 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse ml-auto" />
      </TableCell>
      <TableCell className="py-3 hidden sm:table-cell">
        <div className="w-[60px] h-5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="py-3 hidden md:table-cell">
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse" />
          <div className="flex -space-x-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full bg-gray-300 dark:bg-white/10 animate-pulse"
              />
            ))}
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="w-7 h-7 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
    </TableRow>
  );
}

export default function TrackedStocksTable({
  stocks,
  onUpdate,
  loading = false,
  onAddClick,
  withCard = true,
}: TrackedStocksTableProps) {
  const router = useRouter();
  const [untrackingIds, setUntrackingIds] = useState<Set<string>>(new Set());
  const [sparklineDataMap, setSparklineDataMap] = useState<
    Map<string, number[]>
  >(new Map());

  // Get all stock symbols
  const symbols = useMemo(() => stocks.map((stock) => stock.symbol), [stocks]);

  // Fetch real-time quotes for all tracked stocks (refresh every 15 minutes)
  const { data: realtimeQuotes } = useMultipleQuotes(symbols, REFRESH_INTERVAL);

  // Fetch intraday chart data for sparklines
  useEffect(() => {
    const fetchSparklineData = async () => {
      const newMap = new Map<string, number[]>();

      await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const response = await fetch(
              `/api/stocks?action=chart&symbol=${symbol}&interval=5m`
            );
            if (response.ok) {
              const data = await response.json();
              const values = data.map((d: { value: number }) => d.value);
              newMap.set(symbol, values);
            }
          } catch (error) {
            console.error(`Failed to fetch sparkline for ${symbol}:`, error);
          }
        })
      );

      setSparklineDataMap(newMap);
    };

    if (symbols.length > 0) {
      fetchSparklineData();
    }
  }, [symbols.join(",")]);

  // Create a map for quick lookup
  const quotesMap = useMemo(() => {
    const map = new Map();
    realtimeQuotes.forEach((quote) => {
      map.set(quote.symbol, quote);
    });
    return map;
  }, [realtimeQuotes]);

  // Merge real-time data with tracked stocks (KOL data comes from API directly)
  const enrichedStocks = useMemo(() => {
    return stocks.map((stock) => {
      const realtimeQuote = quotesMap.get(stock.symbol);
      return {
        ...stock,
        companyName: realtimeQuote?.name || stock.company_name || stock.symbol,
        logo: stock.logo_url,
        price: realtimeQuote?.price ?? 0,
        changePercent: realtimeQuote?.changePercent ?? 0,
        sparklineData: sparklineDataMap.get(stock.symbol) || [],
        mentionCount: stock.mention_count,
        topAuthors: stock.top_authors,
      };
    });
  }, [stocks, quotesMap, sparklineDataMap]);

  const handleStockClick = (symbol: string) => {
    router.push(`/dashboard/stock/${symbol}`);
  };

  const handleUntrack = async (
    e: React.MouseEvent,
    stockId: string,
    symbol: string
  ) => {
    e.stopPropagation();

    setUntrackingIds((prev) => new Set(prev).add(stockId));

    try {
      await deleteTrackedStock(stockId);
      toast.success(`Removed ${symbol} from watchlist`);
      onUpdate();
    } catch (error) {
      console.error("Failed to untrack stock:", error);
      toast.error("Failed to remove from watchlist");
    } finally {
      setUntrackingIds((prev) => {
        const next = new Set(prev);
        next.delete(stockId);
        return next;
      });
    }
  };

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

  const tableContent =
    loading && stocks.length === 0 ? (
      // Loading skeleton
      <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: "40rem" }}>
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 dark:border-white/10">
                <TableHead className="text-xs font-semibold">Stock</TableHead>
                <TableHead className="text-xs text-right font-semibold">
                  Price
                </TableHead>
                <TableHead className="text-xs text-right font-semibold">
                  Change
                </TableHead>
                <TableHead className="text-xs text-center font-semibold hidden sm:table-cell">
                  Today
                </TableHead>
                <TableHead className="text-xs text-center font-semibold hidden md:table-cell">
                  KOLs
                </TableHead>
                <TableHead className="text-xs text-center font-semibold w-12">
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(6)].map((_, i) => (
                <StockRowSkeleton key={i} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    ) : stocks.length === 0 ? (
      // Empty state
      <div className="text-center py-8 text-gray-500 dark:text-white/50">
        <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No tracked stocks yet</p>
        <p className="text-xs mt-2">Click the add button to start tracking</p>
      </div>
    ) : (
      // Stocks table
      <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: "40rem" }}>
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 dark:border-white/10">
                <TableHead className="text-xs font-semibold">Stock</TableHead>
                <TableHead className="text-xs text-right font-semibold">
                  Price
                </TableHead>
                <TableHead className="text-xs text-right font-semibold">
                  Change
                </TableHead>
                <TableHead className="text-xs text-center font-semibold hidden sm:table-cell">
                  Today
                </TableHead>
                <TableHead className="text-xs text-center font-semibold hidden md:table-cell">
                  KOLs
                </TableHead>
                <TableHead className="text-xs text-center font-semibold w-12">
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrichedStocks.map((stock) => (
                <StockRow
                  key={stock.symbol}
                  id={stock.id}
                  symbol={stock.symbol}
                  companyName={stock.companyName}
                  logo={stock.logo ?? null}
                  price={stock.price}
                  changePercent={stock.changePercent}
                  sparklineData={stock.sparklineData}
                  mentionCount={stock.mentionCount}
                  topAuthors={stock.topAuthors}
                  isUntracking={untrackingIds.has(stock.id)}
                  onUntrack={(e) => handleUntrack(e, stock.id, stock.symbol)}
                  onClick={() => handleStockClick(stock.symbol)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );

  if (!withCard) {
    return tableContent;
  }

  return (
    <SectionCard
      title="Tracked Stocks"
      padding="md"
      contentClassName="px-4 pb-4"
      headerRightExtra={<RightExtra />}
    >
      {tableContent}
    </SectionCard>
  );
}
