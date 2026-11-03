"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import {
  Empty,
  Panel,
  WorkspaceLink,
  money,
  signedMoney,
  useCopy,
} from "@/components/decision/shared";
import { cn } from "@/lib/utils";
import {
  paperRequest,
  sendCommand,
  PaperApiError,
  type Account,
  type Command,
  type Position,
} from "@/lib/paperTrading";
import OrderTicket from "./OrderTicket";
import TradingReviews from "./TradingReviews";

const errorMessages: Record<string, [string, string]> = {
  paper_backend_outdated: [
    "The backend has not loaded paper trading yet. Restart or update the backend, then retry.",
    "后端尚未加载虚拟交易接口，请重启或更新后端后重试。",
  ],
  invalid_order: [
    "Order validation failed. Check the values and try again.",
    "订单校验未通过，请检查填写的数值后重试。",
  ],
  unauthorized: [
    "Sign in again to access your virtual account.",
    "登录已过期，请重新登录后访问虚拟账户。",
  ],
  paper_storage_unavailable: [
    "Virtual account storage is unavailable. Apply the paper trading migration and check backend configuration.",
    "虚拟账户存储暂不可用，请检查后端配置并应用虚拟交易数据库迁移。",
  ],
  insufficient_funds: [
    "Insufficient available funds, including collateral, fees and slippage.",
    "可用资金不足以覆盖本金、抵押、费用与滑点。",
  ],
  market_closed_or_stale: [
    "Market is closed or the quote is stale. Refresh during regular hours, or place a pending order.",
    "当前休市或报价过期。请在常规交易时段刷新，或使用挂单。",
  ],
  quote_unavailable: [
    "Quote unavailable. Check the symbol and refresh.",
    "暂时无法获取行情，请检查股票代码并刷新。",
  ],
  quote_time_unavailable: [
    "Quote timestamp is missing. This symbol cannot be traded until a timestamp is available.",
    "行情缺少时间戳，暂时不能交易此股票。",
  ],
  unsupported_security: [
    "Only USD stocks and ETFs are supported.",
    "目前仅支持美元股票和 ETF。",
  ],
  account_conflict: [
    "Your account changed in another session. Retry the same action.",
    "账户已被其他会话更新，请重试同一操作。",
  ],
  quantity_reserved: [
    "Shares are reserved by pending close orders. Cancel those orders first.",
    "股数已被平仓挂单冻结，请先撤销相关挂单。",
  ],
  position_unavailable: [
    "Position is no longer available. Refresh the account.",
    "该持仓已发生变化或已关闭，请刷新账户。",
  ],
  position_still_open: [
    "Fully close the position before publishing its review.",
    "请完全平仓后再发布复盘。",
  ],
  order_not_pending: [
    "Order has already filled or been cancelled. Refresh the account.",
    "订单已经成交或撤销，请刷新账户。",
  ],
  invalid_stop_loss: [
    "Stop loss is on the wrong side of the reference price.",
    "止损价必须位于参考价格的亏损方向。",
  ],
  invalid_take_profit: [
    "Take profit is on the wrong side of the reference price.",
    "止盈价必须位于参考价格的盈利方向。",
  ],
  bracket_crossed: [
    "Price has moved beyond your bracket. Review stop loss and take profit.",
    "价格已越过止损或止盈价，请重新检查计划。",
  ],
  account_capacity: [
    "This account has reached the simulation capacity. Existing positions can still be closed.",
    "账户已达到模拟容量上限，请先管理现有持仓。",
  ],
  invalid_number: ["Enter valid positive prices.", "请输入有效的正数价格。"],
};

