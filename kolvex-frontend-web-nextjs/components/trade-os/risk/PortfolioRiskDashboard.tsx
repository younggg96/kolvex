"use client";

import { useCopy } from "@/components/decision/shared";
import { PortfolioRiskSummary, RiskConfig, AccountRiskState } from "@/lib/tradeOsApi";
import { Card } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, PieChart, Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioRiskDashboardProps {
  summary: PortfolioRiskSummary | null;
  riskConfig?: RiskConfig | null;
  config?: RiskConfig | null;
  riskState: AccountRiskState | null;
  drawdownPct: number;
}

export function PortfolioRiskDashboard({
  summary,
  riskConfig,
  config,
  riskState,
  drawdownPct,
}: PortfolioRiskDashboardProps) {
  const c = useCopy();
  const effectiveConfig = riskConfig || config;

  const equity = summary ? parseFloat(summary.account_equity) : 0;
  const openRisk = summary ? parseFloat(summary.total_open_risk) : 0;
  const openRiskPct = summary ? parseFloat(summary.portfolio_risk_pct) : 0;
  const exposure = summary ? parseFloat(summary.total_exposure) : 0;
  const exposurePct = summary ? parseFloat(summary.portfolio_exposure_pct) : 0;

  const maxPortfolioRiskPct = (effectiveConfig?.max_portfolio_risk_pct || 0.02) * 100;
  const riskProgress = Math.min(100, (openRiskPct / maxPortfolioRiskPct) * 100);

  const isFrozen = riskState?.state === "new_entries_frozen" || drawdownPct >= 8.0;
  const isCaution = riskState?.state === "reduced_risk" || drawdownPct >= 6.0;

  return (
    <div className="space-y-6">
      {/* Risk Lock Banner (if caution or frozen) */}
      {isFrozen && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{c("NEW ENTRIES FROZEN", "新开仓风控冻结中")}</p>
              <p className="text-[0.6875rem] opacity-90">
                {riskState?.reason ||
                  c(
                    "Account drawdown reached threshold. New approvals frozen.",
                    "账户回撤达到阈值，新交易计划审批已冻结。",
                  )}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-destructive/20 px-2.5 py-0.5 text-[0.625rem] font-bold uppercase">
            {riskState?.state || "FROZEN"}
          </span>
        </div>
      )}

      {isCaution && !isFrozen && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {c(
              "Reduced Risk Mode active. Max single trade risk capped at 0.25%.",
              "已激活降杠杆谨慎模式。单笔新交易风险额度已限制为 0.25%。",
            )}
          </span>
        </div>
      )}

      {/* Top Risk KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Net Liquidation Value */}
        <Card className="p-4 sm:p-5">
          <span className="text-xs text-muted-foreground">{c("Net Equity", "账户净值")}</span>
          <div className="figure mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            ${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <span className="mt-1 block text-xs text-muted-foreground">
            {summary?.position_count || 0} {c("open positions", "个当前持仓")}
          </span>
        </Card>

        {/* Portfolio Open Risk */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{c("Open Risk", "有效止损风险")}</span>
            <span className="figure text-[0.6875rem] text-muted-foreground">
              max {maxPortfolioRiskPct.toFixed(1)}%
            </span>
          </div>
          <div className="figure mt-1.5 text-2xl font-semibold tracking-tight text-negative sm:text-3xl">
            ${openRisk.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                openRiskPct > maxPortfolioRiskPct * 0.8 ? "bg-negative" : "bg-primary",
              )}
              style={{ width: `${riskProgress}%` }}
            />
          </div>
          <span className="figure mt-1.5 block text-xs text-muted-foreground">
            {openRiskPct.toFixed(2)}% {c("of net equity", "占净值比例")}
          </span>
        </Card>

        {/* Total Notional Exposure */}
        <Card className="p-4 sm:p-5">
          <span className="text-xs text-muted-foreground">
            {c("Total Capital Exposure", "证券名义敞口")}
          </span>
          <div className="figure mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            ${exposure.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <span className="figure mt-1 block text-xs text-muted-foreground">
            {exposurePct.toFixed(1)}% {c("capital invested", "资金使用率")}
          </span>
        </Card>

        {/* Drawdown */}
        <Card className="p-4 sm:p-5">
          <span className="text-xs text-muted-foreground">
            {c("Adjusted Drawdown", "出入金调整回撤")}
          </span>
          <div
            className={cn(
              "figure mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl",
              drawdownPct >= 8.0
                ? "text-negative"
                : drawdownPct >= 6.0
                  ? "text-amber-500"
                  : "text-foreground",
            )}
          >
            {drawdownPct.toFixed(2)}%
          </div>
          <span className="mt-1 block text-xs text-muted-foreground">
            {drawdownPct >= 8.0
              ? c("Freeze active (>=8%)", "已触发冻结 (>=8%)")
              : c("Within limit (<6%)", "在控制范围内 (<6%)")}
          </span>
        </Card>
      </div>

      {/* Theme Exposure Breakdown */}
      {summary?.theme_exposure && Object.keys(summary.theme_exposure).length > 0 && (
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              {c("Theme & Sector Concentration", "投资主题与行业集中度")}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            {Object.entries(summary.theme_exposure).map(([theme, notionalStr]) => {
              const notional = parseFloat(notionalStr);
              const pct = equity > 0 ? (notional / equity) * 100 : 0;
              return (
                <div
                  key={theme}
                  className="rounded-2xl border border-foreground/5 bg-muted/20 p-3.5"
                >
                  <div className="flex items-center justify-between capitalize text-foreground font-semibold">
                    <span>{theme.replace(/_/g, " ")}</span>
                    <span className="figure">{pct.toFixed(1)}%</span>
                  </div>
                  <p className="figure text-muted-foreground mt-1">
                    ${notional.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <div className="w-full bg-muted rounded-full h-1 mt-2.5 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", pct > 20 ? "bg-negative" : "bg-primary")}
                      style={{ width: `${Math.min(100, (pct / 20) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
