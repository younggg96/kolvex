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
    <div className="bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
      <Accordion
        type="single"
        collapsible
        defaultValue="financial-metrics"
        className="w-full"
      >
        <AccordionItem value="financial-metrics" className="!border-b-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50 dark:hover:bg-white/5">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Financial Metrics
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-2">
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  P/E Ratio
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {financials.pe_ratio?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  EPS (TTM)
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {financials.eps_trailing?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Revenue
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {financials.total_revenue
                    ? formatMarketCap(financials.total_revenue)
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Profit Margin
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {financials.profit_margins
                    ? `${(financials.profit_margins * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  P/B Ratio
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {financials.price_to_book?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ROE
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {financials.return_on_equity
                    ? `${(financials.return_on_equity * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Total Cash
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {financials.total_cash
                    ? formatMarketCap(financials.total_cash)
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Total Debt
                </span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
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

