"use client";

import { useState, type ReactNode } from "react";
import { Download, Plus, X, BarChart3, List } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
  statementTrend,
  financialChange,
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
    <SegmentedControl
      label={c("Reporting frequency", "报告周期")}
      value={quarterly ? "quarterly" : "annual"}
      onChange={(value) => onChange(value === "quarterly")}
      options={[
        { value: "annual", label: c("Annual", "年度") },
        { value: "quarterly", label: c("Quarterly", "季度") },
      ]}
    />
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
  const [view, setView] = useState<"chart" | "list">("chart");
  const [line, setLine] = useState(false);
  const [visibleMetrics, setVisibleMetrics] = useState(6);
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
  const preferredMetrics =
    kind === "income-statement"
      ? [
          "Total Revenue",
          "Gross Profit",
          "Operating Income",
          "Net Income",
          "Diluted EPS",
          "EBITDA",
        ]
      : keyRows[kind];
  const chartRows = [
    ...preferredMetrics.filter((key) => available.has(key)),
    ...rows.filter((key) => !preferredMetrics.includes(key)),
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
        <SegmentedControl
          label={c("Financial statement", "财务报表类型")}
          semantics="tabs"
          value={kind}
          onChange={(value) => {
            setKind(value);
            setVisibleMetrics(6);
          }}
          options={[
            { value: "income-statement", label: c("Income", "利润表") },
            { value: "balance-sheet", label: c("Balance sheet", "资产负债表") },
            { value: "cash-flow", label: c("Cash flow", "现金流量表") },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label={c("Financial view", "财务显示方式")}
            semantics="tabs"
            value={view}
            onChange={setView}
            options={[
              {
                value: "chart",
                label: (
                  <>
                    <BarChart3 aria-hidden="true" className="h-4 w-4" />
                    {c("Charts", "图表")}
                  </>
                ),
              },
              {
                value: "list",
                label: (
                  <>
                    <List aria-hidden="true" className="h-4 w-4" />
                    {c("List", "列表")}
                  </>
                ),
              },
            ]}
          />
          <PeriodToggle quarterly={quarterly} onChange={setQuarterly} />
          <Button
            size="sm"
            variant="outline"
            disabled={!periods.length}
            onClick={exportCsv}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
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
      {!!periods.length && view === "chart" && (
        <section
          aria-label={c("Metric trends", "指标趋势")}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {c(
                "Oldest → newest · Change vs previous report, not year over year",
                "时间从左到右 · 变化对比上一报告期，非同比",
              )}{" "}
              · {Math.min(visibleMetrics, chartRows.length)} /{" "}
              {chartRows.length} {c("metrics", "项指标")}
            </p>
            <ChartStyleToggle line={line} onChange={setLine} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {chartRows.slice(0, visibleMetrics).map((key) => (
              <FinancialMetricChart
                key={key}
                title={label(key)}
                currency={key.includes("Shares") ? c("shares", "股") : currency}
                data={statementTrend(periods, key)}
                line={line}
              />
            ))}
          </div>
          {visibleMetrics < chartRows.length && (
            <Button
              variant="outline"
              onClick={() => setVisibleMetrics((count) => count + 6)}
            >
              {c("Show more metrics", "显示更多指标")} (
              {chartRows.length - visibleMetrics})
            </Button>
          )}
          {visibleMetrics > 6 && (
            <Button variant="ghost" onClick={() => setVisibleMetrics(6)}>
              {c("Show fewer metrics", "收起指标")}
            </Button>
          )}
        </section>
      )}
      {!!periods.length && view === "list" && (
        <div
          role="region"
          tabIndex={0}
          aria-label={c(
            "Financial statements, scroll horizontally for more periods",
            "财务报表，可横向滚动查看更多报告期",
          )}
          className="glass-card bg-card-glass max-h-[72vh] overflow-auto rounded-3xl border border-foreground/10 focus-visible:outline-none "
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
                <tr key={key} className="group transition-colors hover:bg-foreground/[0.06]">
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 max-w-64 border-b border-r border-border bg-card px-4 py-4 text-left font-normal transition-colors group-hover:border-foreground/25",
                      keyRows[kind].includes(key) && "font-medium",
                    )}
                  >
                    {label(key)}
                  </th>
                  {periods.map((p, index) => (
                    <td
                      key={p.period}
                      className="figure whitespace-nowrap border-b border-border px-4 py-4 text-right transition-colors group-hover:border-foreground/25"
                    >
                      {f.number(p[key])}
                      {index === 0 && (
                        <LatestReportChange
                          latest={p[key]}
                          previous={periods[1]?.[key]}
                        />
                      )}
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
          {c("Metric trends", "指标趋势")}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodToggle quarterly={quarterly} onChange={setQuarterly} />
          <ChartStyleToggle line={line} onChange={setLine} />
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
                period: period.period,
                value:
                  id === "margin"
                    ? revenue && income !== null
                      ? income / revenue
                      : null
                    : metricValue(period, metric.keys),
              };
            });
            return (
              <FinancialMetricChart
                key={id}
                title={c(metric.en, metric.zh)}
                currency={id === "margin" ? undefined : currency}
                ratio={id === "margin"}
                data={data}
                line={line}
                action={
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
                }
              />
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

function ChartStyleToggle({
  line,
  onChange,
}: {
  line: boolean;
  onChange: (line: boolean) => void;
}) {
  const c = useCopy();
  return (
    <SegmentedControl
      label={c("Chart style", "图表样式")}
      value={line ? "line" : "bars"}
      onChange={(value) => onChange(value === "line")}
      options={[
        { value: "bars", label: c("Bars", "柱状") },
        { value: "line", label: c("Line", "折线") },
      ]}
    />
  );
}

function LatestReportChange({
  latest,
  previous,
}: {
  latest: unknown;
  previous: unknown;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const change = financialChange(latest, previous);
  if (!change) return null;
  const value = change.relative === null ? change.absolute : change.relative;
  return (
    <span className="mt-1 block text-xs text-muted-foreground">
      {value >= 0 ? "+" : ""}
      {change.relative === null ? f.number(value) : f.percent(value)} ·{" "}
      {c("vs prior report", "较上期")}
    </span>
  );
}

export function FinancialMetricChart({
  title,
  currency,
  data,
  line,
  ratio = false,
  action,
}: {
  title: string;
  currency?: string;
  data: { period: string; value: number | null }[];
  line: boolean;
  ratio?: boolean;
  action?: ReactNode;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const format = (value: unknown) =>
    ratio ? f.percent(value) : f.number(value);
  const change = financialChange(latest?.value, previous?.value);
  const chartData = data.map((point) => ({
    ...point,
    label: Number.isFinite(Date.parse(point.period))
      ? f.date(point.period)
      : point.period,
  }));
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        minTickGap={24}
        tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
      />
      <YAxis
        width={68}
        tickLine={false}
        axisLine={false}
        tickFormatter={format}
        tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
      />
      <Tooltip
        cursor={
          line
            ? {
                stroke: "rgb(var(--muted-foreground))",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }
            : { fill: "rgb(var(--foreground))", fillOpacity: 0.035 }
        }
        contentStyle={chartTooltip}
        itemStyle={{ color: "rgb(var(--foreground))" }}
        formatter={(value) => [format(value), title]}
      />
      <ReferenceLine
        y={0}
        stroke="rgb(var(--muted-foreground))"
        strokeOpacity={0.5}
      />
    </>
  );
  return (
    <section className="min-w-0 rounded-3xl border border-foreground/10 glass-card bg-card-glass p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {title}
          {currency && <span className="ml-2 text-xs">{currency}</span>}
        </h3>
        {action}
      </div>
      <p className="figure mt-2 text-2xl font-semibold">
        {format(latest?.value)}
      </p>
      <p className="mt-2 min-h-5 text-xs text-muted-foreground">
        {change ? (
          <>
            <span className="figure">
              {change.absolute >= 0 ? "+" : ""}
              {ratio
                ? `${f.number(change.absolute * 100, false)} ${c("pp", "个百分点")}`
                : format(change.absolute)}
              {!ratio &&
                change.relative !== null &&
                ` (${change.relative >= 0 ? "+" : ""}${f.percent(change.relative)})`}
            </span>{" "}
            · {c("vs previous report", "较上一报告期")}
          </>
        ) : (
          c("No comparable previous report", "暂无可比上一期")
        )}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {chartData[chartData.length - 1]?.label}
      </p>
      <div
        className="mt-6 h-60"
        role="img"
        aria-label={`${title}: ${chartData.map((point) => `${point.label} ${format(point.value)}`).join("; ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          {line ? (
            <LineChart data={chartData}>
              {axes}
              <Line
                type="linear"
                dataKey="value"
                stroke="rgb(var(--positive))"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              {axes}
              <Bar
                dataKey="value"
                fill="rgb(var(--positive))"
                maxBarSize={32}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer py-2 focus-visible:outline-none ">
          {c("View period values", "查看各期数值")}
        </summary>
        <dl className="divide-y divide-border">
          {chartData.map((point) => (
            <div key={point.period} className="flex justify-between gap-4 py-2">
              <dt>{point.label}</dt>
              <dd className="figure font-medium text-foreground">
                {format(point.value)}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
