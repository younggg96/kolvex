"use client";

import { useCopy } from "@/components/decision/shared";
import { PortfolioRiskSummary, RiskConfig, AccountRiskState } from "@/lib/tradeOsApi";
import { ShieldCheck, ShieldAlert, PieChart, Activity, AlertTriangle, Layers } from "lucide-react";

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
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">{c("NEW ENTRIES FROZEN", "新开仓风控冻结中")}</p>
              <p className="text-[0.6875rem] opacity-90">
                {riskState?.reason ||
                  c(
                    "Account drawdown reached threshold. New approvals frozen.",
                    "账户回撤达到阈值，新交易计划审批已冻结。",
                  )}
              </p>
            </div>
          </div>
          <span className="rounded bg-red-500/20 px-2 py-0.5 text-[0.625rem] font-bold uppercase">
            {riskState?.state || "FROZEN"}
          </span>
        </div>
      )}

      {isCaution && !isFrozen && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Net Liquidation Value */}
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[0.6875rem] font-medium text-muted-foreground">
            {c("Net Equity", "账户净值")}
          </span>
          <p className="text-lg font-mono font-bold text-foreground mt-1">
            ${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[0.625rem] text-muted-foreground">
            {summary?.position_count || 0} {c("open positions", "个当前持仓")}
          </span>
        </div>

        {/* Portfolio Open Risk */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[0.6875rem] font-medium text-muted-foreground">
              {c("Portfolio Open Risk", "组合有效止损风险")}
            </span>
            <span className="text-[0.625rem] font-mono text-muted-foreground">
              max {maxPortfolioRiskPct.toFixed(1)}%
            </span>
          </div>
          <p className="text-lg font-mono font-bold text-red-500 mt-1">
            ${openRisk.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                openRiskPct > maxPortfolioRiskPct * 0.8 ? "bg-red-500" : "bg-emerald-500"
              }`}
              style={{ width: `${riskProgress}%` }}
            />
          </div>
          <span className="text-[0.625rem] font-mono text-muted-foreground mt-1 block">
            {openRiskPct.toFixed(2)}% {c("of net equity", "占净值比例")}
          </span>
        </div>

        {/* Total Notional Exposure */}
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[0.6875rem] font-medium text-muted-foreground">
            {c("Total Capital Exposure", "证券名义敞口")}
          </span>
          <p className="text-lg font-mono font-bold text-foreground mt-1">
            ${exposure.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[0.625rem] font-mono text-muted-foreground">
            {exposurePct.toFixed(1)}% {c("capital invested", "资金使用率")}
          </span>
        </div>

        {/* Drawdown */}
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-[0.6875rem] font-medium text-muted-foreground">
            {c("Adjusted Drawdown", "出入金调整回撤")}
          </span>
          <p
            className={`text-lg font-mono font-bold mt-1 ${
              drawdownPct >= 8.0
                ? "text-red-500"
                : drawdownPct >= 6.0
                  ? "text-amber-500"
                  : "text-foreground"
            }`}
          >
            {drawdownPct.toFixed(2)}%
          </p>
          <span className="text-[0.625rem] text-muted-foreground">
            {drawdownPct >= 8.0
              ? c("Freeze active (>=8%)", "已触发冻结 (>=8%)")
              : c("Within limit (<6%)", "在控制范围内 (<6%)")}
          </span>
        </div>
      </div>

      {/* Theme Exposure Breakdown */}
      {summary?.theme_exposure && Object.keys(summary.theme_exposure).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <PieChart className="h-4 w-4 text-emerald-500" />
            {c("Theme & Sector Concentration", "投资主题与行业集中度")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {c(
              "Monitors correlated risk across semiconductors, AI infrastructure, and high-beta assets.",
              "监控科技、半导体与 AI 算力等高相关性资产的敞口集中度，单主题上限 20%。",
            )}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 font-mono text-xs">
            {Object.entries(summary.theme_exposure).map(([theme, notionalStr]) => {
              const notional = parseFloat(notionalStr);
              const pct = equity > 0 ? (notional / equity) * 100 : 0;
              return (
                <div key={theme} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between capitalize text-foreground font-semibold">
                    <span>{theme.replace(/_/g, " ")}</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    ${notional.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <div className="w-full bg-muted rounded-full h-1 mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct > 20 ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, (pct / 20) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
