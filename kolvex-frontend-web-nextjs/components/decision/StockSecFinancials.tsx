"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  financialRatios,
  freeResearchKey,
  type FinancialRow,
  type SecFinancials,
} from "@/lib/freeResearch";
import { csvCell } from "@/lib/stockFundamentals";
import { cn } from "@/lib/utils";
import { SecLink, SecState, SourceNote, useFreeResearch } from "./SecData";
import StockFinancials, { FinancialMetricChart } from "./StockFinancials";
import { useFinancialFormat } from "./StockFinancialData";
import { useCopy } from "./shared";

type Metric = {
  key: keyof FinancialRow | "revenue_growth" | "fcf_margin" | "roe" | "liabilities_to_equity";
  en: string;
  zh: string;
  kind?: "percent" | "plain" | "multiple";
  ratio?: boolean;
};

const metrics: Metric[] = [
  { key: "revenue", en: "Revenue", zh: "营业收入" },
  { key: "gross_profit", en: "Gross profit", zh: "毛利润" },
  { key: "operating_income", en: "Operating income", zh: "营业利润" },
  { key: "net_income", en: "Net income", zh: "净利润" },
  { key: "eps_diluted", en: "Diluted EPS", zh: "稀释每股收益", kind: "plain" },
  { key: "operating_cash_flow", en: "Operating cash flow", zh: "经营现金流" },
  { key: "capex", en: "Capital expenditure", zh: "资本支出" },
  { key: "free_cash_flow", en: "Free cash flow", zh: "自由现金流" },
  { key: "assets", en: "Total assets", zh: "总资产" },
  { key: "liabilities", en: "Total liabilities", zh: "总负债" },
  { key: "equity", en: "Shareholders’ equity", zh: "股东权益" },
  { key: "revenue_growth", en: "Revenue growth YoY", zh: "营收同比增长", kind: "percent", ratio: true },
  { key: "gross_margin", en: "Gross margin", zh: "毛利率", kind: "percent", ratio: true },
  { key: "operating_margin", en: "Operating margin", zh: "营业利润率", kind: "percent", ratio: true },
  { key: "net_margin", en: "Net margin", zh: "净利率", kind: "percent", ratio: true },
  { key: "fcf_margin", en: "Free cash flow margin", zh: "自由现金流利润率", kind: "percent", ratio: true },
  { key: "roe", en: "Return on equity", zh: "净资产收益率", kind: "percent", ratio: true },
  { key: "liabilities_to_equity", en: "Liabilities / equity", zh: "负债权益比", kind: "multiple", ratio: true },
];

/** Statements come from the provider; long-term history comes from SEC filings. */
export default function StockFinancialsTab({
  symbol,
  currency,
}: {
  symbol: string;
  currency: string;
}) {
  const c = useCopy();
  const [view, setView] = useState<"statements" | "history">("statements");
  const [visited, setVisited] = useState(false);
  return (
    <div className="space-y-6">
      <SegmentedControl
        label={c("Financial data view", "财务数据视图")}
        semantics="tabs"
        value={view}
        onChange={(value) => {
          setView(value);
          if (value === "history") setVisited(true);
        }}
        options={[
          { value: "statements", label: c("Statements", "财务报表") },
          { value: "history", label: c("Long-term, TTM & ratios", "长期历史 · TTM · 比率") },
        ]}
      />
      <div hidden={view !== "statements"}>
        <StockFinancials symbol={symbol} currency={currency} />
      </div>
      <div hidden={view !== "history"}>
        {visited && <StockSecFinancials symbol={symbol} />}
      </div>
    </div>
  );
}

