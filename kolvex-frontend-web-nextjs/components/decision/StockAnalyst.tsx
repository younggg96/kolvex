"use client";
import { useCachedResource } from "@/hooks/useCachedResource";
import {
  finite,
  fundamentalsKey,
  loadFundamentals,
} from "@/lib/stockFundamentals";
import { FinancialState, useFinancialFormat } from "./StockFinancialData";
import { useCopy } from "./shared";
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
  const consensus = data?.recommendations_summary.find(
    (row) => row.period === "0m",
  );
  const difference =
    finite(data?.target_mean_price) &&
    finite(data?.current_price) &&
    data.current_price > 0
      ? data.target_mean_price / data.current_price - 1
      : null;
  const empty = !finite(data?.target_mean_price) && !consensus;
  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">
        {c("Analyst price targets", "分析师目标价")}
      </h2>
      <FinancialState
        loading={resource.loading}
        error={Boolean(resource.error)}
        empty={!resource.loading && !resource.error && empty}
        retry={resource.refresh}
      />
      {data && !empty && (
        <>
          <dl className="grid grid-cols-2 gap-6 rounded-xl border border-border bg-card p-6 lg:grid-cols-4">
            {[
              [
                c("Mean target", "平均目标价"),
                `${f.number(data.target_mean_price, false)} ${currency}`,
              ],
              [
                c("Low / high target", "最低 / 最高目标价"),
                `${f.number(data.target_low_price, false)} / ${f.number(data.target_high_price, false)} ${currency}`,
              ],
              [
                c("Difference from source price", "相对数据源股价"),
                finite(difference)
                  ? `${difference >= 0 ? "+" : ""}${f.percent(difference)}`
                  : "—",
              ],
              [
                c("Analysts", "覆盖分析师"),
                f.number(data.number_of_analyst_opinions, false),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="figure mt-3 text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {consensus && (
            <section className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-6 font-semibold">
                {c("Current analyst distribution", "当前分析师评级分布")}
              </h3>
              <dl className="grid grid-cols-2 gap-6 sm:grid-cols-5">
                {[
                  [c("Strong buy", "强烈买入"), consensus.strong_buy],
                  [c("Buy", "买入"), consensus.buy],
                  [c("Hold", "持有"), consensus.hold],
                  [c("Sell", "卖出"), consensus.sell],
                  [c("Strong sell", "强烈卖出"), consensus.strong_sell],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="figure mt-2 text-2xl font-semibold">
                      {f.number(value, false)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </>
      )}
      <p className="max-w-prose text-xs leading-5 text-muted-foreground">
        {c(
          "Source: Yahoo Finance · Targets represent analyst estimates, not fair value or guaranteed returns. The comparison uses the price supplied with the analyst data; it may differ from the latest quote.",
          "来源：Yahoo Finance · 目标价代表分析师预期，不等于公允价值或收益保证。对比使用评级数据附带的股价，可能与最新报价不同。",
        )}
      </p>
    </div>
  );
}
