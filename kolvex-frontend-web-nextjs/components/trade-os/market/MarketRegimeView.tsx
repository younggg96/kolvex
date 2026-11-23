"use client";

import React, { useState, useEffect } from "react";
import { useCopy } from "@/components/decision/shared";
import {
  fetchMarketRegime,
  evaluateMarketRegime,
  MarketRegimeResponse,
  BenchmarkMetrics,
} from "@/lib/tradeOsApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Check, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegimeBadge } from "@/components/trade-os/shared";

export function MarketRegimeView() {
  const c = useCopy();
  const [data, setData] = useState<MarketRegimeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conditionText: Record<string, string> = {
    SPY_CLOSE_ABOVE_SMA200: c("SPY close > SMA200", "SPY 收盘 > 200 日均线"),
    SPY_SMA50_ABOVE_SMA200: c("SPY SMA50 > SMA200", "SPY 50 日线 > 200 日线"),
    QQQ_CLOSE_ABOVE_SMA50: c("QQQ close > SMA50", "QQQ 收盘 > 50 日均线"),
  };

  useEffect(() => {
    (async () => {
      try {
        setData(await fetchMarketRegime());
      } catch (err: any) {
        setError(err?.message || c("Failed to load market state", "市场状态加载失败"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReevaluate = async () => {
    try {
      setEvaluating(true);
      setError(null);
      setData(await evaluateMarketRegime());
    } catch (err: any) {
      setError(err?.message || c("Failed to evaluate", "评估失败"));
    } finally {
      setEvaluating(false);
    }
  };

  const pct = (v: string | undefined) => `${(parseFloat(v || "0") * 100).toFixed(2)}%`;
  const money = (v: string | undefined) => (v ? `$${parseFloat(v).toFixed(2)}` : "—");

  const benchmark = (bm: BenchmarkMetrics) => (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">{bm.symbol}</h3>
        <span className="text-xs text-muted-foreground">
          {bm.last_bar_date ?? c("No data", "无数据")}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        {[
          [c("Close", "收盘"), money(bm.price)],
          ["SMA50", money(bm.sma50)],
          ["SMA200", money(bm.sma200)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="figure mt-0.5 font-semibold text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
        {c("Loading market state...", "正在加载市场状态...")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold text-foreground">
            {c("Can I open new longs today?", "今天能不能开新多仓？")}
          </h2>
          <InfoTip label={c("How the market state is decided", "市场状态怎么判断")}>
            <p>
              {c(
                "Risk On: all three conditions hold → 0.5% per trade, up to 4 positions, 2% total open risk. Cautious: SPY above SMA200 but not all three → 0.25%, 2 positions, 0.5%. Risk Off: SPY at or below SMA200 → no new longs. Unknown: data missing or older than 5 days → no new entries. Computed from the last completed daily close.",
                "进攻：三条全部满足 → 单笔 0.5%、最多 4 笔、合计风险 2%。谨慎：SPY 在 200 日线上方但未全满足 → 0.25%、2 笔、0.5%。防守：SPY 收盘不高于 200 日线 → 禁止新多仓。未知：数据缺失或超过 5 天 → 禁止新开仓。按最近一个完整日线收盘计算。",
              )}
            </p>
          </InfoTip>
        </div>
        <Button
          onClick={handleReevaluate}
          disabled={evaluating}
          size="sm"
          variant="outline"
          className="rounded-full px-3.5 text-xs"
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", evaluating && "animate-spin")} />
          {evaluating ? c("Updating...", "更新中...") : c("Recalculate", "重新计算")}
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-negative/30 bg-negative/10 p-4 text-sm text-negative">
          {error}
        </div>
      )}

      {data && (
        <>
          <Card className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <RegimeBadge regime={data.regime} className="px-3 py-1 text-sm" />
              <span className="text-xs text-muted-foreground">
                {c("Based on close of", "依据收盘日")} {data.data_as_of ?? "—"}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [
                  c("New longs", "新开多仓"),
                  data.allow_new_entries ? c("Allowed", "允许") : c("Blocked", "禁止"),
                ],
                [c("Risk per trade", "单笔风险"), pct(data.effective_risk_pct)],
                [c("Max positions", "最多持仓"), String(data.max_positions)],
                [c("Total open risk", "合计止损风险"), pct(data.max_open_risk_pct)],
              ].map(([k, v], i) => (
                <div key={k} className="rounded-2xl border border-foreground/5 bg-muted/30 p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd
                    className={cn(
                      "figure mt-1 text-base font-semibold",
                      i === 0
                        ? data.allow_new_entries
                          ? "text-positive"
                          : "text-negative"
                        : "text-foreground",
                    )}
                  >
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            {data.conditions.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {data.conditions.map((cond) => (
                  <li key={cond.code} className="flex items-center gap-2">
                    {cond.passed ? (
                      <Check className="h-4 w-4 text-positive" aria-label={c("Met", "满足")} />
                    ) : (
                      <X className="h-4 w-4 text-negative" aria-label={c("Not met", "不满足")} />
                    )}
                    <span className={cond.passed ? "text-foreground" : "text-muted-foreground"}>
                      {conditionText[cond.code] ?? cond.code}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {c(
                  "SPY/QQQ data is missing or out of date, so new entries are blocked until it recovers.",
                  "SPY/QQQ 数据缺失或已过期，恢复前禁止新开仓。",
                )}
              </p>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {benchmark(data.spy)}
            {benchmark(data.qqq)}
          </div>
        </>
      )}
    </div>
  );
}
