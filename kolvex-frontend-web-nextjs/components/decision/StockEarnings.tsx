"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCachedResource } from "@/hooks/useCachedResource";
import {
  earningsRows,
  finite,
  fundamentalsKey,
  loadFundamentals,
  type EarningsData,
} from "@/lib/stockFundamentals";
import { cn } from "@/lib/utils";
import { FinancialState, useFinancialFormat } from "./StockFinancialData";
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
  const data = rows.map((row) => ({ ...row, label: f.date(row.period) }));
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
              className="mt-6 h-72"
              role="img"
              aria-label={c(
                "EPS actual versus estimate. Exact values follow in the table.",
                "实际 EPS 与预期对比，具体数值见下方表格。",
              )}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
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
                    contentStyle={{
                      background: "rgb(var(--card))",
                      border: "1px solid rgb(var(--border))",
                      borderRadius: 12,
                    }}
                    formatter={(value) => f.number(value, false)}
                  />
                  <Legend />
                  <Bar
                    dataKey="estimate"
                    name={c("Estimate", "预期 EPS")}
                    fill="rgb(var(--muted-foreground))"
                    maxBarSize={24}
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="actual"
                    name={c("Actual", "实际 EPS")}
                    fill="rgb(var(--positive))"
                    maxBarSize={24}
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
              className="overflow-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                      className="border-t border-border hover:bg-muted"
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
      <p className="text-xs leading-5 text-muted-foreground">
        {c(
          "Source: Yahoo Finance · Dates follow the source. When report dates are unavailable, fiscal quarter ending dates are shown. Missing estimates and actuals are not inferred.",
          "来源：Yahoo Finance · 日期以数据源为准，缺少发布日期时展示财季截止日。缺失的预期或实际值不做推算。",
        )}
      </p>
    </div>
  );
}
