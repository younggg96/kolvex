"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { validTicker, type Direction } from "@/lib/decision";

export function useCopy() {
  const { locale } = useTranslation();
  return (en: string, zh: string) => (locale === "zh" ? zh : en);
}
export function DirectionBadge({
  direction,
}: {
  direction: Direction | null | undefined;
}) {
  const c = useCopy();
  const label =
    direction === "bullish"
      ? c("Bullish", "看多")
      : direction === "bearish"
        ? c("Bearish", "看空")
        : direction === "neutral"
          ? c("Neutral", "中性")
          : c("Not assessed", "未评估");
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${direction === "bullish" ? "bg-primary/10 text-primary" : direction === "bearish" ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}
    >
      {label}
    </span>
  );
}
export function TickerSearch() {
  const c = useCopy();
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    if (!validTicker(symbol)) {
      setError(true);
      return;
    }
    router.push(`/dashboard/research/${symbol}`);
  }
  return (
    <form onSubmit={submit} className="max-w-xl">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2">
        <Search
          className="ml-2 h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={ticker}
          onChange={(e) => {
            setTicker(e.target.value);
            setError(false);
          }}
          aria-label={c("Stock ticker", "股票代码")}
          placeholder={c(
            "Start with a stock. NVDA, AAPL, TSLA…",
            "从一只股票开始：NVDA、AAPL、TSLA…",
          )}
          className="border-0 bg-transparent shadow-none"
          maxLength={10}
        />
        <Button type="submit">{c("Research", "研究")}</Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-500">
          {c("Enter a valid US stock ticker.", "请输入有效的美股代码。")}
        </p>
      )}
    </form>
  );
}
export function Panel({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-border bg-background p-5 ${className}`}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="py-3 text-sm leading-6 text-muted-foreground">{children}</p>
  );
}
export function WorkspaceLink({ ticker }: { ticker: string }) {
  return (
    <Link
      href={`/dashboard/research/${encodeURIComponent(ticker)}`}
      className="font-semibold underline-offset-4 hover:underline"
    >
      {ticker}
    </Link>
  );
}
export const money = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);
