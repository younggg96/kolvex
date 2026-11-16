"use client";

import { CircleSlash, CloudOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { AnswerCheck } from "@/lib/chatApi";

const SOURCES: Record<string, string> = {
  get_reported_revenue: "revenue",
  get_stock_quote: "quote",
  get_stock_history: "quote",
  get_technical_indicators: "quote",
  get_stock_financials: "financials",
  get_company_info: "financials",
  get_analyst_recommendations: "analysts",
  get_options_chain_summary: "options",
  web_search: "web",
  get_creator_opinions: "creators",
  get_creator_record: "creators",
  get_creator_recent_opinions: "creators",
  search_creator_opinions: "creators",
  get_market_events: "events",
  get_macro_indicators: "macro",
  get_institutional_holders: "smartMoney",
  get_superinvestor_portfolio: "smartMoney",
  get_congress_trades: "smartMoney",
  get_options_activity: "smartMoney",
  get_valuation: "valuation",
  get_market_buzz: "buzz",
  get_paper_trading_account: "paper",
};

/** Why a figure is missing: the source failed (retry may help) or has no data (it won't). */
export function DataGapNote({ gaps }: { gaps: NonNullable<AnswerCheck["data_gaps"]> }) {
  const { t } = useTranslation();
  if (!gaps.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
      {gaps.map((gap) => {
        const Icon = gap.kind === "unavailable" ? CloudOff : CircleSlash;
        const source = t(`chat.dataGap.source.${SOURCES[gap.tool] ?? "other"}`);
        return (
          <li key={gap.tool} className="flex items-center gap-1.5">
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            {t(`chat.dataGap.${gap.kind}`, { source })}
          </li>
        );
      })}
    </ul>
  );
}
