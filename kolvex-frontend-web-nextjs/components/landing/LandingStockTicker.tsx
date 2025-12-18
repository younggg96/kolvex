"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useMultipleQuotes } from "@/hooks/useStockData";

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
  const {
    data: quotes,
    loading,
    error,
  } = useMultipleQuotes(TICKER_SYMBOLS, REFRESH_INTERVAL);

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
    <div className="w-full bg-white dark:bg-card-dark border-y border-gray-100 dark:border-white/5 py-4 overflow-hidden relative group">
      {/* Live indicator */}
      {quotes.length > 0 && !error && (
        <div className="absolute top-1/2 -translate-y-1/2 left-4 z-20 hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
          </span>
          LIVE
        </div>
      )}

      <div className="flex animate-ticker hover:[animation-play-state:paused] whitespace-nowrap">
        {displayStocks.map((stock, idx) => {
          const isUp = stock.changePercent >= 0;
          return (
            <div
              key={idx}
              className="inline-flex items-center gap-2 px-8 border-r border-gray-100 dark:border-white/5 last:border-0"
            >
              <span className="font-bold text-gray-900 dark:text-white">
                {stock.symbol}
              </span>
              <span className="text-gray-600 dark:text-white/60 font-medium">
                ${formatPrice(stock.price)}
              </span>
              <span
                className={`flex items-center gap-0.5 text-xs font-bold ${
                  isUp ? "text-primary" : "text-red-500"
                }`}
              >
                {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {formatChange(stock.changePercent)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Gradient overlays for smooth fade effect */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white dark:from-card-dark to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white dark:from-card-dark to-transparent z-10 pointer-events-none" />
    </div>
  );
}
