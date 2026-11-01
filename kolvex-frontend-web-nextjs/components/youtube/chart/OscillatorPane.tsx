"use client";

import { useId, useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PriceBar } from "@/lib/stockApi";
import { indicatorMeta, kdj, macd, rsi, type Series } from "./indicators";

export type Oscillator = "kdj" | "macd" | "rsi";
export const oscillatorLabels: Record<Oscillator, string> = {
  kdj: "KDJ (9, 3, 3)", macd: "MACD (12, 26, 9)", rsi: "RSI (14)",
};

export default function OscillatorPane({ bars, kind, onChange, width, axisWidth, start, end, active, onActive, t }: {
  bars: PriceBar[];
  kind: Oscillator;
  onChange: (kind: Oscillator | null) => void;
  width: number;
  axisWidth: number;
  start: number;
  end: number;
  active: number | null;
  onActive: (index: number | null) => void;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const clip = useId();
  const data = useMemo(() => {
    const closes = bars.map(bar => bar.close);
    if (kind === "rsi") return { lines: [{ name: "RSI", values: rsi(closes), color: indicatorMeta.ema20.color }], histogram: null };
    if (kind === "macd") {
      const values = macd(closes);
      return { lines: [{ name: "DIF", values: values.dif, color: indicatorMeta.ema50.color }, { name: "DEA", values: values.dea, color: "rgb(var(--chart-level))" }], histogram: values.histogram };
    }
    const values = kdj(bars);
    return { lines: [{ name: "K", values: values.k, color: indicatorMeta.ema50.color }, { name: "D", values: values.d, color: "rgb(var(--chart-level))" }, { name: "J", values: values.j, color: indicatorMeta.ema20.color }], histogram: null };
  }, [bars, kind]);
  const first = Math.max(0, Math.floor(start));
  const last = Math.min(bars.length - 1, Math.ceil(end) - 1);
  const plotWidth = Math.max(width - axisWidth, 1);
  const slot = plotWidth / Math.max(end - start, 1);
  const x = (i: number) => (i - start + 0.5) * slot;
  const values = [...data.lines.flatMap(line => line.values.slice(first, last + 1)), ...(data.histogram?.slice(first, last + 1) ?? [])].filter((v): v is number => v !== null && Number.isFinite(v));
  const min = Math.min(0, ...values);
  const max = Math.max(kind === "macd" ? 0 : 100, ...values);
  const pad = (max - min || 1) * 0.08;
  const low = min - pad, high = max + pad;
  const y = (v: number) => 8 + (high - v) / (high - low) * 84;
  const path = (series: Series) => {
    let result = "", pen = false;
    for (let i = Math.max(first - 1, 0); i <= Math.min(last + 1, bars.length - 1); i++) {
      const v = series[i];
      if (v === null || !Number.isFinite(v)) { pen = false; continue; }
      result += `${pen ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
      pen = true;
    }
    return result;
  };
  const selected = active ?? last;
  const thresholds = kind === "macd" ? [0] : kind === "rsi" ? [30, 70] : [20, 80];
  const label = bars[selected] ? `${bars[selected].date} · ${data.lines.map(line => `${line.name} ${line.values[selected]?.toFixed(2) ?? "—"}`).join(" · ")}` : "";
  return <section className="mt-2 shrink-0 border-t border-border pt-1" aria-label={t("youtubeOpinions.oscillators")}>
    <div className="flex min-w-0 flex-wrap items-center gap-x-3">
      <div role="group" aria-label={t("youtubeOpinions.oscillators")} className="flex items-center">
        {(["kdj", "macd", "rsi"] as const).map(value => <Button key={value} type="button" size="sm" variant="ghost" aria-pressed={kind === value} title={oscillatorLabels[value]} onClick={() => onChange(value)} className={kind === value ? "min-h-11 px-2 text-foreground underline underline-offset-4" : "min-h-11 px-2 text-muted-foreground"}>{value.toUpperCase()}</Button>)}
      </div>
      <span className="text-xs text-muted-foreground">{oscillatorLabels[kind]}</span>
      <Button type="button" variant="ghost" size="icon" className="ml-auto min-h-11 min-w-11" aria-label={t("youtubeOpinions.hideOscillator")} onClick={() => onChange(null)}><X className="h-4 w-4" aria-hidden="true" /></Button>
    </div>
    <div className="flex min-h-5 flex-wrap gap-x-3 text-xs tabular-nums" aria-live="off">
      {data.lines.map(line => <span key={line.name}><span style={{ color: line.color }}>{line.name}</span> {line.values[selected]?.toFixed(2) ?? "—"}</span>)}
      {data.histogram && <span>HIST {data.histogram[selected]?.toFixed(2) ?? "—"}</span>}
    </div>
    {!values.length ? <p role="status" className="flex h-24 items-center text-xs text-muted-foreground">{t("youtubeOpinions.indicatorWarmup")}</p> : <svg
      width="100%" height={100} viewBox={`0 0 ${Math.max(width, 1)} 100`} preserveAspectRatio="none"
      role="slider" tabIndex={0} aria-label={oscillatorLabels[kind]} aria-valuemin={first} aria-valuemax={Math.max(first, last)} aria-valuenow={Math.max(first, Math.min(selected, last))} aria-valuetext={label}
      className="block touch-pan-y focus-visible:bg-muted/30 focus-visible:outline-none"
      onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); const px = (event.clientX - rect.left) * width / rect.width; onActive(px > plotWidth ? null : Math.max(first, Math.min(Math.floor(start + px / slot), last))); }}
      onPointerLeave={() => onActive(null)} onBlur={() => onActive(null)}
      onKeyDown={event => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); onActive(Math.max(first, Math.min(selected + (event.key === "ArrowLeft" ? -1 : 1), last))); }}>
      <title>{label}</title>
      <defs><clipPath id={clip}><rect width={plotWidth} height={100} /></clipPath></defs>
      {thresholds.map(v => <g key={v}><line x1={0} x2={plotWidth} y1={y(v)} y2={y(v)} stroke="rgb(var(--border))" strokeDasharray="3 3" /><text x={plotWidth + 8} y={y(v) + 4} fontSize={11} fill="rgb(var(--muted-foreground))">{v}</text></g>)}
      <g clipPath={`url(#${clip})`}>
        {data.histogram?.slice(first, last + 1).map((v, offset) => v === null ? null : <rect key={first + offset} x={x(first + offset) - slot * 0.3} y={Math.min(y(0), y(v))} width={Math.max(1, slot * 0.6)} height={Math.max(0.5, Math.abs(y(v) - y(0)))} fill={v >= 0 ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))"} opacity={0.65} />)}
        {data.lines.map(line => <path key={line.name} d={path(line.values)} fill="none" stroke={line.color} strokeWidth={1.5} strokeLinejoin="round" />)}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={0} y2={100} stroke="rgb(var(--foreground) / 0.3)" strokeDasharray="3 3" />}
      </g>
    </svg>}
  </section>;
}
