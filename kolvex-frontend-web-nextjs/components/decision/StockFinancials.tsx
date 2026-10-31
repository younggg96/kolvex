"use client";

import { useState } from "react";
import { Download, Plus, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCachedResource } from "@/hooks/useCachedResource";
import { FinancialState, useFinancialFormat } from "./StockFinancialData";
import {
  csvCell,
  finite,
  fundamentalsKey,
  loadFundamentals,
  metricValue,
  sortPeriods,
  type StatementKind,
  type StatementPeriod,
} from "@/lib/stockFundamentals";
import { cn } from "@/lib/utils";
import { useCopy } from "./shared";

const labels = {
  "Total Revenue": ["Revenue", "营业收入"],
  "Cost Of Revenue": ["Cost of revenue", "营业成本"],
  "Gross Profit": ["Gross profit", "毛利润"],
  "Operating Expense": ["Operating expenses", "营业费用"],
  "Research And Development": ["Research & development", "研发费用"],
  "Selling General And Administration": [
    "Selling & administration",
    "销售及管理费用",
  ],
  "Operating Income": ["Operating income", "营业利润"],
  "Pretax Income": ["Pretax income", "税前利润"],
  "Tax Provision": ["Income tax", "所得税"],
  "Net Income": ["Net income", "净利润"],
  "Diluted EPS": ["Diluted EPS", "稀释每股收益"],
  "Basic EPS": ["Basic EPS", "基本每股收益"],
  "Diluted Average Shares": ["Diluted shares", "稀释平均股数"],
  EBITDA: ["EBITDA", "息税折旧摊销前利润"],
  "Total Assets": ["Total assets", "总资产"],
  "Current Assets": ["Current assets", "流动资产"],
  "Cash And Cash Equivalents": ["Cash & equivalents", "现金及等价物"],
  "Total Debt": ["Total debt", "总债务"],
  "Total Liabilities Net Minority Interest": ["Total liabilities", "总负债"],
  "Stockholders Equity": ["Shareholders’ equity", "股东权益"],
  "Operating Cash Flow": ["Operating cash flow", "经营现金流"],
  "Investing Cash Flow": ["Investing cash flow", "投资现金流"],
  "Financing Cash Flow": ["Financing cash flow", "融资现金流"],
  "Free Cash Flow": ["Free cash flow", "自由现金流"],
  "Capital Expenditure": ["Capital expenditure", "资本支出"],
} as const;
const keyRows: Record<StatementKind, string[]> = {
  "income-statement": [
    "Total Revenue",
    "Cost Of Revenue",
    "Gross Profit",
    "Research And Development",
    "Selling General And Administration",
    "Operating Expense",
    "Operating Income",
    "Pretax Income",
    "Tax Provision",
    "Net Income",
    "Basic EPS",
    "Diluted EPS",
    "Diluted Average Shares",
    "EBITDA",
  ],
  "balance-sheet": [
    "Total Assets",
    "Current Assets",
    "Cash And Cash Equivalents",
    "Total Debt",
    "Total Liabilities Net Minority Interest",
    "Stockholders Equity",
  ],
  "cash-flow": [
    "Operating Cash Flow",
    "Investing Cash Flow",
    "Financing Cash Flow",
    "Capital Expenditure",
    "Free Cash Flow",
  ],
};
function useStatement(symbol: string, kind: StatementKind, quarterly: boolean) {
  const key = fundamentalsKey(symbol, kind, quarterly);
  return useCachedResource(
    key,
    (signal) => loadFundamentals<{ data: StatementPeriod[] }>(key, signal),
    { ttl: 300_000 },
  );
}
function PeriodToggle({
  quarterly,
  onChange,
}: {
  quarterly: boolean;
  onChange: (value: boolean) => void;
}) {
  const c = useCopy();
  return (
    <div
      role="group"
      aria-label={c("Reporting frequency", "报告周期")}
      className="inline-flex rounded-lg bg-muted p-1"
    >
      {[false, true].map((value) => (
        <Button
          key={String(value)}
          size="sm"
          variant="ghost"
          aria-pressed={quarterly === value}
          className={cn(
            "rounded-md",
            quarterly === value && "bg-background text-foreground",
          )}
          onClick={() => onChange(value)}
        >
          {value ? c("Quarterly", "季度") : c("Annual", "年度")}
        </Button>
      ))}
    </div>
  );
}
export default function StockFinancials({
  symbol,
  currency,
}: {
  symbol: string;
  currency: string;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const [kind, setKind] = useState<StatementKind>("income-statement");
  const [quarterly, setQuarterly] = useState(false);
  const resource = useStatement(symbol, kind, quarterly);
  const periods = sortPeriods(resource.data?.data ?? []);
  const available = new Set(
    periods.flatMap((period) =>
      Object.keys(period).filter((key) => finite(period[key])),
    ),
  );
  const rows = [
    ...keyRows[kind].filter((key) => available.has(key)),
    ...[...available].filter((key) => !keyRows[kind].includes(key)).sort(),
  ];
  const label = (key: string) => {
    const pair = labels[key as keyof typeof labels];
    return pair ? c(pair[0], pair[1]) : key;
  };
  const exportCsv = () => {
    const csv = [
      [c("Metric", "指标"), ...periods.map((p) => p.period.slice(0, 10))],
      ...rows.map((key) => [
        label(key),
        ...periods.map((p) => (finite(p[key]) ? p[key] : null)),
      ]),
    ]
      .map((row) =>
        row.map((value) => csvCell(value as string | number | null)).join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${symbol}-${kind}-${quarterly ? "quarterly" : "annual"}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label={c("Financial statement", "财务报表类型")}
          className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
        >
          {(
            [
              ["income-statement", c("Income", "利润表")],
              ["balance-sheet", c("Balance sheet", "资产负债表")],
              ["cash-flow", c("Cash flow", "现金流量表")],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant="ghost"
              aria-pressed={kind === value}
              className={cn(
                "rounded-md",
                kind === value && "bg-background text-foreground",
              )}
              onClick={() => setKind(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <PeriodToggle quarterly={quarterly} onChange={setQuarterly} />
          <Button
            size="sm"
            variant="outline"
            disabled={!periods.length}
            onClick={exportCsv}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {c(
          `Reported in ${currency} unless per share or share count. ${periods.length} available periods; fiscal period ending dates shown.`,
          `金额单位 ${currency}，每股数据及股数除外。共 ${periods.length} 个可用报告期，表头为财年或财季截止日。`,
        )}
      </p>
      <FinancialState
        loading={resource.loading}
        error={Boolean(resource.error)}
        empty={!periods.length}
        retry={resource.refresh}
      />
      {!!periods.length && (
        <div
          role="region"
          tabIndex={0}
          aria-label={c(
            "Financial statements, scroll horizontally for more periods",
            "财务报表，可横向滚动查看更多报告期",
          )}
          className="max-h-[72vh] overflow-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              {c("Financial statements", "财务报表")} · {symbol}
            </caption>
            <thead className="sticky top-0 z-20">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-30 min-w-40 border-b border-r border-border bg-muted px-4 py-4 text-left font-medium text-muted-foreground sm:min-w-64"
                >
                  {c("Period ending", "报告期截止日")}
                </th>
                {periods.map((p) => (
                  <th
                    scope="col"
                    key={p.period}
                    className="min-w-32 whitespace-nowrap border-b border-border bg-muted px-4 py-4 text-right font-medium text-muted-foreground"
                  >
                    {f.date(p.period)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((key) => (
                <tr key={key} className="group">
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 max-w-64 border-b border-r border-border bg-card px-4 py-4 text-left font-normal group-hover:bg-muted",
                      keyRows[kind].includes(key) && "font-medium",
                    )}
                  >
                    {label(key)}
                  </th>
                  {periods.map((p) => (
                    <td
                      key={p.period}
                      className="figure whitespace-nowrap border-b border-border px-4 py-4 text-right group-hover:bg-muted"
                    >
                      {f.number(p[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {c(
          "Source: Yahoo Finance · Available history varies by company. Missing values are shown as —.",
          "来源：Yahoo Finance · 历史长度因公司而异，缺失值以 — 显示。",
        )}
      </p>
    </div>
  );
}
const chartMetrics = [
  { id: "revenue", en: "Revenue", zh: "营业收入", keys: ["Total Revenue"] },
  { id: "income", en: "Net income", zh: "净利润", keys: ["Net Income"] },
  { id: "margin", en: "Net margin", zh: "净利率", keys: [] },
  { id: "eps", en: "Diluted EPS", zh: "稀释每股收益", keys: ["Diluted EPS"] },
  { id: "gross", en: "Gross profit", zh: "毛利润", keys: ["Gross Profit"] },
  {
    id: "operating",
    en: "Operating income",
    zh: "营业利润",
    keys: ["Operating Income"],
  },
  { id: "ebitda", en: "EBITDA", zh: "息税折旧摊销前利润", keys: ["EBITDA"] },
];
const chartTooltip = {
  background: "rgb(var(--card))",
  border: "1px solid rgb(var(--border))",
  borderRadius: 12,
  color: "rgb(var(--foreground))",
};
export function StockMulticharts({
  symbol,
  currency,
}: {
  symbol: string;
  currency: string;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const [quarterly, setQuarterly] = useState(false);
  const [line, setLine] = useState(false);
  const [selected, setSelected] = useState([
    "revenue",
    "income",
    "margin",
    "eps",
  ]);
  const resource = useStatement(symbol, "income-statement", quarterly);
  const periods = sortPeriods(resource.data?.data ?? []).reverse();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">
          {c("Financial trends", "财务趋势")}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodToggle quarterly={quarterly} onChange={setQuarterly} />
          <div
            role="group"
            aria-label={c("Chart style", "图表样式")}
            className="inline-flex rounded-lg bg-muted p-1"
          >
            {[false, true].map((value) => (
              <Button
                key={String(value)}
                size="sm"
                variant="ghost"
                aria-pressed={line === value}
                className={cn(
                  "rounded-md",
                  line === value && "bg-background text-foreground",
                )}
                onClick={() => setLine(value)}
              >
                {value ? c("Line", "折线") : c("Bars", "柱状")}
              </Button>
            ))}
          </div>
          {selected.length < chartMetrics.length && (
            <div className="w-40">
              <Select
                value=""
                onValueChange={(value) =>
                  setSelected((items) => [...items, value])
                }
              >
                <SelectTrigger aria-label={c("Add metric", "添加指标")}>
                  <Plus className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={c("Add metric", "添加指标")} />
                </SelectTrigger>
                <SelectContent>
                  {chartMetrics
                    .filter((metric) => !selected.includes(metric.id))
                    .map((metric) => (
                      <SelectItem key={metric.id} value={metric.id}>
                        {c(metric.en, metric.zh)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
      <FinancialState
        loading={resource.loading}
        error={Boolean(resource.error)}
        empty={!periods.length}
        retry={resource.refresh}
      />
      {!!periods.length && !selected.length && (
        <p className="py-8 text-sm text-muted-foreground">
          {c(
            "Add a metric to start comparing financial trends.",
            "添加指标，开始对比财务趋势。",
          )}
        </p>
      )}
      {!!periods.length && (
        <div className="grid gap-4 lg:grid-cols-2">
          {selected.map((id) => {
            const metric = chartMetrics.find((metric) => metric.id === id)!;
            const data = periods.map((period) => {
              const revenue = metricValue(period, ["Total Revenue"]);
              const income = metricValue(period, ["Net Income"]);
              return {
                period: f.date(period.period),
                value:
                  id === "margin"
                    ? revenue && income !== null
                      ? income / revenue
                      : null
                    : metricValue(period, metric.keys),
              };
            });
            const latest = data[data.length - 1];
            const previous = data[data.length - 2];
            const format = (value: unknown) =>
              id === "margin" ? f.percent(value) : f.number(value);
            const delta =
              finite(latest?.value) && finite(previous?.value)
                ? latest.value - previous.value
                : null;
            const axes = (
              <>
                <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
                  minTickGap={20}
                />
                <YAxis
                  width={62}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
                  tickFormatter={format}
                />
                <Tooltip
                  contentStyle={chartTooltip}
                  formatter={(value) => [
                    format(value),
                    c(metric.en, metric.zh),
                  ]}
                />
              </>
            );
            return (
              <section
                key={id}
                className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {c(metric.en, metric.zh)}
                    {id !== "margin" && (
                      <span className="ml-2 text-xs">{currency}</span>
                    )}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={c(`Remove ${metric.en}`, `移除${metric.zh}`)}
                    onClick={() =>
                      setSelected((items) =>
                        items.filter((item) => item !== id),
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="figure mt-2 text-2xl font-semibold">
                  {format(latest?.value)}
                </p>
                <p className="mt-2 min-h-5 text-xs text-muted-foreground">
                  {finite(delta) ? (
                    <>
                      <span
                        className={
                          delta >= 0 ? "text-positive" : "text-negative"
                        }
                      >
                        {delta >= 0 ? "+" : ""}
                        {id === "margin"
                          ? `${f.number(delta * 100, false)} ${c("pp", "个百分点")}`
                          : format(delta)}
                      </span>{" "}
                      · {c("vs previous period", "较上一报告期")}
                    </>
                  ) : (
                    c("No comparable previous period", "暂无可比上一期")
                  )}
                </p>
                <div
                  className="mt-6 h-60"
                  role="img"
                  aria-label={`${c(metric.en, metric.zh)}: ${data.map((point) => `${point.period} ${format(point.value)}`).join("; ")}`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    {line ? (
                      <LineChart data={data}>
                        {axes}
                        <Line
                          dataKey="value"
                          type="monotone"
                          stroke="rgb(var(--positive))"
                          strokeWidth={2}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={data}>
                        {axes}
                        <Bar
                          dataKey="value"
                          fill="rgb(var(--positive))"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={32}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {c(
          "Source: Yahoo Finance · Net margin = net income / revenue. Charts use available fiscal periods only.",
          "来源：Yahoo Finance · 净利率 = 净利润 / 营业收入，仅展示可用财年或财季。",
        )}
      </p>
    </div>
  );
}