export default function PaperTradingWorkspace() {
  const c = useCopy();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const alive = useRef(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [autoSyncFailed, setAutoSyncFailed] = useState(false);
  const [closePosition, setClosePosition] = useState<Position | null>(null);
  const [bracket, setBracket] = useState<Position | null>(null);
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [bracketError, setBracketError] = useState("");
  const [limit, setLimit] = useState(40);
  const [orderLimit, setOrderLimit] = useState(40);
  const [tab, setTab] = useState("trade");
  const ticketRef = useRef<HTMLElement>(null);
  const accept = useCallback(
    (next: Account) =>
      setAccount((current) =>
        !current || next.version >= current.version ? next : current,
      ),
    [],
  );
  const errorText = (value: unknown, context: "read" | "order" = "read") => {
    const code = value instanceof PaperApiError ? value.code : "";
    const text = errorMessages[code];
    return text
      ? c(...text)
      : context === "order"
        ? c(
            "Request failed. Check your connection and retry the same action. An order may already have been accepted.",
            "请求失败。请检查网络并重试同一操作，订单可能已经被接收。",
          )
        : c(
            "Could not load data. Check your connection and try again.",
            "暂时无法加载数据，请检查网络后重试。",
          );
  };
  async function load() {
    setLoading(true);
    setError("");
    try {
      accept(await paperRequest<Account>("account"));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  async function execute(command: Command): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await sendCommand(command);
      if (alive.current) {
        accept(result);
        setAutoSyncFailed(false);
        setMessage(
          command.action === "sync"
            ? c(
                "Account synced with available quotes.",
                "已按可用报价同步账户。",
              )
            : c("Virtual account updated.", "虚拟账户已更新。"),
        );
      }
      return true;
    } catch (e) {
      if (alive.current)
        setError(errorText(e, command.action === "order" ? "order" : "read"));
      return false;
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    paperRequest<Account>("account", { signal: controller.signal })
      .then(accept)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorText(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accept]);
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden || locked.current || !account) return;
      locked.current = true;
      try {
        const result = await sendCommand({
          action: "sync",
          request_id: crypto.randomUUID(),
        });
        if (alive.current) {
          accept(result);
          setAutoSyncFailed(false);
        }
      } catch {
        if (alive.current) setAutoSyncFailed(true);
      } finally {
        locked.current = false;
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [!!account, accept]); // eslint-disable-line react-hooks/exhaustive-deps

  const sideLabel = (side: string) =>
    side === "long" ? c("Long", "多单") : c("Short", "空单");
  const s = account?.summary;
  const fills = account ? [...account.state.fills].reverse() : [];
  const orders = account ? [...account.state.orders].reverse() : [];
  const th =
    "whitespace-nowrap px-3 py-3 text-left text-xs font-medium text-muted-foreground";
  const td = "whitespace-nowrap px-3 py-4 text-sm tabular-nums";

  return (
    <DashboardLayout title={c("Paper trading", "虚拟交易")}>
      <main className="flex-1 overflow-y-auto" aria-busy={loading}>
        <div className="mx-auto max-w-screen-2xl space-y-8 px-[16px] pb-16 pt-6 md:px-8 md:pt-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {c("Learn by trading", "在交易中学习")}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                {c("Your virtual trading desk", "你的虚拟交易工作台")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {c(
                  "Turn a research idea into a trade, track what happens, and review the decision. Start with $100,000 in virtual funds.",
                  "把分析变成交易计划，记录盈亏，也复盘每次判断。从 10 万美元虚拟资金开始。",
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {account && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTab("trade");
                    requestAnimationFrame(() => {
                      ticketRef.current?.scrollIntoView({
                        block: "start",
                        behavior: "auto",
                      });
                      ticketRef.current
                        ?.querySelector<HTMLInputElement>("input")
                        ?.focus({ preventScroll: true });
                    });
                  }}
                >
                  {c("New virtual order", "新建虚拟订单")}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={loading || busy}
                onClick={() =>
                  account
                    ? void execute({
                        action: "sync",
                        request_id: crypto.randomUUID(),
                      })
                    : void load()
                }
              >
                <RefreshCw aria-hidden className="size-4" />
                {c("Sync account", "同步账户")}
              </Button>
            </div>
          </header>
          <p className="text-xs leading-5 text-muted-foreground">
            {c(
              "Simulation only · USD stocks and ETFs · No leverage · Quotes may be delayed. Matches use observed regular-session prices, without replaying missed price moves.",
              "仅模拟交易 · 美元股票与 ETF · 无杠杆 · 行情可能延迟。按常规时段实际观察报价撮合，不补算遗漏的价格路径。",
            )}
          </p>
          <div aria-live="polite" className="min-h-6 text-sm">
            <p role="alert" className="text-negative">
              {error}
            </p>
            {message && <p>{message}</p>}
          </div>
          {loading && !account ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 rounded-3xl" />
              ))}
            </div>
          ) : !account ? (
            <ListCard>
              <ListEmptyState
                alert
                title={c("Virtual account could not load", "无法加载虚拟账户")}
                description={error}
                action={
                  <Button variant="outline" onClick={load}>
                    {c("Retry", "重试")}
                  </Button>
                }
              />
            </ListCard>
          ) : (
            <>
              {(autoSyncFailed || !!account.state.quote_errors?.length) && (
                <p role="status" className="text-sm text-negative">
                  {autoSyncFailed
                    ? c(
                        "Automatic sync failed. Data may be stale; use Sync account to retry.",
                        "自动同步未成功，数据可能过期，请点击同步账户重试。",
                      )
                    : `${c("Quotes unavailable; keeping previous marks for", "行情暂不可用，以下股票保留上次估值")} ${account.state.quote_errors?.join(", ")}`}
                </p>
              )}
              <section
                aria-label={c("Account overview", "账户概览")}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                {[
                  [
                    c("Account equity", "账户净值"),
                    money(Number(s!.equity)),
                    `${Number(s!.return_pct) >= 0 ? "+" : ""}${Number(s!.return_pct).toFixed(2)}%`,
                    Number(s!.total_pnl),
                  ],
                  [
                    c("Available funds", "可用资金"),
                    money(Number(s!.available)),
                    `${c("Reserved", "已冻结")} ${money(Number(s!.reserved))}`,
                    null,
                  ],
                  [
                    c(
                      "Unrealized P&L · before fees",
                      "持仓浮动盈亏 · 未计费用",
                    ),
                    signedMoney(Number(s!.unrealized_pnl)),
                    `${account.state.positions.length} ${c("open positions", "笔持仓")}`,
                    Number(s!.unrealized_pnl),
                  ],
                  [
                    c("Realized P&L · after fees", "已实现盈亏 · 扣除费用"),
                    signedMoney(Number(s!.realized_pnl)),
                    `${s!.closed_count} ${c("closed lots", "笔完整平仓")} · ${c("Win rate", "胜率")} ${s!.win_rate === null ? "—" : `${Number(s!.win_rate).toFixed(1)}%`}`,
                    Number(s!.realized_pnl),
                  ],
                ].map(([label, value, detail, tone]) => (
                  <Card key={String(label)} className="p-4 sm:p-6">
                    <h2 className="text-xs text-muted-foreground">{label}</h2>
                    <p
                      className={cn(
                        "mt-3 text-2xl font-semibold tracking-tight tabular-nums",
                        typeof tone === "number" &&
                          (tone > 0
                            ? "text-positive"
                            : tone < 0
                              ? "text-negative"
                              : ""),
                      )}
                    >
                      {value}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {detail}
                    </p>
                  </Card>
                ))}
              </section>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="mb-6">
                  <TabsTrigger value="trade">
                    {c("Trading desk", "交易工作台")}
                  </TabsTrigger>
                  <TabsTrigger value="reviews">
                    {c("Learning reviews", "学习复盘")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="trade" className="space-y-8">
                  <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
                    <div className="min-w-0 space-y-8">
                      <Panel
                        title={c("Equity over time", "净值变化")}
                        surface="card"
                      >
                        <EquityChart snapshots={account.state.snapshots} />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {c(
                            "Samples on account sync, including stale marks when a new quote is unavailable. Open entry fees are reflected in equity; realized P&L includes their allocated cost on close.",
                            "按账户同步采样；没有新报价时沿用上次估值。开仓费用立即反映在净值中，平仓时分摊计入已实现盈亏。",
                          )}
                        </p>
                      </Panel>
                      <section>
                        <h2 className="mb-3 text-xl font-semibold">
                          {c("Open positions", "当前持仓")}{" "}
                          <span className="text-sm text-muted-foreground">
                            {account.state.positions.length}
                          </span>
                        </h2>
                        <ListCard>
                          {!account.state.positions.length ? (
                            <Empty>
                              {c(
                                "No positions yet. Place a virtual order or import an AI setup from a stock chart.",
                                "还没有持仓。可以提交虚拟订单，或从股票图表导入 AI 计划。",
                              )}
                            </Empty>
                          ) : (
                            <div
                              className="overflow-x-auto"
                              role="region"
                              tabIndex={0}
                              aria-label={c("Positions table", "持仓表格")}
                            >
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-border">
                                    {[
                                      c("Stock / side", "股票 / 方向"),
                                      c("Shares / entry", "股数 / 成本"),
                                      c("Mark / quote time", "估值 / 报价时间"),
                                      c(
                                        "P&L · before fees",
                                        "浮盈亏 · 未计费用",
                                      ),
                                      c("Stop / target", "止损 / 止盈"),
                                      c("Actions", "操作"),
                                    ].map((label) => (
                                      <th
                                        scope="col"
                                        key={label}
                                        className={th}
                                      >
                                        {label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {account.state.positions.map((p) => {
                                    const mark = account.state.marks[p.symbol];
                                    const pnl =
                                      (Number(mark?.price || p.entry_price) -
                                        Number(p.entry_price)) *
                                      p.quantity *
                                      (p.side === "long" ? 1 : -1);
                                    return (
                                      <tr
                                        key={p.id}
                                        className="hover:bg-muted/60"
                                      >
                                        <td className={td}>
                                          <WorkspaceLink
                                            ticker={p.symbol}
                                            showLogo={false}
                                          />
                                          <p
                                            className={cn(
                                              "mt-1 text-xs",
                                              p.side === "long"
                                                ? "text-positive"
                                                : "text-negative",
                                            )}
                                          >
                                            {sideLabel(p.side)}
                                          </p>
                                        </td>
                                        <td className={td}>
                                          {p.quantity}
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {money(Number(p.entry_price))}
                                          </p>
                                        </td>
                                        <td className={td}>
                                          {money(
                                            Number(
                                              mark?.price || p.entry_price,
                                            ),
                                          )}
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {mark
                                              ? new Date(
                                                  mark.at,
                                                ).toLocaleString(
                                                  c("en-US", "zh-CN"),
                                                )
                                              : "—"}
                                          </p>
                                        </td>
                                        <td
                                          className={cn(
                                            td,
                                            pnl >= 0
                                              ? "text-positive"
                                              : "text-negative",
                                          )}
                                        >
                                          {signedMoney(pnl)}
                                        </td>
                                        <td className={td}>
                                          {p.stop_loss
                                            ? money(Number(p.stop_loss))
                                            : "—"}
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {p.take_profit
                                              ? money(Number(p.take_profit))
                                              : "—"}
                                          </p>
                                        </td>
                                        <td className={td}>
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              disabled={busy}
                                              onClick={() => {
                                                setClosePosition(p);
                                                ticketRef.current?.scrollIntoView(
                                                  {
                                                    block: "start",
                                                    behavior: "auto",
                                                  },
                                                );
                                              }}
                                            >
                                              {c("Close", "平仓")}
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              disabled={busy}
                                              onClick={() => {
                                                setBracket(p);
                                                setStop(p.stop_loss || "");
                                                setTarget(p.take_profit || "");
                                                setBracketError("");
                                              }}
                                            >
                                              {c("Edit exits", "修改止损止盈")}
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </ListCard>
                      </section>
                      <section>
                        <h2 className="mb-3 text-xl font-semibold">
                          {c("Orders", "委托订单")}{" "}
                          <span className="text-sm text-muted-foreground">
                            {
                              account.state.orders.filter(
                                (o) => o.status === "pending",
                              ).length
                            }{" "}
                            {c("pending", "笔待成交")}
                          </span>
                        </h2>
                        <ListCard>
                          {!orders.length ? (
                            <Empty>
                              {c(
                                "Your orders will appear here, including cancellations and rejections.",
                                "委托、撤单与拒单记录会显示在这里。",
                              )}
                            </Empty>
                          ) : (
                            <>
                              <div
                                className="overflow-x-auto"
                                role="region"
                                tabIndex={0}
                                aria-label={c("Orders table", "委托表格")}
                              >
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b border-border">
                                      {[
                                        c("Stock", "股票"),
                                        c("Order", "委托"),
                                        c("Price / shares", "价格 / 股数"),
                                        c("Status", "状态"),
                                        c("Actions", "操作"),
                                      ].map((label) => (
                                        <th
                                          scope="col"
                                          key={label}
                                          className={th}
                                        >
                                          {label}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {orders.slice(0, orderLimit).map((o) => (
                                      <tr
                                        key={o.id}
                                        className="hover:bg-muted/60"
                                      >
                                        <td className={td}>
                                          {o.symbol}
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {new Date(
                                              o.created_at,
                                            ).toLocaleString(
                                              c("en-US", "zh-CN"),
                                            )}
                                          </p>
                                        </td>
                                        <td className={td}>
                                          {o.effect === "close"
                                            ? c("Close", "平仓")
                                            : c("Open", "开仓")}{" "}
                                          · {sideLabel(o.side)}
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {o.kind === "market"
                                              ? c("Market", "市价")
                                              : o.kind === "limit"
                                                ? c("Limit", "限价")
                                                : c("Stop", "突破")}
                                          </p>
                                        </td>
                                        <td className={td}>
                                          {o.fill_price || o.price
                                            ? money(
                                                Number(o.fill_price || o.price),
                                              )
                                            : "—"}{" "}
                                          / {o.quantity}
                                        </td>
                                        <td className={td}>
                                          {
                                            {
                                              pending: c("Pending", "待成交"),
                                              filled: c("Filled", "已成交"),
                                              cancelled: c(
                                                "Cancelled",
                                                "已撤销",
                                              ),
                                              rejected: c("Rejected", "已拒绝"),
                                            }[o.status]
                                          }
                                          {o.rejection && (
                                            <p className="mt-1 max-w-48 whitespace-normal text-xs text-negative">
                                              {errorText(
                                                new PaperApiError(
                                                  o.rejection,
                                                  422,
                                                ),
                                              )}
                                            </p>
                                          )}
                                        </td>
                                        <td className={td}>
                                          {o.status === "pending" && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              disabled={busy}
                                              onClick={() =>
                                                void execute({
                                                  action: "cancel",
                                                  request_id:
                                                    crypto.randomUUID(),
                                                  order_id: o.id,
                                                })
                                              }
                                            >
                                              {c("Cancel order", "撤单")}
                                            </Button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {orders.length > orderLimit && (
                                <Button
                                  variant="ghost"
                                  className="mt-3 w-full"
                                  onClick={() => setOrderLimit((v) => v + 40)}
                                >
                                  {c("Load more orders", "加载更多订单")}
                                </Button>
                              )}
                            </>
                          )}
                        </ListCard>
                      </section>
                    </div>
                    <section ref={ticketRef} className="min-w-0 scroll-mt-4">
                      <h2 className="mb-3 text-xl font-semibold">
                        {c("Virtual order", "虚拟下单")}
                      </h2>
                      <Card className="p-4 sm:p-6">
                        <OrderTicket
                          account={account}
                          closePosition={
                            (closePosition &&
                              account.state.positions.find(
                                (p) => p.id === closePosition.id,
                              )) ||
                            null
                          }
                          clearClose={() => setClosePosition(null)}
                          execute={execute}
                          busy={busy}
                          errorText={errorText}
                          mutationError={error}
                        />
                      </Card>
                    </section>
                  </div>
                  <section>
                    <h2 className="mb-3 text-xl font-semibold">
                      {c("Execution ledger", "成交账本")}
                    </h2>
                    <ListCard>
                      {!fills.length ? (
                        <Empty>
                          {c(
                            "No executions yet. Filled orders will show fees, quote times and realized P&L here.",
                            "还没有成交。成交后可查看费用、报价时间和已实现盈亏。",
                          )}
                        </Empty>
                      ) : (
                        <>
                          <div
                            className="overflow-x-auto"
                            role="region"
                            tabIndex={0}
                            aria-label={c("Executions table", "成交明细表格")}
                          >
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-border">
                                  {[
                                    c("Time / stock", "时间 / 股票"),
                                    c("Trade", "交易"),
                                    c("Fill / shares", "成交价 / 股数"),
                                    c("Fee", "费用"),
                                    c("Net realized P&L", "已实现净盈亏"),
                                    c("Reason", "成交原因"),
                                  ].map((label) => (
                                    <th key={label} scope="col" className={th}>
                                      {label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {fills.slice(0, limit).map((f) => (
                                  <tr key={f.id} className="hover:bg-muted/60">
                                    <td className={td}>
                                      {f.symbol}
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {new Date(f.at).toLocaleString(
                                          c("en-US", "zh-CN"),
                                        )}
                                      </p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {c("Quote", "报价")}{" "}
                                        {new Date(f.quote_at).toLocaleString(
                                          c("en-US", "zh-CN"),
                                        )}
                                      </p>
                                    </td>
                                    <td className={td}>
                                      {f.effect === "open"
                                        ? c("Open", "开仓")
                                        : c("Close", "平仓")}{" "}
                                      · {sideLabel(f.side)}
                                    </td>
                                    <td className={td}>
                                      {money(Number(f.price))} / {f.quantity}
                                    </td>
                                    <td className={td}>
                                      {money(Number(f.fee))}
                                    </td>
                                    <td
                                      className={cn(
                                        td,
                                        f.effect === "close" &&
                                          (Number(f.realized_pnl) >= 0
                                            ? "text-positive"
                                            : "text-negative"),
                                      )}
                                    >
                                      {f.effect === "close"
                                        ? signedMoney(Number(f.realized_pnl))
                                        : "—"}
                                    </td>
                                    <td className={td}>
                                      {(
                                        {
                                          order: c("User order", "用户委托"),
                                          stop_loss: c("Stop loss", "止损"),
                                          take_profit: c("Take profit", "止盈"),
                                          margin: c(
                                            "Collateral exhausted",
                                            "抵押耗尽强平",
                                          ),
                                        } as Record<string, string>
                                      )[f.reason] || f.reason}
                                      {f.note && (
                                        <details className="mt-2 max-w-64 whitespace-normal text-xs">
                                          <summary className="cursor-pointer text-muted-foreground">
                                            {c("Trade thesis", "交易理由")}
                                          </summary>
                                          <p className="mt-2 whitespace-pre-wrap leading-5">
                                            {f.note}
                                          </p>
                                        </details>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {fills.length > limit && (
                            <Button
                              variant="ghost"
                              className="mt-3 w-full"
                              onClick={() => setLimit((v) => v + 40)}
                            >
                              {c("Load more executions", "加载更多成交")}
                            </Button>
                          )}
                        </>
                      )}
                    </ListCard>
                  </section>
                </TabsContent>
                <TabsContent value="reviews">
                  <TradingReviews account={account} errorText={errorText} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
      <Dialog
        open={!!bracket}
        onOpenChange={(open) => {
          if (!busy && !open) setBracket(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {c("Edit exits", "修改止损止盈")} · {bracket?.symbol}
            </DialogTitle>
            <DialogDescription>
              {c(
                "Applies to the remaining lot. Clear a field to remove that exit. Valid prices must be on the correct side of the latest mark.",
                "应用于该笔剩余持仓。清空字段可移除对应条件，价格须位于最新估值的正确方向。",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-stop">{c("Stop loss", "止损价")}</Label>
              <Input
                id="edit-stop"
                type="number"
                step="any"
                value={stop}
                onChange={(e) => setStop(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-target">{c("Take profit", "止盈价")}</Label>
              <Input
                id="edit-target"
                type="number"
                step="any"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
          </div>
          <p role="alert" className="min-h-5 text-sm text-negative">
            {bracketError}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setBracket(null)}
            >
              {c("Cancel", "取消")}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!bracket) return;
                if (
                  [stop, target].some(
                    (v) => v && (!Number.isFinite(Number(v)) || Number(v) <= 0),
                  )
                ) {
                  setBracketError(
                    c(
                      "Enter positive prices, or leave fields empty.",
                      "请输入正数价格，或留空。",
                    ),
                  );
                  return;
                }
                if (
                  await execute({
                    action: "bracket",
                    request_id: crypto.randomUUID(),
                    position_id: bracket.id,
                    stop_loss: stop ? Number(stop) : null,
                    take_profit: target ? Number(target) : null,
                  })
                )
                  setBracket(null);
                else
                  setBracketError(
                    c(
                      "Could not update exits. Check the account error and retry.",
                      "未能更新，请查看账户错误提示后重试。",
                    ),
                  );
              }}
            >
              {c("Save exits", "保存止损止盈")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function EquityChart({
  snapshots,
}: {
  snapshots: { at: string; equity: string }[];
}) {
  const c = useCopy();
  if (snapshots.length < 2)
    return (
      <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
        {c(
          "Your equity curve begins with your first sync and trade.",
          "首次同步或交易后开始记录净值曲线。",
        )}
      </div>
    );
  const values = snapshots.map((s) => Number(s.equity));
  const low = Math.min(...values),
    high = Math.max(...values),
    range = high - low || Math.max(high * 0.001, 1);
  const times = snapshots.map((s) => new Date(s.at).getTime());
  const span = times[times.length - 1] - times[0] || 1;
  const points = values
    .map(
      (value, i) =>
        `${16 + ((times[i] - times[0]) / span) * 768},${168 - ((value - low) / range) * 144}`,
    )
    .join(" ");
  return (
    <figure>
      <div className="mb-2 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{money(low)}</span>
        <span>{money(high)}</span>
      </div>
      <svg
        viewBox="0 0 800 192"
        role="img"
        aria-label={`${c("Equity from", "净值从")} ${money(values[0])} ${c("to", "到")} ${money(values[values.length - 1])}`}
        className="h-48 w-full text-foreground"
        preserveAspectRatio="none"
      >
        <line
          x1="16"
          x2="784"
          y1="176"
          y2="176"
          stroke="currentColor"
          opacity=".15"
        />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="flex justify-between text-xs text-muted-foreground">
        <span>
          {new Date(snapshots[0].at).toLocaleString(c("en-US", "zh-CN"))}
        </span>
        <span>
          {new Date(snapshots[snapshots.length - 1].at).toLocaleString(
            c("en-US", "zh-CN"),
          )}
        </span>
      </figcaption>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer">
          {c("Recent equity samples", "最近净值采样")}
        </summary>
        <ol className="mt-2 space-y-1">
          {snapshots.slice(-10).map((s) => (
            <li key={s.at}>
              {new Date(s.at).toLocaleString(c("en-US", "zh-CN"))} ·{" "}
              {money(Number(s.equity))}
            </li>
          ))}
        </ol>
      </details>
    </figure>
  );
}
