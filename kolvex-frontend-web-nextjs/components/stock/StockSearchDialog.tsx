"use client";

import { useCallback, useEffect, useState } from "react";
import CompanyLogo from "@/components/ui/company-logo";
import SearchWithAutocomplete from "@/components/common/SearchWithAutocomplete";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, MessageSquare, Star, Loader2, Flame } from "lucide-react";
import { TrackedStock } from "@/lib/trackedStockApi";

interface StockSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (stock: StockSearchResult) => void;
  trackedStocks?: TrackedStock[];
}

export interface StockSearchResult {
  id: string;
  symbol: string;
  name: string;
  logo?: string;
  type?: "equity" | "crypto"; // 只支持美股和加密货币
  sector?: string;
  exchange?: string;
  mentionCount?: number;
}

// 资产类型标签配置（只有加密货币显示标签，股票默认不显示）
const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  equity: {
    label: "Stock",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  crypto: {
    label: "Crypto",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
};

export default function StockSearchDialog({
  open,
  onOpenChange,
  onSelect,
  trackedStocks = [],
}: StockSearchDialogProps) {
  const [popularStocks, setPopularStocks] = useState<StockSearchResult[]>([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(false);

  // 获取已追踪的股票 symbol 集合
  const trackedSymbols = new Set(trackedStocks.map((s) => s.symbol));

  // 异步搜索函数 - 使用自动补全端点（更快）
  const asyncSearchFunction = useCallback(
    async (searchTerm: string): Promise<StockSearchResult[]> => {
      try {
        // 使用 autocomplete 模式，响应更快
        const response = await fetch(
          `/api/stocks/search?query=${encodeURIComponent(
            searchTerm
          )}&limit=10&mode=autocomplete`
        );
        if (!response.ok) throw new Error("Search failed");

        const data = await response.json();
        return (data.results || []).map((item: any) => ({
          id: item.symbol,
          symbol: item.symbol,
          name: item.name || item.symbol,
          type: item.type || "equity",
          sector: item.sector,
          exchange: item.exchange,
          mentionCount: item.mention_count,
        }));
      } catch (error) {
        console.error("Stock search error:", error);
        return [];
      }
    },
    []
  );

  // 异步获取热门股票 - 使用完整搜索以获取 KOL 提及数据
  const asyncPopularFunction = useCallback(async (): Promise<
    StockSearchResult[]
  > => {
    try {
      const response = await fetch(`/api/stocks/search?limit=8&mode=popular`);
      if (!response.ok) throw new Error("Failed to get popular stocks");

      const data = await response.json();
      return (data.results || []).map((item: any) => ({
        id: item.symbol,
        symbol: item.symbol,
        name: item.name || item.symbol,
        type: item.type || "equity",
        sector: item.sector,
        exchange: item.exchange,
        mentionCount: item.mention_count,
      }));
    } catch (error) {
      console.error("Popular stocks error:", error);
      return [];
    }
  }, []);

  // 渲染股票项（搜索结果中的每一项）
  const renderStockItem = (
    stock: StockSearchResult,
    handleSelect: (stock: StockSearchResult) => void
  ) => {
    const typeInfo = TYPE_LABELS[stock.type || "equity"];
    const isTracked = trackedSymbols.has(stock.symbol);

    return (
      <div className="w-full px-3 py-2.5 flex items-center gap-2.5 border-b border-gray-100 dark:border-white/5 last:border-b-0">
        {/* Logo */}
        <CompanyLogo
          symbol={stock.symbol}
          name={stock.name}
          size="sm"
          shape="rounded"
          border="light"
          unoptimized
        />

        {/* Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900 dark:text-white">
              {stock.symbol}
            </span>
            {/* Type Badge */}
            {typeInfo && stock.type !== "equity" && (
              <span
                className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${typeInfo.color}`}
              >
                {typeInfo.label}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-white/50 truncate">
            {stock.name}
            {stock.exchange && (
              <span className="ml-1 text-gray-400">• {stock.exchange}</span>
            )}
          </div>
        </div>

        {/* Track Button */}
        {isTracked ? (
          <span className="text-[10px] text-yellow-500 dark:text-yellow-400 font-medium px-2 py-1 bg-yellow-50 dark:bg-yellow-900/20 rounded flex-shrink-0">
            Tracked
          </span>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(stock);
            }}
            className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors flex-shrink-0"
          >
            <Star className="w-4 h-4 text-yellow-500" />
          </button>
        )}
      </div>
    );
  };

  // 当对话框打开时加载热门股票
  useEffect(() => {
    if (open && popularStocks.length === 0) {
      setIsLoadingPopular(true);
      asyncPopularFunction()
        .then(setPopularStocks)
        .finally(() => setIsLoadingPopular(false));
    }
  }, [open, asyncPopularFunction, popularStocks.length]);

  // 处理点击热门股票
  const handlePopularStockClick = (stock: StockSearchResult) => {
    if (!trackedSymbols.has(stock.symbol)) {
      onSelect(stock);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[500px] sm:max-w-[500px] !p-0 gap-0 min-h-[500px] max-h-[85vh] sm:max-h-[600px]">
        <DialogHeader>
          <div className="px-6 pt-6 pb-2">
            <DialogTitle className="mb-4">Track a Stock</DialogTitle>

            {/* Search with Autocomplete Component */}
            <SearchWithAutocomplete
              placeholder="Search stocks by symbol or name to track..."
              onSelect={onSelect}
              asyncSearchFunction={asyncSearchFunction}
              renderItem={renderStockItem}
              maxResults={10}
              debounceMs={200}
              showPopularOnFocus={false}
            />
          </div>
        </DialogHeader>

        {/* Popular Stocks List */}
        <div className="border-t border-gray-100 dark:border-white/10">
          <div className="px-6 py-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-semibold text-gray-500 dark:text-white/50 tracking-wide">
              Trending Stocks
            </span>
          </div>

          <div className="max-h-[calc(85vh-200px)] sm:max-h-[380px] overflow-y-auto">
            {isLoadingPopular ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : popularStocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 text-gray-500 dark:text-white/50">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No trending stocks available</p>
              </div>
            ) : (
              <div>
                {popularStocks.map((stock) => {
                  const isTracked = trackedSymbols.has(stock.symbol);
                  const typeInfo = TYPE_LABELS[stock.type || "equity"];

                  return (
                    <button
                      key={stock.id}
                      onClick={() => handlePopularStockClick(stock)}
                      disabled={isTracked}
                      className={`w-full flex items-center gap-2.5 px-6 py-3 transition-colors border-b border-gray-100 dark:border-white/5 last:border-b-0 ${
                        isTracked
                          ? "opacity-50 cursor-not-allowed bg-gray-50/50 dark:bg-white/2"
                          : "hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                    >
                      {/* Logo */}
                      <CompanyLogo
                        symbol={stock.symbol}
                        name={stock.name}
                        size="sm"
                        shape="rounded"
                        border="light"
                        unoptimized
                      />

                      {/* Stock Info */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">
                            {stock.symbol}
                          </span>
                          {/* Type Badge */}
                          {typeInfo && stock.type !== "equity" && (
                            <span
                              className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${typeInfo.color}`}
                            >
                              {typeInfo.label}
                            </span>
                          )}
                          {/* KOL Mention Count */}
                          {stock.mentionCount && stock.mentionCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                              <MessageSquare className="w-3 h-3" />
                              {stock.mentionCount}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-white/50 truncate">
                          {stock.name}
                        </div>
                      </div>

                      {/* Track Button / Tracked Badge */}
                      {isTracked ? (
                        <span className="text-xs text-yellow-500 dark:text-yellow-400 font-medium px-2 py-1 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                          Tracked
                        </span>
                      ) : (
                        <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors flex-shrink-0">
                          <Star className="w-4 h-4 text-yellow-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
