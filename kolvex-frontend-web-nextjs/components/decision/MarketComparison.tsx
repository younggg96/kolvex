"use client";

import Link from "next/link";
import { loadClientCache, peekClientCache } from "@/lib/clientCache";
import { loadMarketObservations } from "@/lib/marketObservationsApi";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PendingValue } from "@/components/ui/content-loading";
import { cn } from "@/lib/utils";
import { isMarketIndex, indexValue, type MARKET_GROUPS, type MarketInstrument } from "@/lib/marketBenchmarks";
import { COMPARISON_PERIODS, comparisonSnapshot, completedComparisonDate } from "@/lib/marketComparison";
import { loadStockTrend } from "@/lib/stockTrends";
import type { MarketObservation } from "@/lib/marketObservations";
import { money, useCopy } from "./shared";

function ComparisonRow({ instrument, attempt }: { instrument: MarketInstrument; attempt: number }) {
  const c = useCopy();
  const host = useRef<HTMLTableRowElement>(null);
  const [near, setNear] = useState(false);
  const cacheKey = `/market-comparison/${instrument.symbol}`;
  const [history, setHistory] = useState<MarketObservation[]>(() => peekClientCache<MarketObservation[]>(cacheKey) ?? []);
  const [state, setState] = useState<"loading" | "ready" | "error">(history.length ? "ready" : "loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!host.current) return;
    if (!("IntersectionObserver" in window)) { setNear(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  const lastAttempt = useRef([attempt, retry]);
  useEffect(() => {
    if (!near) return;
    const force = lastAttempt.current[0] !== attempt || lastAttempt.current[1] !== retry;
    lastAttempt.current = [attempt, retry];
    const controller = new AbortController();
    const saved = peekClientCache<MarketObservation[]>(cacheKey);
    setHistory(saved ?? []);
    setState(saved?.length ? "ready" : "loading");
    async function load(signal: AbortSignal): Promise<MarketObservation[]> {
      if (instrument.source === "fred") {
        return loadMarketObservations(instrument.symbol, signal, force);
      }
      return loadStockTrend(instrument.symbol, { period: "2y", interval: "1d" }, signal, force);
    }
    loadClientCache(cacheKey, async signal => {
      const points = await load(signal);
      if (!points.length) throw new Error("No history");
      return points;
    }, { ttl: 5 * 60_000, maxAge: 15 * 60_000, force, signal: controller.signal }).then(points => {
      if (controller.signal.aborted) return;
      if (!points.length) throw new Error("No history");
      setHistory(points);
      setState("ready");
    }).catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [instrument.source, instrument.symbol, attempt, retry, near, cacheKey]);

  const completedThrough = completedComparisonDate(instrument);
  const result = comparisonSnapshot(history.filter(point => point.date.slice(0, 10) <= completedThrough), instrument);
  const valueUnit = instrument.unit ?? (isMarketIndex(instrument.symbol) ? "points" : "usd");
  const name = c(instrument.en, instrument.zh);
  const unitLabel = result.unit === "pp" ? c("pp change", "百分点变化") : result.unit === "points" ? c("point change", "点数变化") : c("% change", "涨跌幅 %");
  const showValues = history.length > 0;
  return (
    <tr ref={host} aria-busy={state === "loading"} className="group transition-colors hover:bg-foreground/[0.06]">
      <th scope="row" className="sticky left-0 z-10 border-b border-r border-border/40 bg-card px-3 py-2.5 text-left align-middle font-normal transition-colors group-hover:border-foreground/25 group-hover:bg-card">
        <Link href={instrument.sourceUrl ?? `/dashboard/market/${encodeURIComponent(instrument.symbol)}`} target={instrument.sourceUrl ? "_blank" : undefined} rel={instrument.sourceUrl ? "noopener noreferrer" : undefined} className="block rounded-sm transition-colors hover:text-foreground focus-visible:outline-none">
          <span className="block truncate text-[0.8125rem] font-semibold" title={name}>{name}</span>
          <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">{instrument.symbol} · {showValues && result.date ? <time dateTime={result.date}>{result.date.slice(5)}</time> : "—"}</span>
        </Link>
        {state === "error" ? <Button size="xs" variant="ghost" className="mt-0.5 h-5 px-0 text-[0.6875rem]" aria-label={c(`Retry ${name} comparison`, `重试${name}对比数据`)} onClick={() => setRetry(value => value + 1)}>{c("Unavailable · Retry", "暂不可用 · 重试")}</Button> : instrument.note && instrument.source !== "fred" && <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground" title={c(instrument.note.en, instrument.note.zh)}>{c(instrument.note.en, instrument.note.zh)}</span>}
      </th>
      <td className="figure border-b border-border/40 px-3 py-3 text-right text-sm font-semibold">
        {state === "loading" ? <PendingValue className="h-5" /> : !showValues || result.value === null ? "—" : valueUnit === "percent" ? `${indexValue(result.value)}%` : valueUnit === "points" ? indexValue(result.value) : money(result.value)}
      </td>
      {COMPARISON_PERIODS.map(period => {
        const value = showValues ? result.changes[period.key] : null;
        const rounded = value === null ? null : Math.round(Math.abs(value) * 100) / 100;
        const direction = rounded ? value! > 0 ? 1 : -1 : 0;
        const unit = result.unit === "percent" ? "%" : result.unit === "pp" ? " pp" : c(" pts", " 点");
        return <td key={period.key} className="figure border-b border-border/40 px-3 py-3 text-right text-[0.8125rem] font-normal">
          {state === "loading" ? <PendingValue className="h-4" /> : value === null || rounded === null ? <span className="text-muted-foreground" aria-label={c("Insufficient data", "数据不足")}>—</span> : <span className={cn(direction > 0 ? "text-positive" : direction < 0 ? "text-negative" : "text-muted-foreground")} title={`${name} · ${c(period.en, period.zh)} · ${unitLabel}`}>{direction > 0 ? "+" : direction < 0 ? "−" : ""}{rounded.toFixed(2)}{unit}</span>}
        </td>;
      })}
    </tr>
  );
}

export default function MarketComparison({ groups, attempt }: { groups: readonly (typeof MARKET_GROUPS)[number][]; attempt: number }) {
  const c = useCopy();
  return (
    <div role="region" aria-label={c("Performance comparison, scroll horizontally", "多区间表现对比，可横向滚动")} tabIndex={0} className="min-w-0 overflow-x-auto overscroll-x-contain rounded-3xl border border-foreground/10 glass-card bg-card-glass pb-2 focus-visible:outline-none ">
      <table className="w-full min-w-[54rem] table-fixed sm:min-w-[60rem] border-separate border-spacing-0">
        <caption className="sr-only">{c("Daily closing values and simultaneous period changes", "最新日度收盘或观测值及各区间变动对比")}</caption>
        <colgroup><col className="w-[8.5rem] sm:w-[11.5rem]" /><col className="w-[7rem] sm:w-[8.25rem]" />{COMPARISON_PERIODS.map(period => <col key={period.key} />)}</colgroup>
        <thead className="text-xs text-muted-foreground"><tr>
          <th scope="col" className="sticky left-0 z-20 border-r border-border/40 bg-muted px-3 py-4 text-left font-medium">{c("Instrument / Date", "标的 / 日期")}</th>
          <th scope="col" className="bg-muted px-3 py-4 text-right font-medium">{c("Latest close", "最新收盘")}</th>
          {COMPARISON_PERIODS.map(period => <th scope="col" key={period.key} className="bg-muted px-3 py-4 text-right font-medium" title={period.key === "QTD" ? c("Quarter to date", "本季度至今") : period.key === "YTD" ? c("Year to date", "今年至今") : undefined}>{c(period.en, period.zh)}</th>)}
        </tr></thead>
        {groups.map(group => <tbody key={group.key}>
          <tr><th scope="rowgroup" colSpan={8} className="border-y border-border bg-muted/60 p-0 text-left"><span className="sticky left-0 inline-block px-3 py-3 text-sm font-semibold">{c(group.en, group.zh)}</span></th></tr>
          {group.instruments.map(instrument => <ComparisonRow key={instrument.symbol} instrument={instrument} attempt={attempt} />)}
        </tbody>)}
      </table>
    </div>
  );
}
