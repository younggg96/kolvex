"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  augmentTrendWithQuote,
  currentTradingDay,
  loadStockTrend,
  trendSegments,
  type TrendPoint,
  type TrendSession,
} from "@/lib/stockTrends";
import { observationRange } from "@/lib/marketObservations";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { useCopy } from "./shared";

const SESSION_ORDER = ["overnight", "pre", "post"] as const;

export default function StockTrend({
  symbol,
  period,
  interval,
  rangeLabel,
  rangeKey,
  latestQuote,
}: {
  symbol: string;
  period: string;
  interval: string;
  rangeLabel: string;
  rangeKey?: string;
  latestQuote?: { price?: number; time?: number; session?: string } | null;
}) {
  const c = useCopy();
  const host = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  const [points, setPoints] = useState<TrendPoint[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const intraday = /^\d+[mh]$/.test(interval);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useVisiblePolling(refresh, 60_000, near && intraday);
  useEffect(() => {
    setPoints(null);
    setFailed(false);
  }, [symbol, period, interval, rangeKey]);
  useEffect(() => {
    if (!host.current) return;
    if (!("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setNear(entries.some((entry) => entry.isIntersecting));
      },
      { rootMargin: "200px" },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return;
    const controller = new AbortController();
    loadStockTrend(symbol, { period, interval }, controller.signal, revision > 0)
      .then((data) => {
        if (!controller.signal.aborted) {
          setFailed(false);
          setPoints(
            rangeKey && ["1Y", "QTD", "YTD"].includes(rangeKey)
              ? observationRange(data, rangeKey)
              : data,
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [symbol, period, interval, near, rangeKey, revision]);
  const oneDay = intraday && period === "1d";
  const effectivePoints = useMemo(() => {
    if (!points || !intraday) return points;
    const live = augmentTrendWithQuote(points, latestQuote);
    return oneDay ? currentTradingDay(live) : live;
  }, [points, latestQuote, intraday, oneDay]);
  const segments = useMemo(() => trendSegments(effectivePoints ?? []), [effectivePoints]);
  const change =
    effectivePoints && effectivePoints.length > 1
      ? effectivePoints[effectivePoints.length - 1].value - effectivePoints[0].value
      : 0;
  const stroke =
    change > 0
      ? "rgb(var(--positive))"
      : change < 0
        ? "rgb(var(--negative))"
        : "rgb(var(--muted-foreground))";
  // The first 1D point is the previous regular close; extended sessions read as a dimmer line.
  const baseline = oneDay && effectivePoints && effectivePoints.length > 1 ? segments[0] : null;
  const baselineY = baseline ? baseline.points.split(" ")[0].split(",")[1] : null;
  const extended = SESSION_ORDER.filter((session) =>
    segments.some((segment) => segment.session === session),
  );
  const sessionNames: Record<Exclude<TrendSession, "regular">, string> = {
    pre: c("pre-market", "盘前"),
    post: c("after hours", "盘后"),
    overnight: c("overnight", "夜盘"),
  };
  const label = `${c(`${symbol} ${rangeLabel} price trend`, `${symbol} ${rangeLabel}价格走势`)}${
    extended.length
      ? c(
          `, including ${extended.map((session) => sessionNames[session]).join(", ")}`,
          `，含${extended.map((session) => sessionNames[session]).join("、")}`,
        )
      : ""
  }`;
  return (
    <span
      ref={host}
      className="flex h-10 min-w-0 items-center justify-center"
      aria-busy={near && !points && !failed}
    >
      {segments.length ? (
        <svg
          role="img"
          aria-label={`${label} · ${change > 0 ? c("rising", "上升") : change < 0 ? c("falling", "下降") : c("unchanged", "持平")}`}
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="h-9 w-full overflow-visible"
        >
          {baselineY && (
            <line
              x1="0"
              x2="100"
              y1={baselineY}
              y2={baselineY}
              stroke="rgb(var(--muted-foreground))"
              strokeOpacity="0.45"
              strokeWidth="1"
              strokeDasharray="1 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {segments.map((segment, index) => (
            <polyline
              key={index}
              points={segment.points}
              fill="none"
              stroke={stroke}
              strokeOpacity={segment.session === "regular" ? 1 : 0.5}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      ) : failed || points ? (
        <span
          className="text-xs text-muted-foreground"
          aria-label={c(`${symbol} trend unavailable`, `${symbol}暂无走势`)}
        >
          —
        </span>
      ) : (
        <Skeleton className="h-7 w-full" />
      )}
    </span>
  );
}
