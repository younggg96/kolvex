"use client";
import { AnalystSkeleton } from "@/components/decision/StockTabSkeletons";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useStockQuote } from "@/hooks/useStockData";
import {
  finite,
  fundamentalsKey,
  loadFundamentals,
} from "@/lib/stockFundamentals";
import { FinancialState, useFinancialFormat } from "./StockFinancialData";
import { useCopy } from "./shared";
import { cn } from "@/lib/utils";

type AnalystData = {
  current_price: number | null;
  target_mean_price: number | null;
  target_low_price: number | null;
  target_high_price: number | null;
  number_of_analyst_opinions: number | null;
  recommendations_summary: {
    period: string | null;
    strong_buy: number | null;
    buy: number | null;
    hold: number | null;
    sell: number | null;
    strong_sell: number | null;
  }[];
};

export default function StockAnalyst({
  symbol,
  currency,
}: {
  symbol: string;
  currency: string;
}) {
  const c = useCopy();
  const f = useFinancialFormat();
  const key = fundamentalsKey(symbol, "analyst");
  const resource = useCachedResource(
    key,
    (signal) => loadFundamentals<AnalystData>(key, signal),
    { ttl: 300_000 },
  );
  const data = resource.data;
  const quoteResource = useStockQuote(symbol);
  const currentPrice = quoteResource.data?.price;
  const consensus = data?.recommendations_summary.find(
    (row) => row.period === "0m",
  );
  const difference =
    finite(data?.target_mean_price) &&
    finite(currentPrice) &&
    currentPrice > 0
      ? data.target_mean_price / currentPrice - 1
      : null;
  const empty = !finite(data?.target_mean_price) && !consensus;
  const ratings = [
    {
      label: c("Strong buy", "强烈买入"),
      count: consensus?.strong_buy,
      color: "bg-positive",
    },
    { label: c("Buy", "买入"), count: consensus?.buy, color: "bg-positive" },
    {
      label: c("Hold", "持有"),
      count: consensus?.hold,
      color: "bg-muted-foreground",
    },
    { label: c("Sell", "卖出"), count: consensus?.sell, color: "bg-negative" },
    {
      label: c("Strong sell", "强烈卖出"),
      count: consensus?.strong_sell,
      color: "bg-negative",
    },
  ];
  const completeRatings = ratings.every(
    (row) => finite(row.count) && row.count >= 0,
  );
  const ratingTotal = completeRatings
    ? ratings.reduce((sum, row) => sum + row.count!, 0)
    : null;
  const low = data?.target_low_price;
  const high = data?.target_high_price;
  const hasRange = finite(low) && finite(high) && low > 0 && high > low;
  const position = (value: number) =>
    hasRange
      ? Math.max(0, Math.min(100, ((value - low!) / (high! - low!)) * 100))
      : 0;
  const outsideRange =
    hasRange &&
    finite(currentPrice) &&
    (currentPrice < low! || currentPrice > high!);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">
        {c("Analyst price targets", "分析师目标价")}
      </h2>
      <FinancialState
        loading={resource.loading}
        error={Boolean(resource.error)}
        empty={!resource.loading && !resource.error && empty}
        retry={resource.refresh}
        skeleton={<AnalystSkeleton />}
      />
      {data && !empty && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section
            className="min-w-0 rounded-3xl border border-foreground/10 glass-card bg-card-glass p-4 sm:p-6"
            aria-labelledby="analyst-price-heading"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3
                  id="analyst-price-heading"
                  className="text-sm text-muted-foreground"
                >
                  {c("Mean analyst target", "分析师平均目标价")}
                </h3>
                <p className="figure mt-3 text-3xl font-semibold sm:text-4xl">
                  {f.number(data.target_mean_price, false)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {currency}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {c("vs reference price", "相对参考股价")}
                </p>
                <p
                  className={cn(
                    "figure mt-3 text-xl font-semibold",
                    finite(difference) &&
                      (difference >= 0 ? "text-positive" : "text-negative"),
                  )}
                >
                  {finite(difference)
                    ? `${difference >= 0 ? "+" : ""}${f.percent(difference)}`
                    : "—"}
                </p>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5">
              <div>
                <dt className="text-xs text-muted-foreground">
                  {c("Reference price", "参考股价")}
                </dt>
                <dd className="figure mt-2 text-base font-medium">
                  {f.number(currentPrice, false)}{" "}
                  <span className="text-xs text-muted-foreground">
                    {currency}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {c("Analyst coverage", "覆盖分析师")}
                </dt>
                <dd className="figure mt-2 text-base font-medium">
                  {f.number(data.number_of_analyst_opinions, false)}
                </dd>
              </div>
            </dl>
            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full bg-foreground"
                    aria-hidden="true"
                  />
                  {c("Reference price", "参考股价")}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full bg-positive"
                    aria-hidden="true"
                  />
                  {c("Mean target", "平均目标价")}
                </span>
              </div>
              {hasRange && (
                <div
                  className="relative mx-2 my-5 h-2 rounded-full bg-muted"
                  aria-hidden="true"
                >
                  {finite(currentPrice) && (
                    <span
                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
                      style={{ left: `${position(currentPrice)}%` }}
                    />
                  )}
                  {finite(data.target_mean_price) && (
                    <span
                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-positive"
                      style={{ left: `${position(data.target_mean_price)}%` }}
                    />
                  )}
                </div>
              )}
              <dl className="mt-4 flex justify-between gap-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {c("Lowest target", "最低目标价")}
                  </dt>
                  <dd className="figure mt-2 font-medium">
                    {f.number(low, false)}{" "}
                    <span className="text-xs text-muted-foreground">
                      {currency}
                    </span>
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-muted-foreground">
                    {c("Highest target", "最高目标价")}
                  </dt>
                  <dd className="figure mt-2 font-medium">
                    {f.number(high, false)}{" "}
                    <span className="text-xs text-muted-foreground">
                      {currency}
                    </span>
                  </dd>
                </div>
              </dl>
              {outsideRange && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {c(
                    "The reference price is outside the analyst target range; its marker is shown at the nearest edge.",
                    "参考股价位于目标价区间之外，标记显示在相应边界。",
                  )}
                </p>
              )}
            </div>
          </section>
          {consensus && (
            <section
              className="min-w-0 rounded-3xl border border-foreground/10 glass-card bg-card-glass p-4 sm:p-6"
              aria-labelledby="analyst-ratings-heading"
            >
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
                <h3
                  id="analyst-ratings-heading"
                  className="text-base font-semibold"
                >
                  {c("Current rating distribution", "当前评级分布")}
                </h3>
                {ratingTotal !== null && (
                  <span className="figure text-xs text-muted-foreground">
                    {c(`${ratingTotal} ratings`, `${ratingTotal} 份评级`)}
                  </span>
                )}
              </div>
              <ul className="space-y-5">
                {ratings.map((row) => {
                  const share =
                    ratingTotal && finite(row.count)
                      ? row.count / ratingTotal
                      : null;
                  return (
                    <li
                      key={row.label}
                      className="grid grid-cols-[6rem_minmax(0,1fr)_2rem_3.5rem] items-center gap-3 text-sm"
                    >
                      <span className="text-muted-foreground">{row.label}</span>
                      <span
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        aria-hidden="true"
                      >
                        {share !== null && (
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              row.color,
                            )}
                            style={{ width: `${share * 100}%` }}
                          />
                        )}
                      </span>
                      <span className="figure text-right font-medium">
                        {f.number(row.count, false)}
                      </span>
                      <span className="figure text-right text-xs text-muted-foreground">
                        {share !== null ? f.percent(share) : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                {c(
                  "Rating sample size and analyst coverage follow separate source fields and may differ.",
                  "评级样本数与覆盖分析师数来自不同字段，可能并不一致。",
                )}
              </p>
            </section>
          )}
        </div>
      )}
      <p className="w-full max-w-none text-xs leading-5 text-muted-foreground">
        {c(
          "Source: Yahoo Finance · Targets represent analyst estimates, not fair value or guaranteed returns. The comparison uses the price supplied with the analyst data; it may differ from the latest quote.",
          "来源：Yahoo Finance · 目标价代表分析师预期，不等于公允价值或收益保证。对比使用评级数据附带的股价，可能与最新报价不同。",
        )}
      </p>
    </div>
  );
}
