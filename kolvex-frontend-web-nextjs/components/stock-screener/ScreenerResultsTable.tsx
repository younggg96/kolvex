"use client";

import Link from "next/link";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/ui/company-logo";
import type {
  ScreenResponse,
  StockSnapshot,
  AIStockScore,
} from "@/lib/stockScreenerApi";

interface ScreenerResultsTableProps {
  data: ScreenResponse;
  sortBy: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
  onPageChange: (page: number) => void;
  aiScores?: AIStockScore[];
  locale: string;
}

function formatMarketCap(value: number): string {
  if (!value) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || value === 0) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null) return "—";
  return value.toFixed(decimals);
}

const COLUMNS = [
  { key: "symbol", label: "Symbol", label_zh: "股票", sortable: false, className: "min-w-[160px] sticky left-0 z-10 bg-card" },
  { key: "current_price", label: "Price", label_zh: "价格", sortable: true, className: "min-w-[80px]" },
  { key: "change_percent", label: "Change", label_zh: "涨跌", sortable: true, className: "min-w-[80px]" },
  { key: "market_cap", label: "Mkt Cap", label_zh: "市值", sortable: true, className: "min-w-[90px]" },
  { key: "pe_ratio", label: "P/E", label_zh: "PE", sortable: true, className: "min-w-[70px]" },
  { key: "return_on_equity", label: "ROE", label_zh: "ROE", sortable: true, className: "min-w-[70px]" },
  { key: "revenue_growth", label: "Rev Growth", label_zh: "营收增长", sortable: true, className: "min-w-[90px]" },
  { key: "profit_margins", label: "Margin", label_zh: "利润率", sortable: true, className: "min-w-[80px]" },
  { key: "dividend_yield", label: "Div Yield", label_zh: "股息率", sortable: true, className: "min-w-[80px]" },
  { key: "debt_to_equity", label: "D/E", label_zh: "D/E", sortable: true, className: "min-w-[60px]" },
  { key: "ai_score", label: "AI Score", label_zh: "AI评分", sortable: false, className: "min-w-[80px]" },
] as const;

function SortIcon({ field, sortBy, sortDirection }: { field: string; sortBy: string; sortDirection: string }) {
  if (field !== sortBy) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  return sortDirection === "asc" ? (
    <ArrowUp className="w-3 h-3 text-primary" />
  ) : (
    <ArrowDown className="w-3 h-3 text-primary" />
  );
}

export default function ScreenerResultsTable({
  data,
  sortBy,
  sortDirection,
  onSort,
  onPageChange,
  aiScores,
  locale,
}: ScreenerResultsTableProps) {
  const isZh = locale === "zh";
  const scoreMap = new Map(aiScores?.map((s) => [s.symbol, s]));

  const renderCell = (stock: StockSnapshot, col: (typeof COLUMNS)[number]) => {
    switch (col.key) {
      case "symbol":
        return (
          <Link
            href={`/dashboard/stock/${stock.symbol}`}
            className="flex items-center gap-2 group/link"
          >
            <CompanyLogo symbol={stock.symbol} size="sm" />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-foreground group-hover/link:text-primary transition-colors">
                {stock.symbol}
              </span>
              <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {stock.name}
              </p>
            </div>
          </Link>
        );
      case "current_price":
        return (
          <span className="text-xs font-medium tabular-nums">
            ${formatNumber(stock.current_price)}
          </span>
        );
      case "change_percent":
        return (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              stock.change_percent > 0
                ? "text-green-500"
                : stock.change_percent < 0
                ? "text-red-500"
                : "text-muted-foreground"
            )}
          >
            {stock.change_percent > 0 ? "+" : ""}
            {formatNumber(stock.change_percent)}%
          </span>
        );
      case "market_cap":
        return (
          <span className="text-xs tabular-nums">
            {formatMarketCap(stock.market_cap)}
          </span>
        );
      case "pe_ratio":
        return (
          <span className="text-xs tabular-nums">
            {formatNumber(stock.pe_ratio, 1)}
          </span>
        );
      case "return_on_equity":
        return (
          <span className="text-xs tabular-nums">
            {formatPercent(stock.return_on_equity)}
          </span>
        );
      case "revenue_growth":
        return (
          <span
            className={cn(
              "text-xs tabular-nums",
              stock.revenue_growth > 0
                ? "text-green-500"
                : stock.revenue_growth < 0
                ? "text-red-500"
                : ""
            )}
          >
            {formatPercent(stock.revenue_growth)}
          </span>
        );
      case "profit_margins":
        return (
          <span className="text-xs tabular-nums">
            {formatPercent(stock.profit_margins)}
          </span>
        );
      case "dividend_yield":
        return (
          <span className="text-xs tabular-nums">
            {formatPercent(stock.dividend_yield)}
          </span>
        );
      case "debt_to_equity":
        return (
          <span className="text-xs tabular-nums">
            {formatNumber(stock.debt_to_equity, 1)}
          </span>
        );
      case "ai_score": {
        const score = scoreMap.get(stock.symbol);
        if (!score) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "h-5 min-w-[36px] rounded-full flex items-center justify-center text-[10px] font-bold text-white",
                score.ai_score >= 75
                  ? "bg-green-500"
                  : score.ai_score >= 50
                  ? "bg-yellow-500"
                  : "bg-red-500"
              )}
            >
              {score.ai_score}
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Summary row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <p className="text-xs text-muted-foreground">
          {isZh
            ? `共 ${data.total} 只股票`
            : `${data.total} stock${data.total !== 1 ? "s" : ""} found`}
        </p>
        <p className="text-xs text-muted-foreground">
          {isZh ? "页" : "Page"} {data.page} / {data.total_pages || 1}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2 text-[11px] font-semibold text-muted-foreground whitespace-nowrap",
                    col.className
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => onSort(col.key)}
                    >
                      {isZh ? col.label_zh : col.label}
                      <SortIcon
                        field={col.key}
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                      />
                    </button>
                  ) : (
                    <>{isZh ? col.label_zh : col.label}</>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.results.map((stock) => (
              <tr
                key={stock.symbol}
                className="border-b border-border/50 hover:bg-muted/20 transition-colors"
              >
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-3 py-2.5", col.className)}
                  >
                    {renderCell(stock, col)}
                  </td>
                ))}
              </tr>
            ))}
            {data.results.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-10 text-center text-xs text-muted-foreground"
                >
                  {isZh ? "没有匹配的股票" : "No matching stocks"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-border">
          <Button
            variant="outline"
            size="xs"
            disabled={data.page <= 1}
            onClick={() => onPageChange(data.page - 1)}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          {Array.from({ length: Math.min(data.total_pages, 7) }, (_, i) => {
            let pageNum: number;
            if (data.total_pages <= 7) {
              pageNum = i + 1;
            } else if (data.page <= 4) {
              pageNum = i + 1;
            } else if (data.page >= data.total_pages - 3) {
              pageNum = data.total_pages - 6 + i;
            } else {
              pageNum = data.page - 3 + i;
            }
            return (
              <Button
                key={pageNum}
                variant={pageNum === data.page ? "default" : "outline"}
                size="xs"
                className="min-w-[28px]"
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="xs"
            disabled={data.page >= data.total_pages}
            onClick={() => onPageChange(data.page + 1)}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
