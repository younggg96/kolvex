"use client";

import { InfoTip } from "@/components/ui/info-tip";
import { useCachedResource } from "@/hooks/useCachedResource";
import { isProductFeatureEnabled } from "@/lib/productFeatures";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import CompanyLogo from "@/components/ui/company-logo";
import { Card } from "@/components/ui/card";
import { phonePlainCardClass } from "@/components/ui/list-card";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getMyHoldings } from "@/lib/portfolioApi";
import { marketStockHref } from "@/lib/stockLinks";
import {
  getYouTubeOpinionDashboard,
  clearYouTubeDashboardCache,
} from "@/lib/youtubeOpinionsApi";
import type { Direction } from "@/lib/decision";

export function useCopy() {
  const { locale } = useTranslation();
  return (en: string, zh: string) => (locale === "zh" ? zh : en);
}

/** Direction as a coloured word; colour carries direction, no tinted chip. */
export function DirectionBadge({
  direction,
  className,
}: {
  direction: Direction | null | undefined;
  className?: string;
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
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-semibold",
        direction === "bullish"
          ? "text-positive"
          : direction === "bearish"
            ? "text-negative"
            : "text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          direction === "bullish"
            ? "bg-positive-fill"
            : direction === "bearish"
              ? "bg-negative-fill"
              : "bg-muted-foreground/50",
        )}
      />
      {label}
    </span>
  );
}

