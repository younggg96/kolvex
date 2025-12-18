"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TrackedStock, deleteTrackedStock } from "@/lib/trackedStockApi";
import { Building2 } from "lucide-react";
import { useMultipleQuotes } from "@/hooks/useStockData";
import { Table, TableBody, TableHeader } from "@/components/ui/table";
import { toast } from "sonner";
import { StockRow } from "./StockRow";
import { StockRowSkeleton } from "./StockRowSkeleton";
import { TableHeaderRow } from "./TableHeaderRow";
import { SectionCard } from "../layout";

const REFRESH_INTERVAL = 15 * 60 * 1000;

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
      <div className="h-full border border-border-light dark:border-border-dark rounded-lg overflow-hidden bg-white dark:bg-card-dark">
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
      <SectionCard padding="none" useSectionHeader={false}>
        <div className="text-center py-8 text-gray-500 dark:text-white/50">
          <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No tracked stocks yet</p>
          <p className="text-xs mt-2">Click the add button to start tracking</p>
        </div>{" "}
      </SectionCard>
    );
  }

  // 股票表格
  return (
    <SectionCard padding="none" useSectionHeader={false}>
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
    </SectionCard>
  );
}
