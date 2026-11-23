"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useCopy } from "@/components/decision/shared";
import { fetchAccounts, fetchAnalytics, TradingAccount, AccountAnalytics } from "@/lib/tradeOsApi";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, Target, RefreshCw, AlertTriangle } from "lucide-react";
import { withSign } from "@/lib/format";
import { cn } from "@/lib/utils";

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
      {/* Account Toolbar */}
      {accounts.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              {c("Trading Account", "交易账户")}:
            </span>
            <Select
              value={selectedAccountId || ""}
              onValueChange={(val) => setSelectedAccountId(val)}
            >
              <SelectTrigger className="h-9 w-[220px] rounded-full text-xs font-medium">
                <SelectValue placeholder={c("Select account", "选择账户")} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs font-medium">
                    {a.account_name} ({a.broker})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          {c("Loading Analytics...", "正在计算交易统计数据...")}
        </div>
      ) : !data || data.total_closed_trades === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">{t.empty}</Card>
      ) : (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.planCoverage}</span>
              <div
                className={cn(
                  "figure text-xl font-semibold tracking-tight sm:text-2xl",
                  data.plan_coverage_pct >= 80 ? "text-positive" : "text-amber-500",
                )}
              >
                {data.plan_coverage_pct.toFixed(1)}%
              </div>
              <span className="figure text-[11px] text-muted-foreground">
                {data.outside_plan_count} Outside Plan
              </span>
            </Card>

            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.expectancy}</span>
              <div
                className={cn(
                  "figure text-xl font-semibold tracking-tight sm:text-2xl",
                  data.expectancy_r >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {withSign(data.expectancy_r, (m) => `${m.toFixed(2)}R`)}
              </div>
              <span className="text-[11px] text-muted-foreground">Avg Return / Risk</span>
            </Card>

            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.winRate}</span>
              <div className="figure text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {data.win_rate_pct.toFixed(1)}%
              </div>
              <span className="figure text-[11px] text-muted-foreground">
                Total: {data.total_closed_trades} trades
              </span>
            </Card>

            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.profitFactor}</span>
              <div className="figure text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {data.profit_factor.toFixed(2)}
              </div>
              <span className="text-[11px] text-muted-foreground">Gross Win / Loss</span>
            </Card>

            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.netPnl}</span>
              <div
                className={cn(
                  "figure text-xl font-semibold tracking-tight sm:text-2xl",
                  parseFloat(data.net_realized_pnl) >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {withSign(parseFloat(data.net_realized_pnl), (m) => `$${m.toFixed(2)}`)}
              </div>
              <span className="text-[11px] text-muted-foreground">Closed Gains</span>
            </Card>

            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">Avg Win / Loss</span>
              <div className="figure text-sm font-semibold text-foreground">
                ${data.average_win_pnl} / -${data.average_loss_pnl}
              </div>
              <span className="text-[11px] text-muted-foreground">Dollar Payoff</span>
            </Card>
          </div>

          {/* R-Multiple Distribution Chart */}
          <Card className="p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              {t.rDistribution}
            </h3>

            <div className="grid grid-cols-7 gap-2 pt-4 items-end h-44 border-b border-border/40 pb-2">
              {Object.entries(data.r_distribution).map(([k, count]) => {
                const info = R_BUCKET_LABELS[k] || { label: k, isWin: true };
                const heightPct = Math.round((count / maxRCount) * 100);
                return (
                  <div key={k} className="flex flex-col items-center justify-end h-full gap-1">
                    <span className="figure text-[11px] font-semibold text-foreground">
                      {count > 0 ? count : ""}
                    </span>
                    <div
                      style={{ height: `${Math.max(heightPct, 6)}%` }}
                      className={cn(
                        "w-full max-w-[42px] rounded-t-lg transition-all",
                        count === 0
                          ? "bg-muted/30"
                          : info.isWin
                            ? "bg-primary/80 hover:bg-primary"
                            : "bg-negative/80 hover:bg-negative",
                      )}
                    />
                    <span className="figure text-[10px] text-muted-foreground text-center block whitespace-nowrap">
                      {info.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Mistake Attribution Breakdown */}
          <Card className="p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {t.mistakeAnalysis}
            </h3>

            {Object.keys(data.mistake_tag_counts).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No mistake tags recorded yet. Complete reviews in Trade Journal to analyze execution
                errors.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                {Object.entries(data.mistake_tag_counts).map(([tag, count]) => (
                  <div
                    key={tag}
                    className="p-3.5 rounded-2xl border border-foreground/5 bg-muted/20 space-y-1"
                  >
                    <span className="text-xs font-semibold uppercase text-negative block">
                      {tag.replace("_", " ")}
                    </span>
                    <div className="figure text-lg font-semibold text-foreground">
                      {count} times
                    </div>
                    <span className="text-[10px] text-muted-foreground">Attributed in review</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