function StockSecFinancials({ symbol }: { symbol: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const [quarterly, setQuarterly] = useState(false);
  const resource = useFreeResearch<SecFinancials>(
    freeResearchKey(symbol, "financials"),
  );
  const data = resource.data;
  const history = (quarterly ? data?.quarterly : data?.annual) ?? [];
  const ttm = !quarterly ? data?.ttm ?? null : null;
  const columns: { id: string; label: string; row: FinancialRow; fullYear: boolean }[] = [
    ...(ttm ? [{ id: "ttm", label: "TTM", row: ttm, fullYear: true }] : []),
    ...history.map((row) => ({
      id: row.period,
      label: f.date(row.period),
      row,
      fullYear: !quarterly,
    })),
  ];
  const value = (column: (typeof columns)[number], metric: Metric) =>
    metric.ratio && !(metric.key in column.row && column.row[metric.key as keyof FinancialRow] !== undefined)
      ? financialRatios(column.row, history, column.fullYear)[
          metric.key as "revenue_growth" | "fcf_margin" | "roe" | "liabilities_to_equity"
        ]
      : (column.row[metric.key as keyof FinancialRow] as number | null | undefined) ?? null;
  const format = (metric: Metric, raw: number | null) =>
    metric.kind === "percent"
      ? f.percent(raw)
      : metric.kind === "multiple"
        ? raw === null
          ? "—"
          : `${f.number(raw, false)}×`
        : f.number(raw, metric.kind !== "plain");
  const available = metrics.filter((metric) =>
    columns.some((column) => value(column, metric) !== null),
  );
  const chartRows = history.slice(0, 20).reverse();
  const series = (metric: "revenue" | "net_margin" | "free_cash_flow") =>
    chartRows.map((row) => ({ period: row.period, value: row[metric] ?? null }));
  const span = history.length
    ? `${f.date(history[history.length - 1].period)} – ${f.date(history[0].period)}`
    : "";
  const exportCsv = () => {
    const csv = [
      [c("Metric", "指标"), ...columns.map((column) => (column.id === "ttm" ? `TTM ${column.row.period}` : column.id))],
      ...available.map((metric) => [
        c(metric.en, metric.zh),
        ...columns.map((column) => value(column, metric)),
      ]),
    ]
      .map((row) => row.map((cell) => csvCell(cell as string | number | null)).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${symbol}-sec-${quarterly ? "quarterly" : "annual"}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">
            {c("Long-term financials", "长期财务")}
          </h2>
          {!!history.length && (
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.currency} · {history.length} {c("periods", "个报告期")} · {span}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label={c("Reporting frequency", "报告周期")}
            value={quarterly ? "quarterly" : "annual"}
            onChange={(next) => setQuarterly(next === "quarterly")}
            options={[
              { value: "annual", label: c("Annual", "年度") },
              { value: "quarterly", label: c("Quarterly", "季度") },
            ]}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!columns.length}
            onClick={exportCsv}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>
      <SecState
        loading={resource.loading}
        error={resource.error}
        empty={!resource.loading && !columns.length}
        retry={resource.refresh}
        emptyText={c(
          "SEC has no US-GAAP financial data for this security. Foreign issuers filing under IFRS and ETFs are not covered.",
          "SEC 没有这只证券的美国会计准则财务数据。按 IFRS 申报的外国公司和 ETF 不在覆盖范围内。",
        )}
        errorText={c(
          "SEC data could not be loaded. Try again.",
          "SEC 数据加载失败，请重试。",
        )}
      />
      {!!columns.length && (
        <>
          {!!chartRows.length && (
            <div className="grid gap-4 lg:grid-cols-3">
              <FinancialMetricChart
                title={c("Revenue", "营业收入")}
                currency={data?.currency ?? undefined}
                data={series("revenue")}
                line={false}
              />
              <FinancialMetricChart
                title={c("Net margin", "净利率")}
                ratio
                data={series("net_margin")}
                line
              />
              <FinancialMetricChart
                title={c("Free cash flow", "自由现金流")}
                currency={data?.currency ?? undefined}
                data={series("free_cash_flow")}
                line={false}
              />
            </div>
          )}
          <div
            role="region"
            tabIndex={0}
            aria-label={c(
              "SEC financial history, scroll horizontally for more periods",
              "SEC 财务历史，可横向滚动查看更多报告期",
            )}
            className="glass-card bg-card-glass max-h-[72vh] overflow-auto rounded-3xl border border-foreground/10 focus-visible:outline-none"
          >
            <table className="w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">
                {c("SEC financial history", "SEC 财务历史")} · {symbol}
              </caption>
              <thead className="sticky top-0 z-20">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-30 min-w-40 border-b border-r border-border bg-muted px-4 py-4 text-left font-medium text-muted-foreground sm:min-w-56"
                  >
                    {c("Period ending", "报告期截止日")}
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      scope="col"
                      className="min-w-28 whitespace-nowrap border-b border-border bg-muted px-4 py-4 text-right font-medium text-muted-foreground"
                    >
                      {column.id === "ttm" ? (
                        <span title={f.date(column.row.period)}>
                          TTM
                          <span className="mt-0.5 block text-xs font-normal">
                            {f.date(column.row.period)}
                          </span>
                        </span>
                      ) : (
                        <SecLink
                          href={Object.values(column.row.sources).find((source) => source.source_url)?.source_url}
                          label={c(`SEC filing for ${column.label}`, `${column.label} 的 SEC 申报原文`)}
                        >
                          {column.label}
                        </SecLink>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {available.map((metric) => (
                  <tr
                    key={metric.key}
                    className="group transition-colors hover:bg-foreground/[0.06]"
                  >
                    <th
                      scope="row"
                      className={cn(
                        "sticky left-0 z-10 border-b border-r border-border bg-card px-4 py-3 text-left font-normal",
                        !metric.ratio && "font-medium",
                      )}
                    >
                      {c(metric.en, metric.zh)}
                    </th>
                    {columns.map((column) => {
                      const source = column.row.sources[metric.key as string];
                      return (
                        <td
                          key={column.id}
                          className="figure whitespace-nowrap border-b border-border px-4 py-3 text-right"
                        >
                          {format(metric, value(column, metric))}
                          {source?.derived && column.id !== "ttm" && (
                            <span
                              className="text-muted-foreground"
                              title={c(
                                "Derived by subtracting cumulative reported figures",
                                "由累计披露数相减得出",
                              )}
                            >
                              *
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceNote>
            {c(
              `Source: SEC EDGAR company facts, as filed. Click a date for the filing. * is derived by subtracting cumulative figures. TTM adds the latest four contiguous quarters and is omitted when they don't connect; TTM EPS needs a reported fourth quarter, so it usually stays empty. EPS is as filed and not adjusted for later stock splits, so jumps across a split are not real changes. ROE uses period-end equity. Free cash flow is operating cash flow minus capital expenditure. History length depends on each company's XBRL filings (generally from 2009) and restatements use the latest filed value.`,
              `来源：SEC EDGAR 公司披露数据，点击日期可查看申报原文。* 表示由累计披露数相减得出。TTM 为最近连续四个季度之和，季度不连续时不显示；第四季度通常没有单独披露 EPS，所以 TTM EPS 多为空。EPS 为申报时的原值，未按之后的拆股调整，拆股前后的跳变不代表真实变化。净资产收益率使用期末股东权益。自由现金流 = 经营现金流 − 资本支出。历史长度取决于公司的 XBRL 申报（一般始于 2009 年前后），重述数据以最新申报为准。`,
            )}
          </SourceNote>
        </>
      )}
    </div>
  );
}
