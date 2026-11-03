"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { money, useCopy } from "@/components/decision/shared";
import {
  paperRequest,
  type Account,
  type Command,
  type Position,
  type Quote,
  type Side,
} from "@/lib/paperTrading";

export default function OrderTicket({
  account,
  closePosition,
  clearClose,
  execute,
  busy,
  errorText,
  mutationError,
  fixedSymbol,
}: {
  account: Account;
  closePosition: Position | null;
  clearClose: () => void;
  execute: (command: Command) => Promise<boolean>;
  busy: boolean;
  errorText: (error: unknown) => string;
  mutationError: string;
  fixedSymbol?: string;
}) {
  const c = useCopy();
  const query = useSearchParams();
  const positive = (key: string) => {
    const value = Number(query.get(key));
    return value > 0 && Number.isFinite(value) ? String(value) : "";
  };
  const [symbol, setSymbol] = useState(
    query
      .get("symbol")
      ?.match(/^[A-Za-z][A-Za-z0-9.\-]{0,15}$/)?.[0]
      .toUpperCase() || "AAPL",
  );
  const [side, setSide] = useState<Side>(
    query.get("side") === "short" ? "short" : "long",
  );
  const [kind, setKind] = useState<"market" | "limit" | "stop">(
    positive("entry") ? "limit" : "market",
  );
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(positive("entry"));
  const [stop, setStop] = useState(positive("stop"));
  const [target, setTarget] = useState(positive("target"));
  const [note, setNote] = useState(query.get("note")?.slice(0, 2000) || "");
  const [source, setSource] = useState<"manual" | "ai_setup">(
    query.get("source") === "ai_setup" ? "ai_setup" : "manual",
  );
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [validation, setValidation] = useState("");
  const [validationField, setValidationField] = useState("");
  const [draft, setDraft] = useState<Command | null>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const chosenSymbol = closePosition?.symbol || fixedSymbol || symbol;
  const chosenSide = closePosition?.side || side;

  useEffect(() => {
    if (closePosition) {
      setQuantity(String(closePosition.quantity));
      setKind("market");
      setValidation("");
      firstField.current?.focus();
    }
    // Background sync must not reset an edited order ticket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closePosition?.id]);

  useEffect(() => {
    const controller = new AbortController();
    setQuote(null);
    setQuoteError("");
    setQuoteLoading(false);
    if (!/^[A-Z][A-Z0-9.\-]{0,15}$/.test(chosenSymbol)) return;
    setQuoteLoading(true);
    const timer = setTimeout(() => {
      paperRequest<Quote>(`quote/${encodeURIComponent(chosenSymbol)}`, {
        signal: controller.signal,
      })
        .then(setQuote)
        .catch((error) => {
          if (!controller.signal.aborted) setQuoteError(errorText(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoteLoading(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // errorText uses the active locale; quote refresh does not depend on its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenSymbol, quoteAttempt]);

  const q = Number(quantity),
    reference = kind === "market" ? Number(quote?.price) : Number(price);
  const estimate = q > 0 && reference > 0 ? q * reference : 0;
  const risk =
    stop && reference > 0 ? Math.abs(reference - Number(stop)) * q : null;
  const reservedQuantity = closePosition
    ? account.state.orders
        .filter(
          (o) => o.status === "pending" && o.position_id === closePosition.id,
        )
        .reduce((sum, o) => sum + o.quantity, 0)
    : 0;

  function review(event: React.FormEvent) {
    event.preventDefault();
    const invalid = [
      [
        !/^[A-Z][A-Z0-9.\-]{0,15}$/.test(chosenSymbol),
        "paper-symbol",
        c("Enter a valid stock symbol.", "请输入有效的股票代码。"),
      ],
      [
        !Number.isInteger(q) || q <= 0 || q > 1000000,
        "paper-quantity",
        c(
          "Enter a whole number of shares from 1 to 1,000,000.",
          "股数须为 1 至 1,000,000 的整数。",
        ),
      ],
      [
        !quote,
        "paper-symbol",
        c(
          "Load a valid USD stock quote first.",
          "请先获取有效的美元股票报价。",
        ),
      ],
      [
        kind === "market" &&
          (!quote?.tradable ||
            Date.now() - new Date(quote.at).getTime() > 1200000),
        "paper-kind",
        c(
          "Market orders require a fresh regular-session quote. Use a pending order or refresh during market hours.",
          "市价单需要常规时段内的新报价。请使用挂单，或在交易时段刷新行情。",
        ),
      ],
      [
        !Number.isFinite(reference) || reference <= 0,
        "paper-price",
        c("Enter a positive order price.", "请输入大于零的委托价。"),
      ],
      [
        !!closePosition && q > closePosition.quantity - reservedQuantity,
        "paper-quantity",
        c(
          "Some shares are reserved by pending close orders. Cancel those orders first.",
          "可平仓股数不足，部分股数可能已被平仓挂单冻结，请先撤单。",
        ),
      ],
      [
        !closePosition &&
          estimate * 1.00060005 > Number(account.summary.available),
        "paper-quantity",
        c(
          "Insufficient available funds, including estimated fees and slippage.",
          "可用资金不足以覆盖本金、预计费用与滑点。",
        ),
      ],
      [
        !closePosition &&
          !!stop &&
          (!Number.isFinite(Number(stop)) ||
            Number(stop) <= 0 ||
            (chosenSide === "long"
              ? Number(stop) >= reference
              : Number(stop) <= reference)),
        "paper-stop",
        c(
          "Stop loss must be below a long entry or above a short entry.",
          "多单止损须低于入场价，空单止损须高于入场价。",
        ),
      ],
      [
        !closePosition &&
          !!target &&
          (!Number.isFinite(Number(target)) ||
            Number(target) <= 0 ||
            (chosenSide === "long"
              ? Number(target) <= reference
              : Number(target) >= reference)),
        "paper-target",
        c(
          "Take profit must be above a long entry or below a short entry.",
          "多单止盈须高于入场价，空单止盈须低于入场价。",
        ),
      ],
    ].find(([failed]) => failed);
    if (invalid) {
      const id = String(invalid[1]);
      setValidationField(id);
      setValidation(String(invalid[2]));
      event.currentTarget.querySelector<HTMLElement>(`#${id}`)?.focus();
      return;
    }
    setValidation("");
    setDraft({
      action: "order",
      request_id: crypto.randomUUID(),
      symbol: chosenSymbol,
      side: chosenSide,
      effect: closePosition ? "close" : "open",
      position_id: closePosition?.id,
      quantity: q,
      kind,
      price: kind === "market" ? null : reference,
      stop_loss: closePosition || !stop ? null : Number(stop),
      take_profit: closePosition || !target ? null : Number(target),
      note,
      source,
    });
  }

  const fieldError = (id: string) => ({
    "aria-invalid": !!validation && validationField === id,
    "aria-describedby": "paper-validation",
  });

  return (
    <>
      <form
        noValidate
        onSubmit={review}
        onChange={() => {
          if (validation) setValidation("");
        }}
        className="space-y-4"
      >
        {source === "ai_setup" && !closePosition && (
          <p className="text-sm leading-6 text-muted-foreground">
            {c(
              "AI plan imported as an editable draft. Check direction, order type and risk before placing it.",
              "已导入 AI 计划草稿，请检查方向、订单类型与风险后再下单。",
            )}
          </p>
        )}
        {closePosition ? (
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">
              {c("Close", "平仓")} {chosenSymbol} ·{" "}
              {chosenSide === "long" ? c("Long", "多单") : c("Short", "空单")}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearClose}
            >
              {c("Back to open", "返回开仓")}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="paper-symbol">
                {c("Stock symbol", "股票代码")}
              </Label>
              <Input
                id="paper-symbol"
                {...fieldError("paper-symbol")}
                maxLength={16}
                value={chosenSymbol}
                readOnly={!!fixedSymbol}
                onChange={(e) => {
                  setSymbol(e.target.value.toUpperCase());
                  setSource("manual");
                }}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>
            <div
              role="group"
              aria-label={c("Direction", "交易方向")}
              className="grid grid-cols-2 gap-2"
            >
              {(["long", "short"] as const).map((value) => (
                <Button
                  type="button"
                  key={value}
                  variant={chosenSide === value ? "secondary" : "outline"}
                  aria-pressed={chosenSide === value}
                  onClick={() => setSide(value)}
                >
                  {value === "long"
                    ? c("Buy / Long", "买入做多")
                    : c("Sell short", "卖出做空")}
                </Button>
              ))}
            </div>
          </>
        )}
        <div
          className="min-h-20 text-sm"
          aria-live="polite"
          aria-busy={quoteLoading}
        >
          {quoteLoading ? (
            <p className="text-muted-foreground">
              {c("Loading quote…", "正在获取报价…")}
            </p>
          ) : quote ? (
            <>
              <p className="text-xl font-semibold tabular-nums">
                {money(Number(quote.price))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c("Quote time", "报价时间")}：
                {new Date(quote.at).toLocaleString(c("en-US", "zh-CN"))} ·{" "}
                {quote.tradable
                  ? c("Regular session · may be delayed", "常规时段 · 可能延迟")
                  : c(
                      "Closed or stale · pending orders only",
                      "休市或报价过期 · 仅挂单",
                    )}
              </p>
            </>
          ) : (
            <p className="text-negative">
              {quoteError ||
                c(
                  "Enter a stock symbol to load a quote.",
                  "输入股票代码获取报价。",
                )}
            </p>
          )}
          <Button
            type="button"
            variant="link"
            size="xs"
            disabled={quoteLoading || busy}
            onClick={() => setQuoteAttempt((a) => a + 1)}
          >
            {c("Refresh quote", "刷新行情")}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="paper-kind">{c("Order type", "订单类型")}</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as typeof kind)}
            >
              <SelectTrigger id="paper-kind" {...fieldError("paper-kind")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market">{c("Market", "市价单")}</SelectItem>
                <SelectItem value="limit">
                  {c("Limit · GTC", "限价单 · GTC")}
                </SelectItem>
                <SelectItem value="stop">
                  {c("Stop · GTC", "突破单 · GTC")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="paper-quantity">{c("Shares", "股数")}</Label>
            <Input
              ref={firstField}
              id="paper-quantity"
              inputMode="numeric"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              {...fieldError("paper-quantity")}
            />
          </div>
        </div>
        {kind !== "market" && (
          <div className="space-y-2">
            <Label htmlFor="paper-price">
              {kind === "limit"
                ? c("Limit price (USD)", "限价（美元）")
                : c("Trigger price (USD)", "突破触发价（美元）")}
            </Label>
            <Input
              id="paper-price"
              {...fieldError("paper-price")}
              type="number"
              inputMode="decimal"
              min="0.000001"
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              {kind === "stop"
                ? c(
                    "Triggers when price crosses in your trade direction, then fills with simulated slippage.",
                    "价格沿交易方向突破后，按观察价加模拟滑点成交。",
                  )
                : c(
                    "Fills at your limit or better when a valid quote reaches it.",
                    "有效报价到达限价后，以限价或更优价格成交。",
                  )}
            </p>
          </div>
        )}
        {!closePosition && (
          <div className="grid grid-cols-2 gap-4">
            {[
              [
                "paper-stop",
                c("Stop loss · optional", "止损价 · 选填"),
                stop,
                setStop,
              ],
              [
                "paper-target",
                c("Take profit · optional", "止盈价 · 选填"),
                target,
                setTarget,
              ],
            ].map(([id, label, value, setter]) => (
              <div key={id as string} className="space-y-2">
                <Label htmlFor={id as string}>{label as string}</Label>
                <Input
                  id={id as string}
                  {...fieldError(id as string)}
                  type="number"
                  inputMode="decimal"
                  min="0.000001"
                  step="any"
                  value={value as string}
                  onChange={(e) =>
                    (setter as (v: string) => void)(e.target.value)
                  }
                />
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="paper-note">{c("Trade thesis", "交易理由")}</Label>
          <Textarea
            id="paper-note"
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={c(
              "What confirms this trade, and what would invalidate it?",
              "什么证据支持这笔交易？什么情况说明判断失效？",
            )}
          />
        </div>
        <dl className="space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              {c("Available", "可用资金")}
            </dt>
            <dd className="tabular-nums">
              {money(Number(account.summary.available))}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              {c("Estimated notional", "预计交易金额")}
            </dt>
            <dd className="tabular-nums">{money(estimate)}</dd>
          </div>
          {!closePosition && risk !== null && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {c("Risk to stop · before costs", "到止损的风险 · 未计费用")}
              </dt>
              <dd className="tabular-nums">
                {money(risk)} ·{" "}
                {((risk / Number(account.summary.equity)) * 100).toFixed(2)}%
              </dd>
            </div>
          )}
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          {c(
            "0.01% fee per fill. Market and stop fills add 0.05% adverse slippage. Short positions use 100% cash collateral. Stops may gap.",
            "每次成交收取 0.01% 模拟费用。市价与突破成交增加 0.05% 不利滑点。空单使用 100% 现金抵押，止损可能跳空。",
          )}
        </p>
        <p
          id="paper-validation"
          role="alert"
          className="min-h-5 text-sm text-negative"
        >
          {validation}
        </p>
        <Button
          className="w-full"
          type="submit"
          disabled={busy || quoteLoading || !quote}
        >
          {c("Review virtual order", "检查虚拟订单")}
        </Button>
        <Button asChild variant="link" className="w-full">
          <Link href={`/dashboard/market/${encodeURIComponent(chosenSymbol)}`}>
            {c("Open stock research", "查看股票分析")}
          </Link>
        </Button>
      </form>
      <Dialog
        open={!!draft}
        onOpenChange={(open) => {
          if (!busy && !open) setDraft(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {c("Place virtual order", "提交虚拟订单")}
            </DialogTitle>
            <DialogDescription>
              {c(
                "This uses virtual funds. Prices and fills may differ from a broker.",
                "此订单仅使用虚拟资金，报价与成交可能与券商不同。",
              )}
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3 text-sm">
              <p className="text-xl font-semibold">
                {draft.symbol} · {draft.quantity} {c("shares", "股")}
              </p>
              <p>
                {draft.effect === "close"
                  ? c("Close", "平仓")
                  : draft.side === "long"
                    ? c("Open long", "开多")
                    : c("Open short", "开空")}{" "}
                ·{" "}
                {draft.kind === "market"
                  ? c("Market", "市价")
                  : draft.kind === "limit"
                    ? c("Limit", "限价")
                    : c("Stop", "突破")}{" "}
                {draft.price
                  ? money(draft.price)
                  : c("at the next valid observed price", "按有效观察报价成交")}
              </p>
              <p>
                {c("Stop loss", "止损")}：
                {draft.stop_loss ? money(draft.stop_loss) : "—"} ·{" "}
                {c("Take profit", "止盈")}：
                {draft.take_profit ? money(draft.take_profit) : "—"}
              </p>
              <p className="text-muted-foreground">
                {c(
                  "Pending orders remain until filled or cancelled. After a connection error, retry this same order to avoid duplicates.",
                  "挂单保留至成交或撤单。遇到网络错误时，请在此重试同一订单以避免重复。",
                )}
              </p>
            </div>
          )}
          <p role="alert" className="min-h-5 text-sm text-negative">
            {mutationError}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              {c("Back", "返回修改")}
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (draft && (await execute(draft))) {
                  setDraft(null);
                  setQuantity("");
                  clearClose();
                }
              }}
            >
              {busy
                ? c("Placing…", "提交中…")
                : c("Place virtual order", "提交虚拟订单")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
