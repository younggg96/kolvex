"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { TrackedStock, deleteTrackedStock } from "@/lib/trackedStockApi";
import { useMultipleQuotes } from "@/hooks/useStockData";
import { Table, TableBody, TableHeader } from "@/components/ui/table";
import { toast } from "sonner";
import { StockRow } from "@/components/stock/StockRow";
import { EmptyRow } from "@/components/stock/StockRowSkeleton";
import { TrackingStockSkeleton } from "./TrackingStockSkeleton";
import { TableHeaderRow } from "./TableHeaderRow";
import { SectionCard } from "../layout";

const COL_SPAN = 5; // Stock, Price, Change, Sparkline, Top Authors

const REFRESH_INTERVAL = 15 * 60 * 1000;

export default function TrackingStocksTable() {
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
      const res = await fetch("/api/tracking-stocks");
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
  const symbolsKey = symbols.join(",");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

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

  return (
    <SectionCard
      padding="none"
      useSectionHeader={false}
      scrollable
      contentClassName="h-full max-h-[600px] overflow-y-auto custom-scrollbar"
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-white dark:bg-card-dark">
          <TableHeaderRow className="border-b border-gray-200 dark:border-white/10" />
        </TableHeader>
        <TableBody>
          {loading && stocks.length === 0 ? (
            // Loading 状态
            Array.from({ length: 6 }).map((_, i) => (
              <TrackingStockSkeleton key={i} />
            ))
          ) : stocks.length === 0 ? (
            // 空状态
            <EmptyRow
              colSpan={COL_SPAN}
              searchQuery=""
              emptyMessage="No tracking stocks yet"
              emptySubMessage="Click the + button to start tracking"
            />
          ) : (
            // 股票列表
            enrichedStocks.map((stock) => (
              <StockRow
                key={stock.symbol}
                variant="tracking"
                ticker={stock.symbol}
                companyName={stock.companyName}
                price={stock.price}
                changePercent={stock.changePercent}
                sparklineData={stock.sparklineData}
                topAuthors={stock.top_authors?.map((a) => ({
                  username: a.username,
                  displayName: a.display_name ?? undefined,
                  avatarUrl: a.avatar_url ?? "",
                  tweetCount: a.tweet_count ?? 0,
                  sentiment: a.sentiment,
                }))}
                isUntracking={untrackingIds.has(stock.id)}
                onUntrack={(e) => handleUntrack(e, stock.id, stock.symbol)}
              />
            ))
          )}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
