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
    <div className="lg:hidden bg-card rounded-xl border border-border overflow-hidden">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="detailed-stats" className="!border-b-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted">
            <span className="text-sm font-semibold text-foreground">
              Detailed Statistics
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Prev Close
                </span>
                <span className="text-xs font-medium text-foreground">
                  ${quote.previous_close?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  52W High
                </span>
                <span className="text-xs font-medium text-foreground">
                  ${quote.fifty_two_week_high?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  52W Low
                </span>
                <span className="text-xs font-medium text-foreground">
                  ${quote.fifty_two_week_low?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Avg Volume
                </span>
                <span className="text-xs font-medium text-foreground">
                  {quote.avg_volume ? formatVolume(quote.avg_volume) : "N/A"}
                </span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-xs text-muted-foreground">
                  Market Cap
                </span>
                <span className="text-xs font-medium text-foreground">
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

