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
import {
  TradingAccount,
  TradeGroup,
  TradePlan,
  MarketRegimeResponse,
  fetchAccounts,
  fetchTradeGroups,
  fetchPlans,
  fetchMarketRegime,
} from "@/lib/tradeOsApi";
import { Plus, UploadCloud, Search, Wallet, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TradeOsOverviewPage() {
  const c = useCopy();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [tradeGroups, setTradeGroups] = useState<TradeGroup[]>([]);
  const [plans, setPlans] = useState<TradePlan[]>([]);
  const [regime, setRegime] = useState<MarketRegimeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccountData = async (id: string) => {
    const [groups, planList] = await Promise.all([
      fetchTradeGroups(id),
      fetchPlans(id).catch(() => [] as TradePlan[]),
    ]);
    setTradeGroups(groups);
    setPlans(planList);
  };

  useEffect(() => {
    async function load() {
      try {
        const [accs, reg] = await Promise.all([
          fetchAccounts(),
          fetchMarketRegime().catch(() => null),
        ]);
        setAccounts(accs);
        setRegime(reg);
        if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
          await loadAccountData(accs[0].id);
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

  const approvedPlans = plans.filter((p) =>
    ["approved", "executed", "open", "closed"].includes(p.status),
  );
  const regimeLabel =
    regime?.regime === "risk_on"
      ? c("Risk-on: new entries allowed", "进攻：允许新开仓")
      : regime?.regime === "risk_off"
        ? c("Risk-off: no new entries", "防守：不建议新开仓")
        : regime?.regime === "neutral"
          ? c("Neutral: reduced risk", "中性：降低单笔风险")
          : c("No market reading yet", "尚无市场读数");

  const steps = [
    {
      key: "account",
      title: c("Create an account", "建立交易账户"),
      hint: c(
        "Set starting equity — all risk limits are % of it.",
        "填期初资金，所有风控上限都按它的百分比算。",
      ),
      done: accounts.length > 0,
      href: "/dashboard/trade-os/settings",
      cta: c("Create account", "去建账户"),
    },
    {
      key: "import",
      title: c("Import past fills", "导入历史成交"),
      hint: c(
        "Upload your broker CSV to rebuild round trips.",
        "上传券商 CSV，系统归集成往返交易。",
      ),
      done: tradeGroups.length > 0,
      href: "/dashboard/trade-os/settings",
      cta: c("Import CSV", "导入 CSV"),
    },
    {
      key: "market",
      title: c("Check the market", "看市场能不能开仓"),
      hint: regimeLabel,
      done: regime != null && regime.regime !== "stale_data",
      href: "/dashboard/trade-os/market",
      cta: c("Open market regime", "看市场状态"),
    },
    {
      key: "plan",
      title: c("Write a plan, get approval", "写计划并过风控"),
      hint: c(
        "Entry, stop, target → system sizes the position and approves or blocks.",
        "填入场、止损、目标，系统算仓位并给出通过或拒绝。",
      ),
      done: approvedPlans.length > 0,
      href: "/dashboard/trade-os/plans",
      cta: c("New plan", "新建计划"),
    },
    {
      key: "review",
      title: c("Review closed trades", "平仓后复盘"),
      hint: c("Tag mistakes, see if you followed your plan.", "标注失误，看是否按计划执行。"),
      done: closedTrades.length > 0,
      href: "/dashboard/trade-os/journal",
      cta: c("Open journal", "去复盘"),
    },
  ];
  const nextStep = steps.find((st) => !st.done);

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
                await loadAccountData(id);
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
          {/* How to use: five steps, first unfinished one highlighted */}
          <section aria-label={c("How to use Trade OS", "使用步骤")}>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {steps.map((st, i) => {
                const isNext = nextStep?.key === st.key;
                return (
                  <li key={st.key}>
                    <Card
                      className={cn(
                        "flex h-full flex-col gap-2 p-4",
                        isNext && "border-primary/50",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-[0.6875rem] font-semibold",
                            st.done
                              ? "bg-positive/15 text-positive"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {st.done ? (
                            <Check className="h-3 w-3" aria-label={c("Done", "已完成")} />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{st.title}</span>
                      </div>
                      <p className="flex-1 text-xs text-muted-foreground">{st.hint}</p>
                      <Link
                        href={st.href}
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          isNext ? "text-primary" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {st.cta}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Card>
                  </li>
                );
              })}
            </ol>
          </section>

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
