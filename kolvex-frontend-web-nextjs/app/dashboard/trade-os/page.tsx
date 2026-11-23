"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCopy } from "@/components/decision/shared";
import { withSign } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListCard, ListEmptyState, ListRow, ListRows } from "@/components/ui/list-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TradingAccount, TradeGroup, fetchAccounts, fetchTradeGroups } from "@/lib/tradeOsApi";
import { Plus, UploadCloud, Search, ArrowRight, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

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
      {/* Account Toolbar & Quick Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {accounts.length > 0 ? (
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              {c("Trading Account", "交易账户")}:
            </span>
            <Select
              value={selectedAccountId || ""}
              onValueChange={async (id) => {
                setSelectedAccountId(id);
                const groups = await fetchTradeGroups(id);
                setTradeGroups(groups);
              }}
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
        ) : (
          <div />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-9 rounded-full px-3 text-xs gap-1.5"
          >
            <Link href="/dashboard/trade-os/settings">
              <UploadCloud className="h-3.5 w-3.5 text-primary" />
              {c("Import Trades", "导入流水")}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-9 rounded-full px-3 text-xs gap-1.5"
          >
            <Link href="/dashboard/trade-os/scanner">
              <Search className="h-3.5 w-3.5" />
              {c("Scan Setups", "扫描形态")}
            </Link>
          </Button>
          <Button size="sm" asChild className="h-9 rounded-full px-3.5 text-xs gap-1.5">
            <Link href="/dashboard/trade-os/plans">
              <Plus className="h-3.5 w-3.5" />
              {c("New Plan", "新建计划")}
            </Link>
          </Button>
        </div>
      </div>

      {/* No Account State */}
      {!loading && accounts.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {c("No Trading Account Configured", "尚未创建交易账户")}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            {c(
              "Set up a trading account to track capital, configure position sizing caps, and verify trade plans.",
              "创建账户并设置期初资金后，系统将自动试算开仓上限、校验风控规则并归集历史交易。",
            )}
          </p>
          <div className="mt-6">
            <Button size="sm" asChild className="rounded-full px-4">
              <Link href="/dashboard/trade-os/settings">
                {c("Set Up Account in Settings", "前往设置账户")}
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <Card className="p-4 sm:p-5">
              <span className="text-xs text-muted-foreground">
                {c("Initial Equity", "期初权益")}
              </span>
              <div className="figure mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {selectedAccount?.initial_equity != null
                  ? `$${Number(selectedAccount.initial_equity).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}`
                  : "—"}
              </div>
              <span className="mt-1 block text-xs text-muted-foreground">
                {selectedAccount?.broker || "manual"}
              </span>
            </Card>

            <Card className="p-4 sm:p-5">
              <span className="text-xs text-muted-foreground">
                {c("Realized P&L", "已实现净收益")}
              </span>
              <div
                className={cn(
                  "figure mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl",
                  totalRealizedPnl > 0
                    ? "text-positive"
                    : totalRealizedPnl < 0
                      ? "text-negative"
                      : "text-foreground",
                )}
              >
                {withSign(totalRealizedPnl, (m) => `$${m.toFixed(2)}`)}
              </div>
              <span className="mt-1 block text-xs text-muted-foreground">
                {closedTrades.length} {c("closed trades", "笔已平仓交易")}
              </span>
            </Card>

            <Card className="p-4 sm:p-5">
              <span className="text-xs text-muted-foreground">{c("Win Rate", "平仓胜率")}</span>
              <div className="figure mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {winRate != null ? `${winRate.toFixed(1)}%` : "—"}
              </div>
              <span className="mt-1 block text-xs text-muted-foreground">
                {winCount}W / {closedTrades.length - winCount}L
              </span>
            </Card>

            <Card className="p-4 sm:p-5">
              <span className="text-xs text-muted-foreground">
                {c("Round Trips", "往返交易数")}
              </span>
              <div className="figure mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {totalTrades}
              </div>
              <span className="mt-1 block text-xs text-muted-foreground">
                {c("FIFO Reconciled", "先进先出对账")}
              </span>
            </Card>
          </div>

          {/* Recent Trades List */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-semibold text-foreground">
                {c("Recent Round-Trip Trades", "最近往返交易")}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <Link href="/dashboard/trade-os/settings">
                  {c("View all & exceptions", "查看全部与异常")} →
                </Link>
              </Button>
            </div>

            <ListCard>
              {tradeGroups.length === 0 ? (
                <ListEmptyState
                  title={c("No trades reconciled yet", "暂无已归集的交易")}
                  description={c(
                    "Import historical executions in CSV format to track FIFO round trips and trade reviews.",
                    "在「设置与导入」中上传券商成交流水 CSV，系统将自动归集往返交易并生成复盘。",
                  )}
                  action={
                    <Button variant="outline" size="sm" asChild className="rounded-full">
                      <Link href="/dashboard/trade-os/settings">
                        {c("Import Trades", "导入流水")}
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <ListRows>
                  {tradeGroups.slice(0, 8).map((tg) => {
                    const pnl = Number(tg.realized_pnl);
                    const isPositive = pnl > 0;
                    const isNegative = pnl < 0;

                    return (
                      <ListRow
                        key={tg.id}
                        className="flex items-center justify-between py-3 px-3 sm:px-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-foreground text-sm tracking-tight">
                            {tg.symbol}
                          </span>
                          <span className="text-[0.6875rem] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {tg.status === "closed" ? c("Closed", "已平仓") : c("Open", "持仓中")}
                          </span>
                          <span className="figure text-xs text-muted-foreground">
                            {Number(tg.total_buy_quantity)} shs @ $
                            {Number(tg.average_entry_price).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className={cn(
                              "figure text-sm font-semibold",
                              isPositive
                                ? "text-positive"
                                : isNegative
                                  ? "text-negative"
                                  : "text-muted-foreground",
                            )}
                          >
                            {withSign(pnl, (m) => `$${m.toFixed(2)}`)}
                          </span>
                        </div>
                      </ListRow>
                    );
                  })}
                </ListRows>
              )}
            </ListCard>
          </section>
        </>
      )}

      {/* Quiet Footer Disclaimer */}
      <footer className="pt-6 pb-2 text-center text-xs text-muted-foreground">
        {c(
          "Kolvex Trade OS is an experimental personal risk system (PRD V1.0). Past performance and model rules do not guarantee future returns.",
          "Kolvex Trade OS 为实验性个人风控系统（PRD V1.0）。历史回测与规则试算不代表未来投资收益承诺。",
        )}
      </footer>
    </div>
  );
}
