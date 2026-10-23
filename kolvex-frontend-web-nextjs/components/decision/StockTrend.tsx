"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { loadStockTrend, trendPath, type TrendPoint } from "@/lib/stockTrends";
import { useCopy } from "./shared";

export default function StockTrend({ symbol, period, interval, rangeLabel }: { symbol: string; period: string; interval: string; rangeLabel: string }) {
  const c = useCopy();
  const host = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  const [points, setPoints] = useState<TrendPoint[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    if (!("IntersectionObserver" in window)) { setNear(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPoints(null);
    setFailed(false);
    if (!near) return;
    const controller = new AbortController();
    loadStockTrend(symbol, { period, interval }, controller.signal)
      .then(data => { if (!controller.signal.aborted) setPoints(data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [symbol, period, interval, near]);
  const path = useMemo(() => trendPath(points ?? []), [points]);
  const change = points && points.length > 1 ? points[points.length - 1].value - points[0].value : 0;
  const label = c(`${symbol} ${rangeLabel} price trend`, `${symbol} ${rangeLabel}价格走势`);
  return (
    <span ref={host} className="flex h-10 min-w-0 items-center justify-center" aria-busy={near && !points && !failed}>
      {path ? <svg role="img" aria-label={`${label} · ${change > 0 ? c("rising", "上升") : change < 0 ? c("falling", "下降") : c("unchanged", "持平")}`} viewBox="0 0 100 40" preserveAspectRatio="none" className="h-9 w-full overflow-visible">
        <polyline points={path} fill="none" stroke={change > 0 ? "rgb(var(--positive))" : change < 0 ? "rgb(var(--negative))" : "rgb(var(--muted-foreground))"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg> : failed || points ? <span className="text-xs text-muted-foreground" aria-label={c(`${symbol} trend unavailable`, `${symbol}暂无走势`)}>—</span> : <Skeleton className="h-7 w-full" />}
    </span>
  );
}
