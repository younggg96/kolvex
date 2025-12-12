"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  TrackedStock,
  TopAuthor,
  deleteTrackedStock,
} from "@/lib/trackedStockApi";
import { Building2, Star, Loader2, MessageSquare } from "lucide-react";
import { useMultipleQuotes } from "@/hooks/useStockData";
import CompanyLogo from "@/components/stock/CompanyLogo";
import MiniSparkline from "@/components/stock/MiniSparkline";
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

const REFRESH_INTERVAL = 15 * 60 * 1000;

const getSentimentRingColor = (sentiment?: string | null) => {
  if (!sentiment) return "ring-gray-300 dark:ring-gray-600";
  if (sentiment === "bullish") return "ring-green-400 dark:ring-green-500";
  if (sentiment === "bearish") return "ring-red-400 dark:ring-red-500";
  return "ring-gray-300 dark:ring-gray-600";
};

function StockRow({
  symbol,
  companyName,
  price,
  changePercent,
  sparklineData,
  mentionCount,
  topAuthors,
  isUntracking,
  onUntrack,
  onClick,
}: {
  symbol: string;
  companyName: string;
  price: number;
  changePercent: number;
  sparklineData: number[];
  mentionCount: number;
  topAuthors: TopAuthor[];
  isUntracking: boolean;
  onUntrack: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  return (
    <TableRow
      onClick={onClick}
      className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 cursor-pointer"
    >
      <TableCell className="py-3">
        <div className="flex items-center gap-2.5">
          <CompanyLogo symbol={symbol} name={companyName} size="sm" />
          <div className="min-w-0">
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

      <TableCell className="text-xs text-right font-semibold text-gray-900 dark:text-white py-3">
        ${price.toFixed(2)}
      </TableCell>

      <TableCell className="text-xs text-right font-semibold py-3">
        <span
          className={changePercent >= 0 ? "text-green-500" : "text-red-500"}
        >
          {changePercent >= 0 ? "+" : ""}
          {changePercent.toFixed(2)}%
        </span>
      </TableCell>

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

      <TableCell className="py-3 hidden md:table-cell">
        <div className="flex flex-col items-center gap-1">
          {topAuthors.length > 0 && (
            <div className="flex -space-x-2">
              {topAuthors.slice(0, 4).map((author, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "relative rounded-full ring-2 ring-white dark:ring-gray-900 bg-gray-100 dark:bg-gray-800",
                    getSentimentRingColor(author.sentiment)
                  )}
                  title={`${author.display_name || author.username}: ${
                    author.tweet_count
                  } tweets`}
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
                <div className="relative w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-[10px] font-medium">
                  +{topAuthors.length - 4}
                </div>
              )}
            </div>
          )}
        </div>
      </TableCell>

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
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-gray-300 dark:bg-white/10 animate-pulse" />
          <div>
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

function TableHeaderRow() {
  return (
    <TableRow className="border-b border-gray-200 dark:border-white/10">
      <TableHead className="text-xs font-semibold">Stock</TableHead>
      <TableHead className="text-xs text-right font-semibold">Price</TableHead>
      <TableHead className="text-xs text-right font-semibold">Change</TableHead>
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
  );
}

export default function TrackedStocksTable() {
  const router = useRouter();
  const [stocks, setStocks] = useState<TrackedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [untrackingIds, setUntrackingIds] = useState<Set<string>>(new Set());
  const [sparklineDataMap, setSparklineDataMap] = useState<
    Map<string, number[]>
  >(new Map());

  // 加载股票数据
  const loadStocks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tracked-stocks");
      if (!res.ok) throw new Error("Failed to fetch stocks");
      const data = await res.json();
      setStocks(data);
    } catch (err) {
      console.error("Error loading stocks:", err);
      toast.error("Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  const symbols = useMemo(() => stocks.map((s) => s.symbol), [stocks]);
  const { data: realtimeQuotes } = useMultipleQuotes(symbols, REFRESH_INTERVAL);

  // 获取迷你图数据
  useEffect(() => {
    if (symbols.length === 0) return;

    const fetchSparklines = async () => {
      const newMap = new Map<string, number[]>();
      await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const res = await fetch(
              `/api/stocks?action=chart&symbol=${symbol}&interval=5m`
            );
            if (res.ok) {
              const data = await res.json();
              newMap.set(
                symbol,
                data.map((d: { value: number }) => d.value)
              );
            }
          } catch (err) {
            console.error(`Failed to fetch sparkline for ${symbol}:`, err);
          }
        })
      );
      setSparklineDataMap(newMap);
    };

    fetchSparklines();
  }, [symbols.join(",")]);

  const quotesMap = useMemo(() => {
    const map = new Map();
    realtimeQuotes.forEach((q) => map.set(q.symbol, q));
    return map;
  }, [realtimeQuotes]);

  const enrichedStocks = useMemo(() => {
    return stocks.map((stock) => {
      const quote = quotesMap.get(stock.symbol);
      return {
        ...stock,
        companyName: quote?.name || stock.company_name || stock.symbol,
        price: quote?.price ?? 0,
        changePercent: quote?.changePercent ?? 0,
        sparklineData: sparklineDataMap.get(stock.symbol) || [],
      };
    });
  }, [stocks, quotesMap, sparklineDataMap]);

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
      loadStocks(); // 重新加载数据
    } catch (err) {
      console.error("Failed to untrack stock:", err);
      toast.error("Failed to remove from watchlist");
    } finally {
      setUntrackingIds((prev) => {
        const next = new Set(prev);
        next.delete(stockId);
        return next;
      });
    }
  };

  // Loading 状态
  if (loading && stocks.length === 0) {
    return (
      <div className="h-full border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader>
              <TableHeaderRow />
            </TableHeader>
            <TableBody>
              {[...Array(6)].map((_, i) => (
                <StockRowSkeleton key={i} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // 空状态
  if (stocks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-white/50">
        <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No tracked stocks yet</p>
        <p className="text-xs mt-2">Click the add button to start tracking</p>
      </div>
    );
  }

  // 股票表格
  return (
    <div className="h-full border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
      <div className="h-full overflow-auto">
        <Table>
          <TableHeader>
            <TableHeaderRow />
          </TableHeader>
          <TableBody>
            {enrichedStocks.map((stock) => (
              <StockRow
                key={stock.symbol}
                symbol={stock.symbol}
                companyName={stock.companyName}
                price={stock.price}
                changePercent={stock.changePercent}
                sparklineData={stock.sparklineData}
                mentionCount={stock.mention_count}
                topAuthors={stock.top_authors}
                isUntracking={untrackingIds.has(stock.id)}
                onUntrack={(e) => handleUntrack(e, stock.id, stock.symbol)}
                onClick={() => router.push(`/dashboard/stock/${stock.symbol}`)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
