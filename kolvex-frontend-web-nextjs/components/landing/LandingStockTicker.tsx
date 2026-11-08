"use client";

import React from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useMultipleQuotes } from "@/hooks/useStockData";
import CompanyLogo from "@/components/ui/company-logo";
import { marketStockUrl } from "@/lib/stockLinks";
import { useTranslation } from "@/lib/i18n";

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

/** Pill shell: identical for the link and the non-routable fallback so the marquee never reflows. */
const PILL_CLASS =
  "group inline-flex min-h-11 items-center gap-1.5 md:gap-3 px-2.5 md:px-5 py-1.5 md:py-2.5 mx-1 md:mx-2 rounded-3xl glass-card bg-card-glass border border-foreground/10 transition-all duration-200";

export default function LandingStockTicker() {
  const { t } = useTranslation();
  const { data: quotes, error, loading } = useMultipleQuotes(TICKER_SYMBOLS);
  const stockData = TICKER_SYMBOLS.map(symbol => ({ symbol, quote: quotes.find(quote => quote.symbol === symbol) }));

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
    <div className="w-full relative overflow-hidden py-3 md:py-6 border-y border-border">
      <div className="absolute inset-0 bg-muted/30" />

      <p role="status" className="relative mb-2 px-3 text-xs text-muted-foreground">
        {error ? t(quotes.length ? "youtubeOpinions.quoteRefreshFailed" : "youtubeOpinions.priceUnavailable")
          : loading && !quotes.length ? t("youtubeOpinions.quoteLoading")
            : `Yahoo Finance · ${t("youtubeOpinions.quoteMayBeDelayed")}`}
      </p>

      {/* Ticker content */}
      <div className="relative">
        <div className="flex animate-ticker hover:[animation-play-state:paused] whitespace-nowrap">
          {displayStocks.map((stock, idx) => {
            const isUp = (stock.quote?.changePercent ?? 0) >= 0;
            // Every pill that identifies a tradable stock opens that stock's quotes page.
            // Symbols we cannot route (e.g. indexes) stay plain, non-interactive pills.
            const href = marketStockUrl(stock.symbol);
            const name = COMPANY_NAMES[stock.symbol] || stock.symbol;

            const content = (
              <>
                {/* Company Logo - hidden on mobile to save space */}
                <div className="hidden sm:block">
                  <CompanyLogo
                    symbol={stock.symbol}
                    name={COMPANY_NAMES[stock.symbol]}
                    size="sm"
                    border="light"
                    borderColor="gray"
                    className="group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Stock symbol */}
                <span className="font-bold text-xs md:text-base text-foreground group-hover:text-foreground/80 transition-colors duration-200">
                  {stock.symbol}
                </span>

                {/* Price */}
                <span className="text-xs md:text-base text-muted-foreground font-medium tabular-nums">
                  {stock.quote ? `$${formatPrice(stock.quote.price)}` : "—"}
                </span>

                {/* Change indicator */}
                {stock.quote && <div
                  className={`flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 rounded-md md:rounded-2xl text-[0.625rem] md:text-xs font-bold ${isUp
                    ? "bg-primary/10 text-primary"
                    : "bg-red-500/10 text-red-500"
                    }`}
                >
                  {isUp ? (
                    <TrendingUp size={10} className="md:w-3 md:h-3" />
                  ) : (
                    <TrendingDown size={10} className="md:w-3 md:h-3" />
                  )}
                  <span>{formatChange(stock.quote.changePercent)}</span>
                </div>}
              </>
            );

            const key = `${stock.symbol}-${idx}`;

            return href ? (
              <Link
                key={key}
                href={href}
                aria-label={`${stock.symbol} ${name} quotes`}
                className={`${PILL_CLASS} cursor-pointer hover:border-foreground/25 focus-visible:outline-none focus-visible:border-foreground/35`}
              >
                {content}
              </Link>
            ) : (
              <div key={key} className={PILL_CLASS}>
                {content}
              </div>
            );
          })}
        </div>
      </div>

      {/* Gradient overlays for smooth fade */}
      <div className="absolute inset-y-0 left-0 w-12 md:w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-12 md:w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
    </div>
  );
}
