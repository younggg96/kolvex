"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatMarketCap } from "@/lib/stockApi";
import type { APIFinancials } from "./types";

interface StockFinancialMetricsProps {
  financials: APIFinancials;
}

export default function StockFinancialMetrics({
  financials,
}: StockFinancialMetricsProps) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <Accordion
        type="single"
        collapsible
        defaultValue="financial-metrics"
        className="w-full"
      >
        <AccordionItem value="financial-metrics" className="!border-b-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted">
            <span className="text-sm font-semibold text-foreground">
              Financial Metrics
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-2">
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  P/E Ratio
                </span>
                <span className="text-xs font-medium text-foreground">
                  {financials.pe_ratio?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  EPS (TTM)
                </span>
                <span className="text-xs font-medium text-foreground">
                  {financials.eps_trailing?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Revenue
                </span>
                <span className="text-xs font-medium text-foreground">
                  {financials.total_revenue
                    ? formatMarketCap(financials.total_revenue)
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Profit Margin
                </span>
                <span className="text-xs font-medium text-foreground">
                  {financials.profit_margins
                    ? `${(financials.profit_margins * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  P/B Ratio
                </span>
                <span className="text-xs font-medium text-foreground">
                  {financials.price_to_book?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  ROE
                </span>
                <span className="text-xs font-medium text-foreground">
                  {financials.return_on_equity
                    ? `${(financials.return_on_equity * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Total Cash
                </span>
                <span className="text-xs font-medium text-foreground">
                  {financials.total_cash
                    ? formatMarketCap(financials.total_cash)
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">
                  Total Debt
                </span>
                <span className="text-xs font-medium text-foreground">
                  {financials.total_debt
                    ? formatMarketCap(financials.total_debt)
                    : "N/A"}
                </span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

