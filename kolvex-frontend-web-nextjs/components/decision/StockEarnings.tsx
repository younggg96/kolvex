"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LabelList,
  type LabelProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCachedResource } from "@/hooks/useCachedResource";
import {
  earningsRows,
  epsOutcome,
  finite,
  fundamentalsKey,
  loadFundamentals,
  type EarningsData,
} from "@/lib/stockFundamentals";
import { cn } from "@/lib/utils";
import { FinancialState, useFinancialFormat } from "./StockFinancialData";
import StockEarningsMaterials from "./StockEarningsMaterials";
import { useCopy } from "./shared";

export default function StockEarnings({
  symbol,
  currency,
}: {
  symbol: string;
  currency: string;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const key = fundamentalsKey(symbol, "earnings");
  const resource = useCachedResource(
    key,
    (signal) => loadFundamentals<EarningsData>(key, signal),
    { ttl: 300_000 },
  );
  const rows = resource.data ? earningsRows(resource.data) : [];
  // Upcoming rows have no reported EPS. The source's date is kept, never guessed.
  const upcoming = rows.find(
    (row) => Date.parse(row.period) > Date.now() && !finite(row.actual),
  );
  const actual = rows.filter((row) => finite(row.actual));
  const latest = actual[actual.length - 1];
  const data = rows.map((row) => ({
    ...row,
    label: f.date(row.period),
    outcome: epsOutcome(row.actual, row.estimate),
  }));
  const outcomeLabel = (kind: "beat" | "miss" | "met") =>
    kind === "beat" ? "Beat" : kind === "miss" ? "Miss" : c("Met", "符合预期");
  const outcomeClass = (kind: "beat" | "miss" | "met") =>
    kind === "beat"
      ? "text-positive"
      : kind === "miss"
        ? "text-negative"
        : "text-muted-foreground";
  const deltaLabel = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value) > 0 && Math.abs(value) < 0.01 ? `<0.01` : f.number(Math.abs(value), false)} ${currency}`;
  const renderOutcome = (props: LabelProps, series: "estimate" | "actual") => {
    const row = data[props.index ?? -1];
    if (
      !row?.outcome ||
      (row.outcome.kind === "miss"
        ? series !== "estimate"
        : series !== "actual")
    )
      return null;
    const x = Number(props.x) + Number(props.width) / 2;
    const y = Number(props.y);
    if (!finite(x) || !finite(y)) return null;
    const color =
      row.outcome.kind === "beat"
        ? "rgb(var(--positive))"
        : row.outcome.kind === "miss"
          ? "rgb(var(--negative))"
          : "rgb(var(--muted-foreground))";
    return (
      <g aria-hidden="true" fill={color} pointerEvents="none">
        <text
          x={x}
          y={y - 20}
          textAnchor="middle"
          fontSize={11}
          fontWeight={500}
        >
          {outcomeLabel(row.outcome.kind)}
        </text>
        <path
          d={`M ${x - 4} ${y - 14} L ${x + 4} ${y - 14} L ${x} ${y - 9} Z`}
        />
      </g>
    );
  };
  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-6 border-b border-border pb-6 lg:grid-cols-4">
        {[
          [
            c("Next earnings", "下次财报"),
            upcoming ? f.date(upcoming.period) : c("Not announced", "暂未公布"),
          ],
          [
            c("Next EPS estimate", "下期 EPS 预期"),
            f.number(upcoming?.estimate, false),
          ],
          [
            c("Latest reported EPS", "最新实际 EPS"),
            f.number(latest?.actual, false),
          ],
          [
            c("EPS surprise", "EPS 超预期幅度"),
            finite(latest?.surprise)
              ? `${latest.surprise >= 0 ? "+" : ""}${f.number(latest.surprise, false)}%`
              : "—",
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="figure mt-2 text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <FinancialState
        loading={resource.loading}
        error={Boolean(resource.error)}
        empty={!rows.length}
        retry={resource.refresh}
      />
      {!!rows.length && (
        <>
          <section aria-labelledby="earnings-chart-title">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="earnings-chart-title" className="text-xl font-semibold">
                {c("Earnings per share", "每股收益对比")}
              </h2>
              <span className="text-xs text-muted-foreground">
                {currency} · {c("Available reports", "可用报告期")}
              </span>
            </div>
            <div
              className="mt-6 overflow-x-auto rounded-2xl focus-visible:outline-none "
              tabIndex={0}
              role="region"
              aria-label={c(
                "EPS actual versus estimate. Exact values follow in the table.",
                "实际 EPS 与预期对比，具体数值见下方表格。",
              )}
            >
              <div
                className="h-80"
                style={{ minWidth: Math.max(360, data.length * 76) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    barSize={14}
                    barGap={4}
                    data={data}
                    margin={{ top: 36, right: 16, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="rgb(var(--border))"
                    />
                    <XAxis
                      dataKey="label"
                      minTickGap={24}
                      tickLine={false}
                      axisLine={false}
                      tick={{
                        fontSize: 11,
                        fill: "rgb(var(--muted-foreground))",
                      }}
                    />
                    <YAxis
                      width={48}
                      tickLine={false}
                      axisLine={false}
                      tick={{
                        fontSize: 11,
                        fill: "rgb(var(--muted-foreground))",
                      }}
                    />
                    <Tooltip
                      cursor={{
                        fill: "rgb(var(--foreground))",
                        fillOpacity: 0.035,
                      }}
                      content={({ active, payload }) => {
                        const row = payload?.[0]?.payload as
                          | (typeof data)[number]
                          | undefined;
                        if (!active || !row) return null;
                        return (
                          <div className="min-w-40 rounded-3xl border border-border bg-card p-3 text-xs text-foreground">
                            <p className="mb-2 font-semibold">{row.label}</p>
                            <dl className="space-y-1">
                              <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">
                                  {c("Est. EPS", "预期 EPS")}
                                </dt>
                                <dd className="figure">
                                  {f.number(row.estimate, false)} {currency}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">
                                  {c("Act. EPS", "实际 EPS")}
                                </dt>
                                <dd className="figure">
                                  {f.number(row.actual, false)} {currency}
                                </dd>
                              </div>
                            </dl>
                            {row.outcome && (
                              <p
                                className={cn(
                                  "figure mt-2 font-semibold",
                                  outcomeClass(row.outcome.kind),
                                )}
                              >
                                {outcomeLabel(row.outcome.kind)} (
                                {deltaLabel(row.outcome.delta)})
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="estimate"
                      name={c("Estimate", "预期 EPS")}
                      fill="rgb(var(--muted-foreground))"
                      maxBarSize={24}
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    >
                      <LabelList
                        content={(props) => renderOutcome(props, "estimate")}
                      />
                    </Bar>
                    <Bar
                      dataKey="actual"
                      name={c("Actual", "实际 EPS")}
                      fill="rgb(var(--positive))"
                      maxBarSize={24}
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    >
                      <LabelList
                        content={(props) => renderOutcome(props, "actual")}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {c(
                "Beat / Miss compare reported EPS with estimates. Unreported periods have no marker. Scroll horizontally to see more periods.",
                "Beat / Miss 根据实际 EPS 与预期比较；未公布或缺少预期时不显示标记，可横向滚动查看更多报告期。",
              )}
            </p>
          </section>
          <section>
            <h2 className="mb-4 text-xl font-semibold">
              {c("Earnings history & estimates", "盈利历史与预期")}
            </h2>
            <div
              role="region"
              tabIndex={0}
              aria-label={c(
                "Earnings history, horizontally scrollable",
                "盈利历史表，可横向滚动",
              )}
              className="overflow-auto rounded-3xl border border-border focus-visible:outline-none "
            >
              <table className="w-full whitespace-nowrap text-sm">
                <caption className="sr-only">
                  {c("Earnings history", "盈利历史")}
                </caption>
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    {[
                      c("Report / period date", "报告 / 报告期日期"),
                      c("Estimated EPS", "预期 EPS"),
                      c("Actual EPS", "实际 EPS"),
                      c("Result vs estimate", "预期表现"),
                      c("Surprise", "超预期幅度"),
                    ].map((label, index) => (
                      <th
                        key={label}
                        scope="col"
                        className={cn(
                          "px-4 py-4 font-medium",
                          index ? "text-right" : "text-left",
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((row) => (
                    <tr
                      key={row.period}
                      className="border-t border-border transition-colors hover:bg-foreground/[0.06]"
                    >
                      <th
                        scope="row"
                        className="px-4 py-4 text-left font-medium"
                      >
                        {f.date(row.period)}
                      </th>
                      <td className="figure px-4 py-4 text-right">
                        {f.number(row.estimate, false)}
                      </td>
                      <td className="figure px-4 py-4 text-right">
                        {f.number(row.actual, false)}
                      </td>
                      <td className="figure px-4 py-4 text-right">
                        <EarningsOutcome
                          actual={row.actual}
                          estimate={row.estimate}
                          currency={currency}
                        />
                      </td>
                      <td
                        className={cn(
                          "figure px-4 py-4 text-right",
                          finite(row.surprise) &&
                            (row.surprise >= 0
                              ? "text-positive"
                              : "text-negative"),
                        )}
                      >
                        {finite(row.surprise)
                          ? `${row.surprise >= 0 ? "+" : ""}${f.number(row.surprise, false)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <StockEarningsMaterials symbol={symbol} />
      <p className="text-xs leading-5 text-muted-foreground">
        {c(
          "EPS source: Yahoo Finance · Dates follow the source. When report dates are unavailable, fiscal quarter ending dates are shown. Missing estimates and actuals are not inferred.",
          "EPS 来源：Yahoo Finance · 日期以数据源为准，缺少发布日期时展示财季截止日。缺失的预期或实际值不做推算。",
        )}
      </p>
    </div>
  );
}

function EarningsOutcome({
  actual,
  estimate,
  currency,
}: {
  actual: number | null;
  estimate: number | null;
  currency: string;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const outcome = epsOutcome(actual, estimate);
  if (!outcome) return <>—</>;
  const label =
    outcome.kind === "beat"
      ? "Beat"
      : outcome.kind === "miss"
        ? "Miss"
        : c("Met", "符合预期");
  return (
    <span
      className={
        outcome.kind === "beat"
          ? "text-positive"
          : outcome.kind === "miss"
            ? "text-negative"
            : "text-muted-foreground"
      }
    >
      {label}
      {outcome.delta !== 0 && (
        <span className="ml-2 text-xs">
          ({outcome.delta > 0 ? "+" : "−"}
          {Math.abs(outcome.delta) < 0.01
            ? "<0.01"
            : f.number(Math.abs(outcome.delta), false)}{" "}
          {currency})
        </span>
      )}
    </span>
  );
}
