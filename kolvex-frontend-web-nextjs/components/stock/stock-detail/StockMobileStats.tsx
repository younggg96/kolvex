"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatMarketCap, formatVolume } from "@/lib/stockApi";
import type { APIStockQuote } from "./types";

interface StockMobileStatsProps {
  quote: APIStockQuote;
}

export default function StockMobileStats({ quote }: StockMobileStatsProps) {
  return (
    <div className="lg:hidden bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="detailed-stats" className="!border-b-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-white/5">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Detailed Statistics
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Prev Close
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  ${quote.previous_close?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  52W High
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  ${quote.fifty_two_week_high?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  52W Low
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  ${quote.fifty_two_week_low?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Avg Volume
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {quote.avg_volume ? formatVolume(quote.avg_volume) : "N/A"}
                </span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Market Cap
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {quote.market_cap ? formatMarketCap(quote.market_cap) : "N/A"}
                </span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

