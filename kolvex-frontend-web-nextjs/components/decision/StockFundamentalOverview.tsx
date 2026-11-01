"use client";

import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";
import type { StockOverview, StockQuote } from "@/lib/stockApi";
import { finite } from "@/lib/stockFundamentals";
import { FinancialState, useFinancialFormat } from "./StockFinancialData";
import { useCopy } from "./shared";

export default function StockFundamentalOverview({
  overview,
  quote,
  loading,
  error,
  retry,
}: {
  overview?: StockOverview;
  quote: StockQuote | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const financials = overview?.financials;
  const q = overview?.quote;
  const currency = q?.currency || "USD";
  const financialCurrency = financials?.financial_currency || currency;
  const groups = [
    {
      title: c("Market & valuation", "行情与估值"),
      rows: [
        [
          c("Market cap", "总市值"),
          f.number(q?.market_cap ?? quote?.marketCap),
        ],
        [
          c("Enterprise value", "企业价值"),
          f.number(financials?.enterprise_value),
        ],
        [
          c("Trailing P/E", "滚动市盈率"),
          f.number(financials?.pe_ratio, false),
        ],
        [
          c("Forward P/E", "预期市盈率"),
          f.number(financials?.forward_pe, false),
        ],
        [
          c("Price / sales", "市销率"),
          f.number(financials?.price_to_sales, false),
        ],
        [
          c("52 week range", "52 周区间"),
          `${f.number(q?.fifty_two_week_low ?? quote?.week52Low)} – ${f.number(q?.fifty_two_week_high ?? quote?.week52High)}`,
        ],
        [c("Volume", "成交量"), f.number(q?.volume ?? quote?.volume)],
      ],
    },
    {
      title: c("Revenue & profitability", "收入与盈利"),
      rows: [
        [c("Revenue", "营业收入"), f.number(financials?.total_revenue)],
        [c("Gross profit", "毛利润"), f.number(financials?.gross_profits)],
        [c("Net income", "净利润"), f.number(financials?.net_income)],
        [c("EBITDA", "息税折旧摊销前利润"), f.number(financials?.ebitda)],
        [
          c("Trailing EPS", "滚动每股收益"),
          f.number(financials?.eps_trailing, false),
        ],
        [c("Gross margin", "毛利率"), f.percent(financials?.gross_margins)],
        [c("Net margin", "净利率"), f.percent(financials?.profit_margins)],
      ],
    },
    {
      title: c("Cash & balance sheet", "现金与财务状况"),
      rows: [
        [c("Total cash", "现金总额"), f.number(financials?.total_cash)],
        [c("Total debt", "总债务"), f.number(financials?.total_debt)],
        [
          c("Operating cash flow", "经营现金流"),
          f.number(financials?.operating_cash_flow),
        ],
        [
          c("Free cash flow", "自由现金流"),
          f.number(financials?.free_cash_flow),
        ],
        [
          c("Current ratio", "流动比率"),
          f.number(financials?.current_ratio, false),
        ],
        [
          c("Quick ratio", "速动比率"),
          f.number(financials?.quick_ratio, false),
        ],
        [
          c("Return on equity", "净资产收益率"),
          f.percent(financials?.return_on_equity),
        ],
      ],
    },
  ];
  const growth = [
    {
      label: c("Revenue growth", "营收增长率"),
      value: financials?.revenue_growth,
    },
    {
      label: c("Earnings growth", "盈利增长率"),
      value: financials?.earnings_growth,
    },
  ].filter((item) => finite(item.value));
  return (
    <div className="space-y-4">
      <FinancialState
        loading={loading && !overview}
        error={error}
        empty={false}
        retry={retry}
      />
      {!!growth.length && (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-sm font-medium text-muted-foreground">
            {c("Key indicators", "关键指标")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {growth.map((item) => (
              <p key={item.label} className="flex items-center gap-3 text-sm">
                {item.value! >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-positive" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 shrink-0 text-negative" />
                )}
                <span>
                  {item.label}{" "}
                  <strong className="figure font-semibold">
                    {f.percent(item.value)}
                  </strong>{" "}
                  <span className="text-muted-foreground">
                    {c("year over year", "同比")}
                  </span>
                </span>
              </p>
            ))}
          </div>
        </section>
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        {groups.map((group) => (
          <section
            key={group.title}
            className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6"
          >
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              {group.title}
            </h2>
            <dl className="divide-y divide-border">
              {group.rows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4 py-3 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="figure shrink-0 text-right font-medium">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {c(
          `Source: Yahoo Finance · Market values in ${currency}; financials in ${financialCurrency}. Ratios and growth follow source reporting periods; — means unavailable.`,
          `来源：Yahoo Finance · 行情单位 ${currency}，财务单位 ${financialCurrency}。比率及增长率以数据源报告周期为准，— 表示暂无数据。`,
        )}
      </p>
    </div>
  );
}

export function StockCompanyProfile({
  overview,
  loading,
  error,
  retry,
}: {
  overview?: StockOverview;
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const company = overview?.company;
  let website: string | null = null;
  try {
    const url = new URL(company?.website || "");
    if (["https:", "http:"].includes(url.protocol)) website = url.href;
  } catch {
    /* Missing or invalid source URL. */
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">
        {c("Company profile", "公司资料")}
      </h2>
      <FinancialState
        loading={loading}
        error={error}
        empty={!loading && !error && !company}
        retry={retry}
      />
      {company && (
        <>
          <dl className="grid grid-cols-2 gap-6 rounded-xl border border-border bg-card p-6 lg:grid-cols-4">
            {[
              [c("Sector", "行业板块"), company.sector],
              [c("Industry", "细分行业"), company.industry],
              [c("Country", "国家"), company.country],
              [c("Employees", "员工人数"), f.number(company.employees, false)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-2 text-sm font-medium">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          {company.business_summary && (
            <p className="w-full max-w-none break-words text-sm leading-7 text-muted-foreground">
              {company.business_summary}
            </p>
          )}
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {c("Company website", "公司官网")}{" "}
              <ExternalLink
                aria-hidden="true"
                className="ml-1 inline h-3 w-3"
              />
            </a>
          )}
        </>
      )}
    </div>
  );
}
