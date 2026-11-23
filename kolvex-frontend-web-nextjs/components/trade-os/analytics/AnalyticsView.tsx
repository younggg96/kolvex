"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useCopy } from "@/components/decision/shared";
import { fetchAccounts, fetchAnalytics, TradingAccount, AccountAnalytics } from "@/lib/tradeOsApi";
import {
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Target,
  RefreshCw,
  PieChart,
  Award,
  AlertTriangle,
} from "lucide-react";
import { withSign } from "@/lib/format";

export function AnalyticsView() {
  const c = useCopy();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [data, setData] = useState<AccountAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const t = {
    title: c("Trading Performance & Discipline Analytics", "交易绩效与纪律统计"),
    subtitle: c(
      "Expectancy, R-Multiple distributions, and execution error attribution.",
      "每笔期望收益 R、盈亏比分布与执行偏差归因分析。",
    ),
    planCoverage: c("Plan Coverage Rate", "计划覆盖率"),
    winRate: c("Win Rate", "胜率"),
    profitFactor: c("Profit Factor", "盈亏比 (PF)"),
    expectancy: c("Expectancy R", "每笔期望 R"),
    netPnl: c("Net Realized PnL", "累计净盈亏"),
    outsidePlan: c("Outside Plan Trades", "计划外交易笔数"),
    rDistribution: c("R-Multiple Distribution", "R 盈亏比频数分布"),
    mistakeAnalysis: c("Execution Errors & Mistake Tags", "执行失误与违纪标签归因"),
    empty: c("No closed trades to analyze yet.", "暂无已平仓交易可供统计。"),
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const accs = await fetchAccounts();
      setAccounts(accs);
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  const loadAnalytics = useCallback(async (accId: string) => {
    try {
      setLoading(true);
      const res = await fetchAnalytics(accId);
      setData(res);
    } catch (err) {
      console.error("Failed to load analytics", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedAccountId) {
      loadAnalytics(selectedAccountId);
    }
  }, [selectedAccountId, loadAnalytics]);

  const R_BUCKET_LABELS: Record<string, { label: string; isWin: boolean }> = {
    loss_gt_2r: { label: "< -2R", isWin: false },
    loss_1_to_2r: { label: "-2R ~ -1R", isWin: false },
    loss_0_to_1r: { label: "-1R ~ 0R", isWin: false },
    win_0_to_1r: { label: "0R ~ 1R", isWin: true },
    win_1_to_2r: { label: "1R ~ 2R", isWin: true },
    win_2_to_3r: { label: "2R ~ 3R", isWin: true },
    win_gt_3r: { label: "> 3R", isWin: true },
  };

  const maxRCount = data?.r_distribution ? Math.max(...Object.values(data.r_distribution), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {t.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t.subtitle}</p>
        </div>

        {accounts.length > 0 && (
          <select
            value={selectedAccountId || ""}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_name} ({a.broker})
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Loading Analytics...
        </div>
      ) : !data || data.total_closed_trades === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card p-12 text-center text-sm text-muted-foreground">
          {t.empty}
        </div>
      ) : (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.planCoverage}</span>
              <div
                className={`text-xl font-bold ${
                  data.plan_coverage_pct >= 80 ? "text-emerald-500" : "text-amber-500"
                }`}
              >
                {data.plan_coverage_pct.toFixed(1)}%
              </div>
              <span className="text-[11px] text-muted-foreground">
                {data.outside_plan_count} Outside Plan
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.expectancy}</span>
              <div
                className={`text-xl font-bold ${
                  data.expectancy_r >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {withSign(data.expectancy_r, (m) => `${m.toFixed(2)}R`)}
              </div>
              <span className="text-[11px] text-muted-foreground">Avg Return / Risk</span>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.winRate}</span>
              <div className="text-xl font-bold text-foreground">
                {data.win_rate_pct.toFixed(1)}%
              </div>
              <span className="text-[11px] text-muted-foreground">
                Total: {data.total_closed_trades} trades
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.profitFactor}</span>
              <div className="text-xl font-bold text-foreground">
                {data.profit_factor.toFixed(2)}
              </div>
              <span className="text-[11px] text-muted-foreground">Gross Win / Loss</span>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.netPnl}</span>
              <div
                className={`text-xl font-bold ${
                  parseFloat(data.net_realized_pnl) >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {withSign(parseFloat(data.net_realized_pnl), (m) => `$${m.toFixed(2)}`)}
              </div>
              <span className="text-[11px] text-muted-foreground">Closed Gains</span>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <span className="text-xs text-muted-foreground block">Avg Win / Loss</span>
              <div className="text-sm font-semibold text-foreground">
                ${data.average_win_pnl} / -${data.average_loss_pnl}
              </div>
              <span className="text-[11px] text-muted-foreground">Dollar Payoff</span>
            </div>
          </div>

          {/* R-Multiple Distribution Chart */}
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              {t.rDistribution}
            </h3>

            <div className="grid grid-cols-7 gap-2 pt-4 items-end h-44 border-b border-border/30 pb-2">
              {Object.entries(data.r_distribution).map(([k, count]) => {
                const info = R_BUCKET_LABELS[k] || { label: k, isWin: true };
                const heightPct = Math.round((count / maxRCount) * 100);
                return (
                  <div key={k} className="flex flex-col items-center justify-end h-full gap-1">
                    <span className="text-[11px] font-bold text-foreground">
                      {count > 0 ? count : ""}
                    </span>
                    <div
                      style={{ height: `${Math.max(heightPct, 6)}%` }}
                      className={`w-full max-w-[42px] rounded-t transition-all ${
                        count === 0
                          ? "bg-muted/30"
                          : info.isWin
                            ? "bg-emerald-500/80 hover:bg-emerald-500"
                            : "bg-rose-500/80 hover:bg-rose-500"
                      }`}
                    />
                    <span className="text-[10px] text-muted-foreground text-center block whitespace-nowrap">
                      {info.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mistake Attribution Breakdown */}
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {t.mistakeAnalysis}
            </h3>

            {Object.keys(data.mistake_tag_counts).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No mistake tags recorded yet. Complete reviews in Trade Journal to analyze execution
                errors.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(data.mistake_tag_counts).map(([tag, count]) => (
                  <div
                    key={tag}
                    className="p-3 rounded-lg border border-border/40 bg-muted/20 space-y-1"
                  >
                    <span className="text-xs font-semibold uppercase text-rose-500 block">
                      {tag.replace("_", " ")}
                    </span>
                    <div className="text-lg font-bold text-foreground">{count} times</div>
                    <span className="text-[10px] text-muted-foreground">Attributed in review</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
