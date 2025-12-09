"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { TrackedStock } from "@/lib/trackedStockApi";
import { Building2, Plus } from "lucide-react";
import { useMultipleQuotes } from "@/hooks/useStockData";
import { formatVolume, formatMarketCap } from "@/lib/stockApi";
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
import { Button } from "@/components/ui/button";

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
  symbol: string;
  companyName: string;
  logo: string | null;
  price: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  onClick: () => void;
}

function StockRow({
  symbol,
  companyName,
  logo,
  price,
  changePercent,
  volume,
  marketCap,
  onClick,
}: StockRowProps) {
  const getPriceChangeColor = (change: number) => {
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
            logoUrl={logo || ""}
            symbol={symbol}
            name={companyName}
            size="sm"
          />
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

      {/* Volume */}
      <TableCell className="text-xs text-right text-gray-600 dark:text-white/60 py-3 hidden sm:table-cell">
        {volume ? formatVolume(volume) : "-"}
      </TableCell>

      {/* Market Cap */}
      <TableCell className="text-xs text-right text-gray-600 dark:text-white/60 py-3 hidden md:table-cell">
        {marketCap ? formatMarketCap(marketCap) : "-"}
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
      <TableCell className="text-right py-3 hidden sm:table-cell">
        <div className="w-14 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse ml-auto" />
      </TableCell>
      <TableCell className="text-right py-3 hidden md:table-cell">
        <div className="w-16 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse ml-auto" />
      </TableCell>
    </TableRow>
  );
}

export default function TrackedStocksTable({
  stocks,
  loading = false,
  onAddClick,
  withCard = true,
}: TrackedStocksTableProps) {
  const router = useRouter();

  // Get all stock symbols
  const symbols = useMemo(() => stocks.map((stock) => stock.symbol), [stocks]);

  // Fetch real-time quotes for all tracked stocks (refresh every 15 minutes)
  const { data: realtimeQuotes } = useMultipleQuotes(symbols, REFRESH_INTERVAL);

  // Create a map for quick lookup
  const quotesMap = useMemo(() => {
    const map = new Map();
    realtimeQuotes.forEach((quote) => {
      map.set(quote.symbol, quote);
    });
    return map;
  }, [realtimeQuotes]);

  // Merge real-time data with tracked stocks
  const enrichedStocks = useMemo(() => {
    return stocks.map((stock) => {
      const realtimeQuote = quotesMap.get(stock.symbol);
      return {
        ...stock,
        companyName: realtimeQuote?.name || stock.company_name || stock.symbol,
        logo: stock.logo_url,
        price: realtimeQuote?.price ?? 0,
        changePercent: realtimeQuote?.changePercent ?? 0,
        volume: realtimeQuote?.volume,
        marketCap: realtimeQuote?.marketCap,
      };
    });
  }, [stocks, quotesMap]);

  const handleStockClick = (symbol: string) => {
    router.push(`/dashboard/stock/${symbol}`);
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
                <TableHead className="text-xs text-right font-semibold hidden sm:table-cell">
                  Volume
                </TableHead>
                <TableHead className="text-xs text-right font-semibold hidden md:table-cell">
                  Mkt Cap
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
                <TableHead className="text-xs text-right font-semibold hidden sm:table-cell">
                  Volume
                </TableHead>
                <TableHead className="text-xs text-right font-semibold hidden md:table-cell">
                  Mkt Cap
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrichedStocks.map((stock) => (
                <StockRow
                  key={stock.symbol}
                  symbol={stock.symbol}
                  companyName={stock.companyName}
                  logo={stock.logo ?? null}
                  price={stock.price}
                  changePercent={stock.changePercent}
                  volume={stock.volume}
                  marketCap={stock.marketCap}
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
      title="My Watchlist"
      padding="md"
      contentClassName="px-4 pb-4"
      headerRightExtra={<RightExtra />}
    >
      {tableContent}
    </SectionCard>
  );
}
