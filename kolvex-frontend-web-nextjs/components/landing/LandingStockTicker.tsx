"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useMultipleQuotes } from "@/hooks/useStockData";
import CompanyLogo from "@/components/ui/company-logo";

// Default symbols to display in the ticker
const TICKER_SYMBOLS = [
  "TSLA",
  "NVDA",
  "AAPL",
  "MSFT",
  "AMZN",
  "GOOGL",
  "META",
  "NFLX",
  "AMD",
  "COIN",
];

// Company names mapping for alt text
const COMPANY_NAMES: Record<string, string> = {
  TSLA: "Tesla",
  NVDA: "NVIDIA",
  AAPL: "Apple",
  MSFT: "Microsoft",
  AMZN: "Amazon",
  GOOGL: "Alphabet",
  META: "Meta",
  NFLX: "Netflix",
  AMD: "AMD",
  COIN: "Coinbase",
};

// Fallback static data (shown while loading or on error)
const FALLBACK_DATA = [
  { symbol: "TSLA", price: 245.34, changePercent: 4.2 },
  { symbol: "NVDA", price: 482.12, changePercent: 2.1 },
  { symbol: "AAPL", price: 189.43, changePercent: -0.5 },
  { symbol: "MSFT", price: 372.15, changePercent: 1.3 },
  { symbol: "AMZN", price: 145.18, changePercent: 0.8 },
  { symbol: "GOOGL", price: 132.45, changePercent: -1.2 },
  { symbol: "META", price: 324.56, changePercent: 3.4 },
  { symbol: "NFLX", price: 456.78, changePercent: 2.5 },
  { symbol: "AMD", price: 118.9, changePercent: -0.7 },
  { symbol: "COIN", price: 154.32, changePercent: 8.4 },
];

// Refresh every 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000;

export default function LandingStockTicker() {
  const { data: quotes, error } = useMultipleQuotes(
    TICKER_SYMBOLS,
    REFRESH_INTERVAL
  );

  // Use real data if available, otherwise fallback
  const stockData =
    quotes.length > 0
      ? quotes.map((q) => ({
        symbol: q.symbol,
        price: q.price,
        changePercent: q.changePercent,
      }))
      : FALLBACK_DATA;

  // Duplicate for seamless loop
  const displayStocks = [...stockData, ...stockData, ...stockData];

  const formatPrice = (price: number) => {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <div className="w-full relative overflow-hidden py-3 md:py-6">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-white to-primary/10 dark:from-primary/10 dark:via-primary/5 dark:to-primary/10 backdrop-blur-sm" />

      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Live indicator */}
      {quotes.length > 0 && !error && (
        <div className="absolute top-1/2 -translate-y-1/2 left-2 md:left-6 z-20 flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-primary/60 border border-primary/20 backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-white"></span>
          </span>
          <span className="text-[10px] md:text-xs font-bold text-white">
            LIVE
          </span>
        </div>
      )}

      {/* Ticker content */}
      <div className="relative">
        <div className="flex animate-ticker hover:[animation-play-state:paused] whitespace-nowrap">
          {displayStocks.map((stock, idx) => {
            const isUp = stock.changePercent >= 0;
            return (
              <div
                key={idx}
                className="group inline-flex items-center gap-1.5 md:gap-3 px-2.5 md:px-5 py-1.5 md:py-2.5 mx-1 md:mx-2 rounded-xl md:rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-gray-200/50 dark:border-white/5 hover:border-primary/30 hover:bg-white dark:hover:bg-white/[0.06] transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md dark:shadow-none"
              >
                {/* Company Logo - hidden on mobile to save space */}
                <div className="hidden sm:block">
                  <CompanyLogo
                    symbol={stock.symbol}
                    name={COMPANY_NAMES[stock.symbol]}
                    size="sm"
                    shape="rounded"
                    border="light"
                    borderColor="gray"
                    className="group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Stock symbol */}
                <span className="font-bold text-xs md:text-base text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                  {stock.symbol}
                </span>

                {/* Price */}
                <span className="text-xs md:text-base text-gray-600 dark:text-white/60 font-medium tabular-nums">
                  ${formatPrice(stock.price)}
                </span>

                {/* Change indicator */}
                <div
                  className={`flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold ${isUp
                    ? "bg-primary/10 text-primary"
                    : "bg-red-500/10 text-red-500"
                    }`}
                >
                  {isUp ? (
                    <TrendingUp size={10} className="md:w-3 md:h-3" />
                  ) : (
                    <TrendingDown size={10} className="md:w-3 md:h-3" />
                  )}
                  <span>{formatChange(stock.changePercent)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gradient overlays for smooth fade effect */}
      <div className="absolute inset-y-0 left-0 w-12 md:w-32 bg-gradient-to-r from-white dark:from-gray-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-12 md:w-32 bg-gradient-to-l from-white dark:from-gray-950 to-transparent z-10 pointer-events-none" />

      {/* Decorative bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </div>
  );
}
