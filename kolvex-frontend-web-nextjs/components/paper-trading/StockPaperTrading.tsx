"use client";

import { InfoTip } from "@/components/ui/info-tip";
import Link from "next/link";
import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import {
  Empty,
  money,
  signedMoney,
  useCopy,
} from "@/components/decision/shared";
import { usePaperTradingAccount } from "@/hooks/usePaperTradingAccount";
import { paperErrorCopy } from "@/lib/paperTradingErrors";
import { stockPaperTrading } from "@/lib/stockPaperTrading";
import type { Command, Position } from "@/lib/paperTrading";
import { cn } from "@/lib/utils";
import OrderTicket from "./OrderTicket";

export default function StockPaperTrading({
  symbol,
  active,
}: {
  symbol: string;
  active: boolean;
}) {
  const c = useCopy();
  const resource = usePaperTradingAccount(active);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [lastAction, setLastAction] = useState<Command["action"]>("sync");
  const [fillLimit, setFillLimit] = useState(10);
  const ticket = useRef<HTMLElement>(null);
  const { account, busy, loading } = resource;
  const data = account ? stockPaperTrading(account, symbol) : null;
  const closePosition = data?.positions.find((p) => p.id === closingId) ?? null;
  const errorText = (error: unknown) => c(...paperErrorCopy(error));
  const mutationError = resource.mutationError
    ? c(
        ...paperErrorCopy(
          resource.mutationError,
          lastAction === "order" ? "order" : "read",
        ),
      )
    : "";
  const direction = (side: string) =>
    side === "long" ? c("Long", "多单") : c("Short", "空单");
  const orderKind = (kind: string) =>
    kind === "market"
      ? c("Market", "市价单")
      : kind === "limit"
        ? c("Limit", "限价单")
        : c("Stop", "突破单");
  async function execute(command: Command) {
    setLastAction(command.action);
    setNotice("");
    const success = await resource.execute(command);
    if (success)
      setNotice(
        command.action === "cancel"
          ? c(
              "Order cancelled. Reserved funds or shares released.",
              "已撤单，相关冻结资金或股数已释放。",
            )
          : command.action === "sync"
            ? c("Virtual account synced.", "虚拟账户已同步。")
            : c(
                "Virtual order accepted. Check its status below.",
                "虚拟订单已接收，请查看下方的委托或成交状态。",
              ),
      );
    return success;
  }
  function close(p: Position) {
    setClosingId(p.id);
    ticket.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }
  const caption =
    "whitespace-nowrap px-3 py-3 text-left text-xs font-medium text-muted-foreground";
  const cell = "whitespace-nowrap px-3 py-4 text-sm tabular-nums";
  const tone = (value: number) =>
    value > 0
      ? "text-positive"
      : value < 0
        ? "text-negative"
        : "text-foreground";

  return (
    <section aria-labelledby="stock-paper-title" className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="stock-paper-title" className="flex items-center gap-2 text-xl font-semibold">
            {c("My virtual trades", "我的虚拟交易")} · {symbol}
            <InfoTip label={c("About virtual trades", "关于虚拟交易")}>{c(
              "Your positions, orders and results for this stock. Virtual funds only; the account is shared with your trading desk.",
              "查看这只股票的持仓、委托与交易结果。仅使用虚拟资金，与虚拟交易工作台共用同一账户。",
            )}</InfoTip>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!account || busy}
            onClick={() => {
              setClosingId(null);
              requestAnimationFrame(() => {
                ticket.current?.scrollIntoView({
                  block: "start",
                  behavior: "auto",
                });
                ticket.current
                  ?.querySelector<HTMLInputElement>("#paper-quantity")
                  ?.focus({ preventScroll: true });
              });
            }}
          >
            {c("Virtual order", "模拟下单")}
          </Button>
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() =>
              account
                ? void execute({
                    action: "sync",
                    request_id: crypto.randomUUID(),
                  })
                : void resource.reload()
            }
          >
            <RefreshCw aria-hidden className="size-4" />
            {c("Refresh", "刷新")}
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/paper-trading">
              {c("Full trading desk", "全部虚拟交易")}
            </Link>
          </Button>
        </div>
      </header>
      {!!resource.error && (
        <p role="alert" className="text-sm text-negative">
          {errorText(resource.error)}
        </p>
      )}
      <div aria-live="polite" className="text-sm">
        <p role="alert" className="text-negative">
          {mutationError}
        </p>
        {notice && <p>{notice}</p>}
      </div>
      {!account || !data ? (
        loading || !resource.error ? (
          <ContentLoading label={c("Loading your virtual trades", "正在加载我的虚拟交易")} className="min-h-0">
            <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => <Card key={i} className="p-4"><Skeleton className="h-3.5 w-32 rounded-md" /><Skeleton className="mt-3 h-7 w-24 rounded-lg" /></Card>)}
            </div>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="min-w-0 space-y-6">
                {[0, 1].map((section) => <div key={section}>
                  <Skeleton className="mb-3 h-6 w-28 rounded-md" />
                  <ListCard><div className="space-y-4">{[0, 1].map((i) => <div key={i} className="space-y-3 border-b border-border py-4 first:pt-0 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3"><Skeleton className="h-4 w-32 rounded-md" /><Skeleton className="h-5 w-20 rounded-md" /></div>
                    <Skeleton className="h-3.5 w-2/3 rounded-md" />
                  </div>)}</div></ListCard>
                </div>)}
              </div>
              <div className="min-w-0">
                <Skeleton className="mb-3 h-6 w-28 rounded-md" />
                <Card className="space-y-4 p-4 sm:p-6">
                  <Skeleton className="h-11 w-full rounded-full" />
                  {[0, 1, 2].map((i) => <div key={i} className="space-y-2"><Skeleton className="h-3.5 w-20 rounded-md" /><Skeleton className="h-11 w-full rounded-xl" /></div>)}
                  <Skeleton className="h-11 w-full rounded-full" />
                </Card>
              </div>
            </div>
            </div>
          </ContentLoading>
        ) : (
        <ListCard>
            <ListEmptyState
              title={c("Virtual trades could not load", "无法加载虚拟交易")}
              action={<Button variant="outline" size="sm" onClick={() => void resource.reload()}>{c("Retry", "重试")}</Button>}
            />
        </ListCard>
        )
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              [
                c("Open P&L · before fees", "持仓浮盈亏 · 未计费用"),
                signedMoney(data.unrealizedPnl),
                data.unrealizedPnl,
              ],
              [
                c("Realized P&L · after fees", "已实现盈亏 · 扣除费用"),
                signedMoney(data.realizedPnl),
                data.realizedPnl,
              ],
              [
                c("Pending orders", "待成交委托"),
                String(data.orders.length),
                0,
              ],
            ].map(([label, value, amount]) => (
              <Card key={String(label)} className="p-4">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd
                  className={cn(
                    "mt-2 text-2xl font-semibold tabular-nums",
                    tone(Number(amount)),
                  )}
                >
                  {value}
                </dd>
              </Card>
            ))}
          </dl>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="min-w-0 space-y-6 xl:col-start-1 xl:row-start-1">
              <section>
                <h3 className="mb-3 text-lg font-semibold">
                  {c("My positions", "我的持仓")}{" "}
                  <span className="text-sm text-muted-foreground">
                    {data.positions.length}
                  </span>
                </h3>
                <ListCard>
                  {!data.positions.length ? (
                    <Empty>
                      {c(
                        `No virtual positions in ${symbol}. Place an order to start practicing.`,
                        `暂无 ${symbol} 的虚拟持仓，可以通过模拟下单开始练习。`,
                      )}
                    </Empty>
                  ) : (
                    <div className="space-y-4">
                      {data.positions.map((p) => (
                        <article
                          key={p.id}
                          className="space-y-3 border-b border-border py-4 first:pt-0 last:border-0 last:pb-0"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-medium">
                              {direction(p.side)} · {p.quantity}{" "}
                              {c("shares", "股")}
                            </p>
                            <p
                              className={cn(
                                "font-semibold tabular-nums",
                                tone(data.positionPnl(p)),
                              )}
                            >
                              {signedMoney(data.positionPnl(p))}
                            </p>
                          </div>
                          <dl className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <dt className="text-xs text-muted-foreground">
                                {c("Entry / mark", "成本 / 估值")}
                              </dt>
                              <dd className="mt-1 tabular-nums">
                                {money(Number(p.entry_price))} /{" "}
                                {money(
                                  Number(data.mark?.price ?? p.entry_price),
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">
                                {c("Stop loss / take profit", "止损 / 止盈")}
                              </dt>
                              <dd className="mt-1 tabular-nums">
                                {p.stop_loss ? money(Number(p.stop_loss)) : "—"}{" "}
                                /{" "}
                                {p.take_profit
                                  ? money(Number(p.take_profit))
                                  : "—"}
                              </dd>
                            </div>
                          </dl>
                          <p className="text-xs text-muted-foreground">
                            {data.mark
                              ? `${data.mark.session === "post" ? c("After-hours mark", "盘后估值") : c("Mark time", "估值时间")} ${new Date(data.mark.at).toLocaleString(c("en-US", "zh-CN"))}`
                              : c(
                                  "No mark available; valued at entry price.",
                                  "暂无估值报价，暂按开仓价计算。",
                                )}
                          </p>
                          {p.note && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground">
                                {c("Trade thesis", "交易理由")}
                              </summary>
                              <p className="mt-2 whitespace-pre-wrap break-words leading-6">
                                {p.note}
                              </p>
                            </details>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => close(p)}
                          >
                            {c("Close position", "平仓")}
                          </Button>
                        </article>
                      ))}
                    </div>
                  )}
                </ListCard>
              </section>
              <section>
                <h3 className="mb-3 text-lg font-semibold">
                  {c("My pending orders", "我的挂单")}
                </h3>
                <ListCard>
                  {!data.orders.length ? (
                    <Empty>
                      {c(
                        "No pending orders for this stock.",
                        "这只股票暂无待成交委托。",
                      )}
                    </Empty>
                  ) : (
                    <ul>
                      {data.orders.map((o) => (
                        <li
                          key={o.id}
                          className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4 first:pt-0 last:border-0 last:pb-0"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {o.effect === "close"
                                ? c("Close", "平仓")
                                : c("Open", "开仓")}{" "}
                              · {direction(o.side)} · {orderKind(o.kind)}
                            </p>
                            <p className="mt-1 text-sm tabular-nums">
                              {o.quantity} {c("shares", "股")} ·{" "}
                              {o.price
                                ? money(Number(o.price))
                                : c("Market price", "市价")}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(o.created_at).toLocaleString(
                                c("en-US", "zh-CN"),
                              )}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void execute({
                                action: "cancel",
                                request_id: crypto.randomUUID(),
                                order_id: o.id,
                              })
                            }
                          >
                            {c("Cancel order", "撤单")}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </ListCard>
              </section>
              <section>
                <h3 className="mb-3 text-lg font-semibold">
                  {c("My executions", "我的成交")}{" "}
                  <span className="text-sm text-muted-foreground">
                    {data.fills.length}
                  </span>
                </h3>
                <ListCard>
                  {!data.fills.length ? (
                    <Empty>
                      {c(
                        "Your completed executions for this stock will appear here.",
                        "这只股票的成交记录将在这里显示。",
                      )}
                    </Empty>
                  ) : (
                    <>
                      <div
                        className="overflow-x-auto"
                        role="region"
                        tabIndex={0}
                        aria-label={c(
                          "This stock's virtual executions",
                          "当前股票虚拟成交记录",
                        )}
                      >
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              {[
                                c("Trade / time", "交易 / 时间"),
                                c("Shares / fill", "股数 / 成交价"),
                                c("Fees", "费用"),
                                c("Realized P&L", "已实现净盈亏"),
                              ].map((label) => (
                                <th key={label} scope="col" className={caption}>
                                  {label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.fills.slice(0, fillLimit).map((f) => (
                              <tr key={f.id}>
                                <td className={cell}>
                                  {f.effect === "open"
                                    ? c("Open", "开仓")
                                    : c("Close", "平仓")}{" "}
                                  · {direction(f.side)}
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {new Date(f.at).toLocaleString(
                                      c("en-US", "zh-CN"),
                                    )}
                                  </p>
                                </td>
                                <td className={cell}>
                                  {f.quantity} / {money(Number(f.price))}
                                </td>
                                <td className={cell}>{money(Number(f.fee))}</td>
                                <td
                                  className={cn(
                                    cell,
                                    f.effect === "close" &&
                                      tone(Number(f.realized_pnl)),
                                  )}
                                >
                                  {f.effect === "close"
                                    ? signedMoney(Number(f.realized_pnl))
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {data.fills.length > fillLimit && (
                        <Button
                          variant="ghost"
                          className="mt-3 w-full"
                          onClick={() => setFillLimit((n) => n + 10)}
                        >
                          {c("Load more executions", "加载更多成交")}
                        </Button>
                      )}
                    </>
                  )}
                </ListCard>
              </section>
            </div>
            <section
              ref={ticket}
              className="min-w-0 scroll-mt-24 xl:col-start-2 xl:row-start-1"
            >
              <h3 className="mb-3 text-lg font-semibold">
                {c("Trade virtually", "模拟买卖")} {symbol}
              </h3>
              <Card className="p-4 sm:p-6">
                {closingId && !closePosition ? (
                  <ListEmptyState
                    title={c(
                      "This position has already closed",
                      "该持仓已经关闭",
                    )}
                    action={
                      <Button
                        variant="outline"
                        onClick={() => setClosingId(null)}
                      >
                        {c("New virtual order", "新建虚拟订单")}
                      </Button>
                    }
                  />
                ) : (
                  <OrderTicket
                    key={`${symbol}-${closingId ?? "open"}`}
                    fixedSymbol={symbol}
                    active={active}
                    account={account}
                    closePosition={closePosition}
                    clearClose={() => setClosingId(null)}
                    execute={execute}
                    busy={busy}
                    errorText={errorText}
                    mutationError={mutationError}
                  />
                )}
              </Card>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
