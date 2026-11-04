"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ListCard,
  ListEmptyState,
  ListLoadMore,
} from "@/components/ui/list-card";
import { ContentLoading } from "@/components/ui/content-loading";
import {
  money,
  signedMoney,
  useCopy,
  WorkspaceLink,
} from "@/components/decision/shared";
import { paperRequest, type Account, type Review } from "@/lib/paperTrading";
import { paperTradingReviews } from "@/lib/paperTradingReviews";
import { cn } from "@/lib/utils";

export default function TradingReviews({
  account,
  errorText,
  onTrade,
}: {
  account: Account;
  errorText: (e: unknown) => string;
  onTrade: () => void;
}) {
  const c = useCopy();
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [feedError, setFeedError] = useState("");
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [publishOpen, setPublishOpen] = useState(false);
  const [withdraw, setWithdraw] = useState<Review | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [offset, setOffset] = useState(0);
  const [tradeLimit, setTradeLimit] = useState(20);
  const mutationLock = useRef(false);
  const publishTrigger = useRef<HTMLButtonElement | null>(null);
  const withdrawTrigger = useRef<HTMLButtonElement | null>(null);
  const communityHeading = useRef<HTMLHeadingElement | null>(null);
  const trades = useMemo(() => paperTradingReviews(account), [account]);
  const closed = trades.filter((trade) => trade.completed);
  const selected = closed.find((trade) => trade.id === position);
  const publishedNote = items.find(
    (item) =>
      item.is_mine &&
      item.snapshot.fills.some((f) => f.position_id === position),
  )?.note;
  const note = drafts[position] ?? publishedNote ?? "";
  const formatDate = (at: string) =>
    new Date(at).toLocaleString(c("en-US", "zh-CN"));
  const latestErrorText = useRef(errorText);
  latestErrorText.current = errorText;

  function refresh() {
    setOffset(0);
    setAttempt((v) => v + 1);
  }

  function compose(id: string, trigger: HTMLButtonElement) {
    publishTrigger.current = trigger;
    setPosition(id);
    setError("");
    setMessage("");
    setPublishOpen(true);
  }

  const applyPage = useCallback(
    (page: { items: Review[]; has_more: boolean }, append: boolean) => {
      setItems((current) =>
        append
          ? [
              ...current,
              ...page.items.filter(
                (item) => !current.some((x) => x.id === item.id),
              ),
            ]
          : page.items,
      );
      setHasMore(page.has_more);
    },
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFeedError("");
    paperRequest<{ items: Review[]; has_more: boolean }>(
      `reviews?offset=${offset}`,
      {
        signal: controller.signal,
      },
    )
      .then((page) => {
        if (!controller.signal.aborted) applyPage(page, offset > 0);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setFeedError(latestErrorText.current(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, offset, applyPage]);

  async function publish() {
    if (mutationLock.current || !selected || note.trim().length < 10) return;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    try {
      await paperRequest("reviews", {
        method: "POST",
        body: JSON.stringify({ position_id: position, note: note.trim() }),
      });
      setPublishOpen(false);
      setDrafts((current) => {
        const next = { ...current };
        delete next[position];
        return next;
      });
      refresh();
      setMessage(
        c("Review published to learners.", "复盘已向其他学习者公开。"),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {c("Learn from your trades", "从自己的交易中学习")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {c(
              "Review your entry thesis, executions and results while a trade is open. Once fully closed, you can choose to publish a review. Your ledger and account balance remain private.",
              "持仓中即可回看入场依据、成交与当前结果，完全平仓后可自愿公开复盘。个人账本和账户余额保持私密。",
            )}
          </p>
        </div>
        <Button
          disabled={busy}
          onClick={(event) => {
            if (closed.length) compose(closed[0].id, event.currentTarget);
            else onTrade();
          }}
        >
          {closed.length
            ? c("Publish a review", "发布交易复盘")
            : account.state.positions.length
              ? c("Manage positions", "管理当前持仓")
              : c("Start a virtual trade", "开始模拟交易")}
        </Button>
      </header>
      <div aria-live="polite" className="text-sm">
        <p>{message}</p>
      </div>
      <section aria-labelledby="my-trade-reviews" className="space-y-4">
        <div>
          <h3 id="my-trade-reviews" className="font-semibold">
            {c("My trade journal", "我的交易复盘")} · {trades.length}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {c(
              "Only you can see this ledger. Publishing is optional and requires a fully closed position.",
              "以下账本仅自己可见。公开复盘为自愿操作，需对应持仓已完全平仓。",
            )}
          </p>
        </div>
        <ListCard>
          {!trades.length ? (
            <ListEmptyState
              title={c("No executions to review yet", "还没有可复盘的成交")}
              description={c(
                "After your first virtual order fills, its entry thesis and execution will appear here. Unfilled orders are available at the trading desk.",
                "第一笔虚拟订单成交后，入场依据与成交记录会显示在这里。未成交的委托可在交易工作台查看。",
              )}
              action={
                <Button onClick={onTrade}>
                  {c("Go to trading desk", "前往交易工作台")}
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {trades.slice(0, tradeLimit).map((trade) => (
                <li key={trade.id} className="space-y-4 px-2 py-4 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <WorkspaceLink ticker={trade.symbol} showLogo={false} />
                        <span className="text-sm">
                          {trade.side === "long"
                            ? c("Long", "多单")
                            : c("Short", "空单")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {trade.completed
                            ? c("Fully closed", "已完全平仓")
                            : c("Position open", "持仓中")}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {c("Opened", "开仓于")}{" "}
                        <time dateTime={trade.openedAt}>
                          {formatDate(trade.openedAt)}
                        </time>
                        {!trade.completed && (
                          <>
                            {" "}
                            ·{" "}
                            {c(
                              `${trade.remaining} shares remaining`,
                              `剩余 ${trade.remaining} 股`,
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-lg font-semibold tabular-nums",
                          (trade.completed
                            ? trade.realizedPnl
                            : trade.unrealizedPnl) >= 0
                            ? "text-positive"
                            : "text-negative",
                        )}
                      >
                        {signedMoney(
                          trade.completed
                            ? trade.realizedPnl
                            : trade.unrealizedPnl,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {trade.completed
                          ? c("Net P&L · virtual", "净盈亏 · 虚拟交易")
                          : c(
                              "Open P&L · before fees",
                              "持仓浮盈亏 · 未计费用",
                            )}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm leading-6">
                    <p className="text-xs text-muted-foreground">
                      {c("Entry thesis", "入场依据")}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words">
                      {trade.thesis ||
                        c(
                          "No entry thesis was recorded for this trade.",
                          "这笔交易尚未记录入场依据。",
                        )}
                    </p>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      {c("Execution history", "查看成交记录")} ·{" "}
                      {trade.fills.length} · {c("Fees", "费用")}{" "}
                      {money(trade.fees)}
                    </summary>
                    <ul className="mt-3 space-y-3">
                      {trade.fills.map((fill) => (
                        <li
                          key={fill.id}
                          className="text-xs leading-6 tabular-nums"
                        >
                          <time dateTime={fill.at}>{formatDate(fill.at)}</time>{" "}
                          ·{" "}
                          {fill.effect === "open"
                            ? c("Open", "开仓")
                            : c("Close", "平仓")}{" "}
                          · {fill.quantity} × {money(Number(fill.price))} ·{" "}
                          {c("Fee", "费用")} {money(Number(fill.fee))}
                        </li>
                      ))}
                    </ul>
                    {!trade.completed && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {c("Realized net P&L", "已实现净盈亏")}{" "}
                        {signedMoney(trade.realizedPnl)}
                        {trade.markAt ? (
                          <>
                            {" "}
                            · {c("Quote", "报价")} {formatDate(trade.markAt)}
                          </>
                        ) : (
                          <>
                            {" "}
                            ·{" "}
                            {c(
                              "No quote available; using entry price for valuation.",
                              "暂无报价，按入场价估值。",
                            )}
                          </>
                        )}
                      </p>
                    )}
                  </details>
                  {trade.completed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={(event) =>
                        compose(trade.id, event.currentTarget)
                      }
                    >
                      {c("Write a public review", "撰写公开复盘")}
                    </Button>
                  ) : (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {c(
                        "You can review this trade here while it is open. Public reviews become available after the position is fully closed.",
                        "持仓期间可在此回看交易；完全平仓后会开放撰写公开复盘入口。",
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {trades.length > tradeLimit && (
            <ListLoadMore onClick={() => setTradeLimit((v) => v + 20)}>
              {c("Load more trades", "加载更多交易")}
            </ListLoadMore>
          )}
        </ListCard>
      </section>
      <section aria-labelledby="published-trade-reviews" className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h3
            ref={communityHeading}
            tabIndex={-1}
            id="published-trade-reviews"
            className="font-semibold"
          >
            {c("Community reviews", "公开学习复盘")}
          </h3>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={refresh}
          >
            {loading
              ? c("Refreshing…", "刷新中…")
              : c("Refresh reviews", "刷新复盘")}
          </Button>
        </header>
        {feedError && (
          <p role="alert" className="text-sm text-negative">
            {feedError}
          </p>
        )}
        <ListCard aria-busy={loading}>
          {loading && !items.length ? (
            <ContentLoading
              label={c("Loading public reviews", "正在加载公开复盘")}
            />
          ) : !items.length ? (
            <ListEmptyState
              title={
                feedError
                  ? c("Reviews could not load", "无法加载复盘")
                  : c("No published reviews yet", "还没有公开复盘")
              }
              description={c(
                "Public reviews appear here when learners choose to share. Your own trade journal is available above.",
                "学习者自愿公开后，复盘会显示在这里。你可以先查看上方自己的交易记录。",
              )}
            />
          ) : (
            <ul>
              {items.map((item) => (
                <li
                  key={item.id}
                  className="space-y-4 border-b border-border p-4 last:border-0 sm:p-6"
                >
                  <article className="space-y-4">
                    <header className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <WorkspaceLink
                            ticker={item.snapshot.symbol}
                            showLogo={false}
                          />
                          <span
                            className={cn(
                              "text-sm",
                              item.snapshot.side === "long"
                                ? "text-positive"
                                : "text-negative",
                            )}
                          >
                            {item.snapshot.side === "long"
                              ? c("Long", "多单")
                              : c("Short", "空单")}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {item.is_mine
                            ? c("Your review", "我的复盘")
                            : c(
                                item.author,
                                item.author.replace("Learner", "学习者"),
                              )}{" "}
                          ·{" "}
                          <time dateTime={item.published_at}>
                            {new Date(item.published_at).toLocaleString(
                              c("en-US", "zh-CN"),
                            )}
                          </time>
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-lg font-semibold tabular-nums",
                            Number(item.snapshot.realized_pnl) >= 0
                              ? "text-positive"
                              : "text-negative",
                          )}
                        >
                          {signedMoney(Number(item.snapshot.realized_pnl))}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c("Net P&L · virtual", "净盈亏 · 虚拟交易")}
                        </p>
                      </div>
                    </header>
                    <p className="whitespace-pre-wrap break-words text-sm leading-7">
                      {item.note}
                    </p>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">
                        {c("View execution evidence", "查看成交依据")} ·{" "}
                        {c("Fees", "费用")} {money(Number(item.snapshot.fees))}
                      </summary>
                      <ul className="mt-3 space-y-3">
                        {item.snapshot.fills.map((f) => (
                          <li
                            key={f.id}
                            className="text-xs leading-6 tabular-nums"
                          >
                            {new Date(f.at).toLocaleString(c("en-US", "zh-CN"))}{" "}
                            ·{" "}
                            {f.effect === "open"
                              ? c("Open", "开仓")
                              : c("Close", "平仓")}{" "}
                            {f.quantity} × {money(Number(f.price))} ·{" "}
                            {c("Fee", "费用")} {money(Number(f.fee))}
                            {f.note && (
                              <p className="whitespace-pre-wrap break-words text-muted-foreground">
                                {f.note}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                    {item.is_mine && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={(event) => {
                          withdrawTrigger.current = event.currentTarget;
                          setError("");
                          setMessage("");
                          setWithdraw(item);
                        }}
                      >
                        {c("Withdraw review", "撤回公开复盘")}
                      </Button>
                    )}
                  </article>
                </li>
              ))}
            </ul>
          )}
          {hasMore && (
            <ListLoadMore
              disabled={loading}
              onClick={() => {
                setOffset(items.length);
                setAttempt((v) => v + 1);
              }}
            >
              {loading
                ? c("Loading…", "加载中…")
                : c("Load more reviews", "加载更多复盘")}
            </ListLoadMore>
          )}
        </ListCard>
      </section>
      <Dialog
        open={publishOpen}
        onOpenChange={(open) => {
          if (!busy) setPublishOpen(open);
        }}
      >
        <DialogContent
          className="max-h-[85dvh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            if (publishTrigger.current?.isConnected) {
              event.preventDefault();
              publishTrigger.current.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {c("Publish a trade review", "发布交易复盘")}
            </DialogTitle>
            <DialogDescription>
              {c(
                "Other signed-in learners can see your review, trade thesis, executions, fees and net P&L. Your account balance is excluded. You can withdraw this later.",
                "其他已登录学习者可以看到复盘、交易理由、成交、费用与净盈亏，不包含账户余额。之后可以撤回。",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-position">
                {c("Completed position", "已完成交易")}
              </Label>
              <Select
                value={position}
                disabled={busy}
                onValueChange={(id) => {
                  setPosition(id);
                  setError("");
                }}
              >
                <SelectTrigger id="review-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {closed.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.symbol} ·{" "}
                      {f.side === "long"
                        ? c("Long", "多单")
                        : c("Short", "空单")}{" "}
                      · {formatDate(f.lastAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected && (
              <p className="text-sm tabular-nums">
                {c("Net P&L", "净盈亏")} {signedMoney(selected.realizedPnl)} ·{" "}
                {c("Fees", "费用")} {money(selected.fees)}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="review-note">
                {c("What did you learn?", "这笔交易学到了什么？")}
              </Label>
              <Textarea
                id="review-note"
                rows={5}
                minLength={10}
                maxLength={4000}
                value={note}
                disabled={busy}
                className="resize-none"
                style={{ resize: "none" }}
                aria-describedby="review-note-help"
                onChange={(e) =>
                  setDrafts((current) => ({
                    ...current,
                    [position]: e.target.value,
                  }))
                }
                placeholder={c(
                  "Explain your entry, exit, and one thing to improve. At least 10 characters.",
                  "记录入场依据、退出原因与一个改进点，至少 10 个字。 ",
                )}
              />
              <p
                id="review-note-help"
                className="text-xs text-muted-foreground"
              >
                {c(
                  "At least 10 characters. Your text is published only when you confirm below.",
                  "至少填写 10 个字，点击下方「公开复盘」后才会发布。",
                )}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {c(
                "Publishing the same position again updates its existing review.",
                "再次发布同一持仓将更新已有复盘。",
              )}
            </p>
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPublishOpen(false)}
            >
              {c("Cancel", "取消")}
            </Button>
            <Button
              disabled={busy || !selected || note.trim().length < 10}
              onClick={() => void publish()}
            >
              {busy
                ? c("Publishing…", "发布中…")
                : c("Publish review", "公开复盘")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!withdraw}
        onOpenChange={(open) => {
          if (!busy && !open) setWithdraw(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            const target = withdrawTrigger.current?.isConnected
              ? withdrawTrigger.current
              : communityHeading.current;
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {c("Withdraw this review?", "撤回这篇公开复盘？")}
            </DialogTitle>
            <DialogDescription>
              {c(
                "The review will be removed from the learning feed. Your private execution ledger is preserved.",
                "复盘将从学习动态中移除，个人成交账本仍会保留。",
              )}
            </DialogDescription>
          </DialogHeader>
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setWithdraw(null)}
            >
              {c("Keep published", "保留公开")}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!withdraw || mutationLock.current) return;
                mutationLock.current = true;
                setBusy(true);
                setError("");
                try {
                  await paperRequest(`reviews/${withdraw.id}`, {
                    method: "DELETE",
                  });
                  setItems((current) =>
                    current.filter((item) => item.id !== withdraw.id),
                  );
                  setWithdraw(null);
                  refresh();
                  setMessage(c("Review withdrawn.", "已撤回复盘。"));
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  mutationLock.current = false;
                  setBusy(false);
                }
              }}
            >
              {c("Withdraw review", "撤回复盘")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
