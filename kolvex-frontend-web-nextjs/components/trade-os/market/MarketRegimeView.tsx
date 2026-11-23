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
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import { withSign } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MarketRegimeView() {
  const c = useCopy();
  const [data, setData] = useState<MarketRegimeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = {
    title: c("Market Regime Engine", "市场宏观环境引擎"),
    subtitle: c(
      "Automated macro trend and risk confirmation using SPY and QQQ dual moving averages (SMA 50/200).",
      "基于 SPY 与 QQQ 双基准均线体系（SMA 50/200）的宏观风险确认引擎。",
    ),
    reEvaluate: c("Re-evaluate Market", "重新评估大盘"),
    evaluating: c("Evaluating...", "评估中..."),
    lastEvaluated: c("Evaluated At", "评估时间"),
    status: c("Current Macro Regime", "当前宏观状态"),
    permission: c("New Long Entries", "新开多仓权限"),
    allowed: c("Allowed", "允许开仓"),
    blocked: c("Blocked / Prohibited", "禁止开仓"),
    riskBudget: c("Effective Risk Budget per Trade", "单笔有效风险预算"),
    rulesNote: c(
      "Risk Off blocks all new long approvals. Neutral cuts risk budget by 50% (0.25%). Risk On permits standard 0.50% budget.",
      "Risk Off（防守状态）将全面冻结新开多仓；Neutral（中性）单笔风险减半至 0.25%；Risk On（进攻状态）开放标准 0.50% 风险预算。",
    ),
    price: c("Price", "最新价格"),
    sma50: c("50-Day SMA", "50 日均线"),
    sma200: c("200-Day SMA", "200 日均线"),
    distance200: c("Distance to 200 SMA", "距 200 日线幅度"),
    slope20: c("200 SMA 20D Slope", "200 日线 20 日斜率"),
    structure: c("Trend Structure", "均线结构"),
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchMarketRegime();
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load market regime");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReevaluate = async () => {
    try {
      setEvaluating(true);
      setError(null);
      const res = await evaluateMarketRegime();
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to evaluate market regime");
    } finally {
      setEvaluating(false);
    }
  };

  const renderBadge = (regime: string) => {
    if (regime === "risk_on") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-positive border border-emerald-500/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          RISK ON (进攻)
        </span>
      );
    }
    if (regime === "neutral") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          NEUTRAL (中性防守)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-negative/15 text-negative border border-negative/30">
        <ShieldAlert className="w-3.5 h-3.5" />
        RISK OFF (全面防守)
      </span>
    );
  };

  const renderBenchmarkCard = (bm: BenchmarkMetrics, title: string) => {
    const isBull = bm.status === "bullish";
    const distNum = parseFloat(bm.distance_to_sma200_pct || "0");
    const slopeNum = parseFloat(bm.sma200_slope_20d_pct || "0");

    return (
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              {title} ({bm.symbol})
              {isBull ? (
                <TrendingUp className="w-4 h-4 text-positive" />
              ) : (
                <TrendingDown className="w-4 h-4 text-negative" />
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bm.last_bar_date ? `Session: ${bm.last_bar_date}` : "Daily OHLCV"}
            </p>
          </div>
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-full text-xs font-medium uppercase border",
              isBull
                ? "bg-emerald-500/10 text-positive border-emerald-500/20"
                : "bg-negative/10 text-negative border-negative/20",
            )}
          >
            {bm.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-muted/30 p-3 rounded-2xl border border-foreground/5">
            <span className="text-xs text-muted-foreground block">{t.price}</span>
            <span className="figure font-semibold text-foreground mt-1 block">
              ${parseFloat(bm.price || "0").toFixed(2)}
            </span>
          </div>

          <div className="bg-muted/30 p-3 rounded-2xl border border-foreground/5">
            <span className="text-xs text-muted-foreground block">{t.distance200}</span>
            <span
              className={cn(
                "figure font-semibold mt-1 block",
                distNum >= 0 ? "text-positive" : "text-negative",
              )}
            >
              {withSign(distNum, (m) => `${m.toFixed(2)}%`)}
            </span>
          </div>

          <div className="bg-muted/30 p-3 rounded-2xl border border-foreground/5">
            <span className="text-xs text-muted-foreground block">{t.sma50}</span>
            <span className="figure font-medium text-foreground mt-1 block">
              ${parseFloat(bm.sma50 || "0").toFixed(2)}
            </span>
          </div>

          <div className="bg-muted/30 p-3 rounded-2xl border border-foreground/5">
            <span className="text-xs text-muted-foreground block">{t.sma200}</span>
            <span className="figure font-medium text-foreground mt-1 block">
              ${parseFloat(bm.sma200 || "0").toFixed(2)}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t.slope20}:</span>
          <span className="figure font-medium text-foreground">
            {withSign(slopeNum, (m) => `${m.toFixed(2)}%`)}
          </span>
        </div>

        <div className="space-y-1.5 pt-1 text-xs">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                bm.is_above_sma200 ? "bg-primary" : "bg-negative",
              )}
            />
            <span className="text-muted-foreground">
              Price {bm.is_above_sma200 ? ">" : "<"} 200 SMA
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                bm.is_above_sma50 ? "bg-primary" : "bg-negative",
              )}
            />
            <span className="text-muted-foreground">
              Price {bm.is_above_sma50 ? ">" : "<"} 50 SMA
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                bm.is_golden_cross ? "bg-primary" : "bg-amber-500",
              )}
            />
            <span className="text-muted-foreground">
              50 SMA {bm.is_golden_cross ? ">" : "<"} 200 SMA (Golden Cross)
            </span>
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        {c("Loading Market Regime...", "正在加载大盘环境数据...")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{t.title}</h2>
        <Button
          onClick={handleReevaluate}
          disabled={evaluating}
          size="sm"
          className="rounded-full px-4 text-xs font-semibold"
        >
          <RefreshCw className={cn("mr-1.5 w-3.5 h-3.5", evaluating && "animate-spin")} />
          {evaluating ? t.evaluating : t.reEvaluate}
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Regime Status Banner */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  {t.status}
                </span>
                <div className="pt-1">{renderBadge(data.regime)}</div>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">{t.permission}</span>
                  <span
                    className={cn(
                      "font-semibold",
                      data.allow_new_entries ? "text-positive" : "text-negative",
                    )}
                  >
                    {data.allow_new_entries ? t.allowed : t.blocked}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">{t.riskBudget}</span>
                  <span className="figure font-semibold text-foreground">
                    {(parseFloat(data.effective_risk_pct) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-foreground/90 bg-muted/30 p-3.5 rounded-2xl border border-foreground/5 leading-relaxed">
              {data.summary}
            </p>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>{t.rulesNote}</span>
            </div>
          </Card>

          {/* Benchmark Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {renderBenchmarkCard(data.spy, "S&P 500 ETF")}
            {renderBenchmarkCard(data.qqq, "Nasdaq 100 ETF")}
          </div>
        </>
      )}
    </div>
  );
}
