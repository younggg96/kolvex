"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCopy } from "@/components/decision/shared";
import { withSign } from "@/lib/format";
import { TradingAccount, TradeGroup, fetchAccounts, fetchTradeGroups } from "@/lib/tradeOsApi";
import {
  ShieldAlert,
  Wallet,
  TrendingUp,
  Layers,
  ArrowRight,
  PlusCircle,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function TradeOsOverviewPage() {
  const c = useCopy();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [tradeGroups, setTradeGroups] = useState<TradeGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const accs = await fetchAccounts();
        setAccounts(accs);
        if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
          const groups = await fetchTradeGroups(accs[0].id);
          setTradeGroups(groups);
        }
      } catch (err) {
        console.error("Failed to load Trade OS overview", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Calculate simple summary stats
  const totalTrades = tradeGroups.length;
  const closedTrades = tradeGroups.filter((g) => g.status === "closed");
  const totalRealizedPnl = tradeGroups.reduce((acc, g) => acc + Number(g.realized_pnl || 0), 0);
  const winCount = closedTrades.filter((g) => Number(g.realized_pnl) > 0).length;
  const winRate = closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {c("Trade OS Workspace", "Trade OS 交易决策工作台")}
            </h1>
            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[0.625rem] font-semibold text-amber-500 uppercase tracking-wider">
              {c("Experimental · Beta", "实验性功能 · Beta")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c(
              "Every trade has a reason. Every risk has a limit. Every result improves the system.",
              "每笔交易皆有依据，每笔风险皆有上限，每次结果皆能精进体系。",
            )}
          </p>
        </div>

        {accounts.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedAccountId || ""}
              onChange={async (e) => {
                const id = e.target.value;
                setSelectedAccountId(id);
                const groups = await fetchTradeGroups(id);
                setTradeGroups(groups);
              }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_name} ({a.broker})
                </option>
              ))}
            </select>

            <Link
              href="/dashboard/trade-os/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <UploadCloud className="h-3.5 w-3.5 text-emerald-500" />
              {c("Import CSV", "导入流水")}
            </Link>
          </div>
        )}
      </div>

      {/* Experimental Feature Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
        <div className="space-y-0.5">
          <span className="font-semibold block">
            {c("Experimental Feature Notice", "实验性功能声明")}
          </span>
          <p className="text-muted-foreground leading-relaxed">
            {c(
              "Kolvex Trade OS is an experimental personal risk management preview (PRD V1.0). It does not execute live broker orders, nor does it guarantee trading profits. All rules, scanners, and backtest results are for trading discipline and decision verification.",
              "Kolvex Trade OS 当前处于实验性功能预览阶段（PRD V1.0）。系统不会代表券商自动下单，亦不对交易收益作任何承诺。所有风控预算、机会扫描与回测结果均用于辅助交易纪律与策略验证。",
            )}
          </p>
        </div>
      </div>

      {/* No Account State */}
      {!loading && accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Wallet className="h-10 w-10 text-emerald-500 mx-auto mb-3 opacity-80" />
          <h2 className="text-base font-semibold text-foreground">
            {c("Welcome to Kolvex Trade OS", "欢迎使用 Kolvex Trade OS")}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-6">
            {c(
              "To start calculating trade risk, enforcing limits, and reviewing performance, set up your primary trading account or import historical Robinhood activity.",
              "开始评估交易风险、执行风控预算与统计绩效前，请先创建首个交易账户或导入 Robinhood 历史交易流水。",
            )}
          </p>
          <Link
            href="/dashboard/trade-os/settings"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <PlusCircle className="h-4 w-4" />
            {c("Set Up Account in Settings", "前往设置账户")}
          </Link>
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-[0.6875rem] font-medium text-muted-foreground">
                {c("Initial Equity", "期初权益")}
              </span>
              <p className="text-lg font-mono font-bold text-foreground mt-1">
                {selectedAccount?.initial_equity != null
                  ? `$${Number(selectedAccount.initial_equity).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}`
                  : "—"}
              </p>
              <span className="text-[0.625rem] text-muted-foreground">
                {selectedAccount?.broker || "manual"}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-[0.6875rem] font-medium text-muted-foreground">
                {c("Realized P&L", "已实现净收益")}
              </span>
              <p
                className={`text-lg font-mono font-bold mt-1 ${
                  totalRealizedPnl > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : totalRealizedPnl < 0
                      ? "text-red-500 dark:text-red-400"
                      : "text-foreground"
                }`}
              >
                {withSign(totalRealizedPnl, (m) => `$${m.toFixed(2)}`)}
              </p>
              <span className="text-[0.625rem] text-muted-foreground">
                {closedTrades.length} {c("closed trades", "笔已闭合交易")}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-[0.6875rem] font-medium text-muted-foreground">
                {c("Win Rate", "平仓胜率")}
              </span>
              <p className="text-lg font-mono font-bold text-foreground mt-1">
                {winRate != null ? `${winRate.toFixed(1)}%` : "—"}
              </p>
              <span className="text-[0.625rem] text-muted-foreground">
                {winCount}W / {closedTrades.length - winCount}L
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-[0.6875rem] font-medium text-muted-foreground">
                {c("Total Round Trips", "归集交易数")}
              </span>
              <p className="text-lg font-mono font-bold text-foreground mt-1">{totalTrades}</p>
              <span className="text-[0.625rem] text-muted-foreground">
                {c("FIFO Aggregated", "先进先出对账")}
              </span>
            </div>
          </div>

          {/* Trade OS Active Systems Notice */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {c("Trade OS Decision & Risk Engines Active", "Trade OS 决策与风控引擎已就绪")}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {c(
                    "All core modules active: Pre-Trade Risk Gate, Opportunity Scanner, Market Regime Confirmation, and Trade Journal Review.",
                    "核心体系已全面就绪：盘前开仓风控审批、机会扫描器、大盘均线环境确认与交易复盘归集。",
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href="/dashboard/trade-os/plans"
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition"
                >
                  <span>{c("Create Trade Plan", "制定计划")}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/dashboard/trade-os/scanner"
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition"
                >
                  <span>{c("Scan Setups", "机会扫描")}</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Trades List */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                {c("Recent Round-Trip Trades", "最近往返交易")}
              </h3>
              <Link
                href="/dashboard/trade-os/settings"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {c("View All & Exceptions", "查看全部与异常")} →
              </Link>
            </div>

            <div className="pt-3">
              {tradeGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {c("No trades reconciled yet.", "暂无已归集的交易。")}
                </p>
              ) : (
                <div className="divide-y divide-border/60">
                  {tradeGroups.slice(0, 8).map((tg) => {
                    const pnl = Number(tg.realized_pnl);
                    const isPositive = pnl > 0;
                    const isNegative = pnl < 0;

                    return (
                      <div
                        key={tg.id}
                        className="py-2.5 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-foreground text-sm">{tg.symbol}</span>
                          <span className="text-[0.625rem] font-sans px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {tg.status === "closed" ? c("Closed", "已平仓") : c("Open", "持仓")}
                          </span>
                          <span className="text-muted-foreground">
                            {Number(tg.total_buy_quantity)} shs @ $
                            {Number(tg.average_entry_price).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-semibold ${
                              isPositive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : isNegative
                                  ? "text-red-500 dark:text-red-400"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {withSign(pnl, (m) => `$${m.toFixed(2)}`)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