/** A titled section with an optional card body below its heading. */
export function Panel({
  title,
  children,
  action,
  description,
  className = "",
  id,
  surface = "plain",
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
  className?: string;
  id?: string;
  surface?: "plain" | "card";
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("min-w-0", className)}>
      <header className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", title && (surface === "card" ? "mb-3 min-h-14 items-center" : "border-b border-border pb-3"))}>
        <div className="min-w-0">
          {title && (
            <div className="flex items-center gap-2">
              <h2 id={id ? `${id}-title` : undefined} className="text-xl font-semibold tracking-[-0.01em]">
                {title}
              </h2>
              {description && <InfoTip label={title}>{description}</InfoTip>}
            </div>
          )}
        </div>
        {action}
      </header>
      {surface === "card" ? <Card className={cn("p-3 sm:p-4", phonePlainCardClass)}>{children}</Card> : children}
    </section>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-5">
      <p className="text-sm leading-6 text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-sm text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none ",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function HeldMark() {
  const c = useCopy();
  return (
    <span className="ml-1.5 inline-flex h-[1.125rem] items-center rounded-full border border-border px-1.5 align-middle text-[0.6875rem] font-medium text-muted-foreground">
      {c("Held", "持有")}
    </span>
  );
}

export function WorkspaceLink({
  ticker,
  showLogo = true,
  held = false,
}: {
  ticker: string;
  showLogo?: boolean;
  held?: boolean;
}) {
  return (
    <Link
      href={marketStockHref(ticker)}
      className={`${showLogo ? "inline-flex items-center gap-2 " : ""}rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none  `}
    >
      {showLogo && (
        <span aria-hidden="true">
          <CompanyLogo symbol={ticker} size="sm" />
        </span>
      )}
      <span>{ticker}</span>
      {held && <HeldMark />}
    </Link>
  );
}

export function Change({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value))
    return <span className={cn("tabular-nums text-muted-foreground", className)}>—</span>;
  return (
    <span
      className={cn(
        "tabular-nums",
        value > 0 ? "text-positive" : value < 0 ? "text-negative" : "text-muted-foreground",
        className,
      )}
    >
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

export const money = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);

export const signedMoney = (value: number) =>
  `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;

/** Shared resources paint cached data immediately and only block on a cold visit. */
export function useHeldTickers(attempt = 0) {
  const enabled = isProductFeatureEnabled("portfolio");
  const resource = useCachedResource("/api/portfolio/holdings", signal => enabled ? getMyHoldings(signal) : Promise.resolve({ accounts: [], is_connected: false, is_public: false }), { ttl: 30_000, maxAge: 60_000 });
  const tickers = [...new Set((resource.data?.accounts ?? []).flatMap(account => account.portfolio_positions || []).filter(position => position.position_type !== "option").map(position => position.symbol.trim().toUpperCase()))];
  const refresh = resource.refresh;
  useEffect(() => { if (attempt > 0) refresh(); }, [attempt, refresh]);
  return { tickers, loading: enabled && resource.loading, error: Boolean(resource.error) };
}

export function useCreatorCatalogue(attempt = 0) {
  const resource = useCachedResource("/api/youtube-opinions/dashboard?limit=12", () => getYouTubeOpinionDashboard({ limit: 12 }), { ttl: 60_000 });
  const refresh = resource.refresh;
  useEffect(() => { if (attempt > 0) { clearYouTubeDashboardCache(); refresh(); } }, [attempt, refresh]);
  return { data: resource.data ?? null, loading: resource.loading, error: Boolean(resource.error) };
}

/** Calendar-day label relative to today: 今天 / 昨天 / 10月6日. */
export function useDayLabel() {
  const c = useCopy();
  const { t } = useTranslation();
  return (value: string) => {
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(date.getTime())) return value;
    const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((start(new Date()) - start(date)) / 86_400_000);
    if (days === 0) return c("Today", "今天");
    if (days === 1) return c("Yesterday", "昨天");
    return date.toLocaleDateString(t("common.intlLocale"), { month: "short", day: "numeric" });
  };
}

/**
 * Invalidation, entry and target drawn on one line with the live price.
 * Long theses read left to right; short theses mirror so the target is always on the right.
 */
export function PriceLadder({
  direction,
  invalidation,
  entryLow,
  entryHigh,
  target,
  price,
  compact = false,
}: {
  direction: Direction;
  invalidation: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  target: number | null;
  price?: number | null;
  compact?: boolean;
}) {
  const c = useCopy();
  if (direction === "neutral" || invalidation === null || target === null) return null;
  const low = entryLow ?? null;
  const high = entryHigh ?? entryLow ?? null;
  const values = [invalidation, target, low, high, price].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const mirror = direction === "bearish";
  const pos = (value: number) => {
    const ratio = (value - min) / span;
    return `${(mirror ? 1 - ratio : ratio) * 100}%`;
  };
  const entryMid = low !== null && high !== null ? (low + high) / 2 : null;
  const marks: Array<{ key: string; value: number; label: string; tone: string }> = [
    { key: "invalidation", value: invalidation, label: c("Invalidation", "失效"), tone: "text-negative" },
    ...(entryMid !== null
      ? [{ key: "entry", value: entryMid, label: c("Entry", "入场"), tone: "text-foreground" }]
      : []),
    { key: "target", value: target, label: c("Target", "目标"), tone: "text-positive" },
  ];
  const left = (a: number, b: number) => {
    const pa = parseFloat(pos(a));
    const pb = parseFloat(pos(b));
    return { left: `${Math.min(pa, pb)}%`, width: `${Math.abs(pb - pa)}%` };
  };
  const anchor = entryMid ?? invalidation;
  const priceInRange =
    typeof price === "number" && Number.isFinite(price) && price > 0;
  return (
    <div className={cn("min-w-0", compact ? "pt-1" : "pt-3")}>
      <div className="relative mx-2 h-6">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        <div
          className="absolute top-1/2 h-[0.1875rem] -translate-y-1/2 rounded-full bg-negative-fill/60"
          style={left(invalidation, anchor)}
        />
        <div
          className="absolute top-1/2 h-[0.1875rem] -translate-y-1/2 rounded-full bg-positive-fill/70"
          style={left(anchor, target)}
        />
        {low !== null && high !== null && high > low && (
          <div
            className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm bg-foreground/20"
            style={left(low, high)}
          />
        )}
        {marks.map((mark) => (
          <span
            key={mark.key}
            aria-hidden
            className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-foreground/50"
            style={{ left: pos(mark.value) }}
          />
        ))}
        {priceInRange && (
          <span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-[0_1px_3px_rgb(0_0_0/0.25)]"
            style={{ left: pos(price as number) }}
            title={`${c("Now", "现价")} ${money(price)}`}
          />
        )}
      </div>
      {!compact && (
        <dl className={cn("mt-1 grid gap-2 text-xs", marks.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {(mirror ? [...marks].reverse() : marks).map((mark, index, list) => (
            <div
              key={mark.key}
              className={cn(
                index === 0 ? "text-left" : index === list.length - 1 ? "text-right" : "text-center",
              )}
            >
              <dt className="text-muted-foreground">{mark.label}</dt>
              <dd className={cn("mt-0.5 font-semibold tabular-nums", mark.tone)}>
                {mark.key === "entry" && low !== null && high !== null && high !== low
                  ? `${money(low)}–${money(high)}`
                  : money(mark.value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
