"use client";

import { useState, useEffect } from "react";
import CompanyLogo from "./CompanyLogo";
import SearchWithAutocomplete from "./SearchWithAutocomplete";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Building2, X } from "lucide-react";
import { TrackedStock } from "@/lib/trackedStockApi";

interface StockSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (stock: StockSearchResult) => void;
  trackedStocks?: TrackedStock[];
  onDelete?: (stockId: string) => void;
}

interface StockSearchResult {
  id: string;
  symbol: string;
  name: string;
  logo?: string;
  type?: "equity" | "crypto" | "index";
}

// 热门股票列表
const popularEquities: StockSearchResult[] = [
  {
    id: "TSLA",
    symbol: "TSLA",
    name: "Tesla",
    logo: "https://logo.clearbit.com/tesla.com",
    type: "equity",
  },
  {
    id: "NVDA",
    symbol: "NVDA",
    name: "NVIDIA",
    logo: "https://logo.clearbit.com/nvidia.com",
    type: "equity",
  },
  {
    id: "AAPL",
    symbol: "AAPL",
    name: "Apple",
    logo: "https://logo.clearbit.com/apple.com",
    type: "equity",
  },
  {
    id: "AMZN",
    symbol: "AMZN",
    name: "Amazon",
    logo: "https://logo.clearbit.com/amazon.com",
    type: "equity",
  },
  {
    id: "MSFT",
    symbol: "MSFT",
    name: "Microsoft",
    logo: "https://logo.clearbit.com/microsoft.com",
    type: "equity",
  },
  {
    id: "GOOGL",
    symbol: "GOOGL",
    name: "Google",
    logo: "https://logo.clearbit.com/google.com",
    type: "equity",
  },
  {
    id: "META",
    symbol: "META",
    name: "Meta",
    logo: "https://logo.clearbit.com/meta.com",
    type: "equity",
  },
  {
    id: "NFLX",
    symbol: "NFLX",
    name: "Netflix",
    logo: "https://logo.clearbit.com/netflix.com",
    type: "equity",
  },
];

export default function StockSearchDialog({
  open,
  onOpenChange,
  onSelect,
  trackedStocks = [],
  onDelete,
}: StockSearchDialogProps) {
  // 过滤函数：根据搜索词过滤股票
  const filterStocks = (stocks: StockSearchResult[], searchTerm: string) => {
    const term = searchTerm.toUpperCase();
    return stocks.filter(
      (stock) =>
        stock.symbol.includes(term) ||
        stock.name.toUpperCase().includes(term.toUpperCase())
    );
  };

  // 渲染股票项
  const renderStockItem = (
    stock: StockSearchResult,
    handleSelect: (stock: StockSearchResult) => void
  ) => {
    return (
      <button
        onClick={() => handleSelect(stock)}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 last:border-b-0"
      >
        {/* Logo */}
        {stock.logo ? (
          <CompanyLogo
            logoUrl={stock.logo}
            symbol={stock.symbol}
            name={stock.name}
            size="sm"
            shape="rounded"
            border="light"
            unoptimized
          />
        ) : (
          <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 border border-gray-200 dark:border-gray-700">
            <Building2 className="w-4 h-4 text-gray-400" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="font-semibold text-sm text-gray-900 dark:text-white">
            {stock.symbol}
          </div>
          <div className="text-xs text-gray-500 dark:text-white/50 truncate">
            {stock.name}
          </div>
        </div>
      </button>
    );
  };

  const handleDelete = (stockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(stockId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[500px] sm:max-w-[500px] !p-0 gap-0 min-h-[500px] max-h-[85vh] sm:max-h-[600px]">
        <DialogHeader>
          <div className="px-6 pt-6 pb-2">
            <DialogTitle className="mb-4">My Watchlist</DialogTitle>

            {/* Search with Autocomplete Component */}
            <SearchWithAutocomplete
              placeholder="Search stocks..."
              items={popularEquities}
              popularItems={popularEquities}
              onSelect={onSelect}
              filterFunction={filterStocks}
              renderItem={renderStockItem}
              popularLabel="POPULAR STOCKS"
              maxResults={8}
            />
          </div>
        </DialogHeader>

        {/* Tracked Stocks List */}
        <div className="max-h-[calc(85vh-140px)] sm:max-h-[460px] overflow-y-auto">
          {trackedStocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 text-gray-500 dark:text-white/50">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-1">No tracked stocks yet</p>
              <p className="text-xs text-gray-400 dark:text-white/40">
                Search and add stocks to start tracking
              </p>
            </div>
          ) : (
            <div>
              {trackedStocks.map((stock) => (
                <div
                  key={stock.id}
                  className="flex items-center gap-2.5 px-6 py-3 transition-colors border-b border-gray-100 dark:border-white/5 last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  {/* Logo */}
                  {stock.logo_url ? (
                    <CompanyLogo
                      logoUrl={stock.logo_url}
                      symbol={stock.symbol}
                      name={stock.company_name || stock.symbol}
                      size="sm"
                      shape="rounded"
                      border="light"
                      unoptimized
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 border border-gray-200 dark:border-gray-700">
                      <Building2 className="w-4 h-4 text-gray-400" />
                    </div>
                  )}

                  {/* Stock Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 dark:text-white">
                      {stock.symbol}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-white/50 truncate">
                      {stock.company_name || stock.symbol}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDelete(stock.id, e)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
