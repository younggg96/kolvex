"use client";
import { useCallback, useEffect, useState } from "react";
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
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  money,
  signedMoney,
  useCopy,
  WorkspaceLink,
} from "@/components/decision/shared";
import { paperRequest, type Account, type Review } from "@/lib/paperTrading";
import { cn } from "@/lib/utils";

export default function TradingReviews({
  account,
  errorText,
}: {
  account: Account;
  errorText: (e: unknown) => string;
}) {
  const c = useCopy();
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState("");
  const [note, setNote] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [withdraw, setWithdraw] = useState<Review | null>(null);
  const [attempt, setAttempt] = useState(0);
  const active = new Set(account.state.positions.map((p) => p.id));
  const closed = account.state.fills
    .filter(
      (f, i, all) =>
        f.effect === "close" &&
        !active.has(f.position_id) &&
        all.findIndex(
          (x) => x.effect === "close" && x.position_id === f.position_id,
        ) === i,
    )
    .reverse();

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
    setError("");
    paperRequest<{ items: Review[]; has_more: boolean }>("reviews", {
      signal: controller.signal,
    })
      .then((page) => applyPage(page, false))
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorText(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, applyPage]);

  async function publish() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await paperRequest("reviews", {
        method: "POST",
        body: JSON.stringify({ position_id: position, note: note.trim() }),
      });
      setPublishOpen(false);
      setNote("");
      setAttempt((v) => v + 1);
      setMessage(
        c("Review published to learners.", "复盘已向其他学习者公开。"),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {c("Learn from completed trades", "从已完成的交易中学习")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {c(
              "Share what you saw, what happened and what you would change. Execution and net P&L come from the virtual ledger. Account balances remain private.",
              "分享当时的判断、实际结果与下次改进。成交与净盈亏来自虚拟账本，账户余额保持私密。",
            )}
          </p>
        </div>
        <Button
          disabled={!closed.length || busy}
          onClick={() => {
            setPosition(closed[0]?.position_id || "");
            setError("");
            setPublishOpen(true);
          }}
        >
          {c("Publish a review", "发布交易复盘")}
        </Button>
      </header>
      {!closed.length && (
        <p className="text-sm text-muted-foreground">
          {c(
            "Fully close a position to publish your first review.",
            "完全平仓后，即可发布第一篇交易复盘。",
          )}
        </p>
      )}
      <div aria-live="polite" className="text-sm">
        <p role="alert" className="text-negative">
          {error}
        </p>
        <p>{message}</p>
      </div>
      <ListCard>
        {loading && !items.length ? (
          <Skeleton className="h-48 w-full" />
        ) : !items.length ? (
          <ListEmptyState
            title={
              error
                ? c("Reviews could not load", "无法加载复盘")
                : c("No published reviews yet", "还没有公开复盘")
            }
            description={c(
              "A good review explains the decision, including losses and mistakes.",
              "好的复盘会解释判断，也记录亏损与失误。 ",
            )}
            action={
              <Button
                variant="outline"
                onClick={() => setAttempt((v) => v + 1)}
              >
                {c("Refresh reviews", "刷新复盘")}
              </Button>
            }
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
                          {new Date(f.at).toLocaleString(c("en-US", "zh-CN"))} ·{" "}
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
                      onClick={() => setWithdraw(item)}
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
          <Button
            variant="ghost"
            className="mt-4 w-full"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setError("");
              try {
                applyPage(
                  await paperRequest(`reviews?offset=${items.length}`),
                  true,
                );
              } catch (e) {
                setError(errorText(e));
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading
              ? c("Loading…", "加载中…")
              : c("Load more reviews", "加载更多复盘")}
          </Button>
        )}
      </ListCard>
      <Dialog
        open={publishOpen}
        onOpenChange={(open) => {
          if (!busy) setPublishOpen(open);
        }}
      >
        <DialogContent>
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
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger id="review-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {closed.map((f) => (
                    <SelectItem key={f.position_id} value={f.position_id}>
                      {f.symbol} ·{" "}
                      {f.side === "long"
                        ? c("Long", "多单")
                        : c("Short", "空单")}{" "}
                      · {new Date(f.at).toLocaleString(c("en-US", "zh-CN"))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                onChange={(e) => setNote(e.target.value)}
                placeholder={c(
                  "Explain your entry, exit, and one thing to improve. At least 10 characters.",
                  "记录入场依据、退出原因与一个改进点，至少 10 个字。 ",
                )}
              />
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
              disabled={busy || !position || note.trim().length < 10}
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
        <DialogContent>
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
                if (!withdraw) return;
                setBusy(true);
                setError("");
                try {
                  await paperRequest(`reviews/${withdraw.id}`, {
                    method: "DELETE",
                  });
                  setWithdraw(null);
                  setAttempt((v) => v + 1);
                  setMessage(c("Review withdrawn.", "已撤回复盘。"));
                } catch (e) {
                  setError(errorText(e));
                } finally {
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
