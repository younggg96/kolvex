"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketInstrument } from "@/lib/marketBenchmarks";
import { MARKET_RANGES, type MarketObservation } from "@/lib/marketObservations";
import { loadMarketSeries, type MarketRangeKey } from "@/lib/marketSeries";
import { cn } from "@/lib/utils";
import { useCopy } from "./shared";

/** Five lines stay readable on a phone, and these slots pass the palette validator as a set. */
const SLOTS = [1, 2, 3, 4, 5] as const;
const slotColor = (slot: number) => `rgb(var(--compare-${slot}))`;
const percent = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;

type Loaded = { state: "loading" | "ready" | "error"; points: MarketObservation[] };
type Row = { t: number } & Record<string, number>;

function defaultSelection(instruments: readonly MarketInstrument[]) {
  const picks = instruments.filter(item => !item.daily).slice(0, 4);
  return Object.fromEntries(picks.map((item, index) => [item.symbol, SLOTS[index]])) as Record<string, number>;
}

function changeFromStart(points: MarketObservation[]) {
  const usable = points.filter(point => Number.isFinite(point.value));
  const base = usable[0]?.value;
  if (!base || usable.length < 2) return [];
  return usable.map(point => ({ t: Date.parse(point.date), value: (point.value / Math.abs(base) - Math.sign(base)) * 100 })).filter(point => Number.isFinite(point.t));
}

/** Sessions are sampled at different times, so each line holds its last value until its own series ends. */
function mergeRows(lines: { key: string; points: { t: number; value: number }[] }[]): Row[] {
  const times = Array.from(new Set(lines.flatMap(line => line.points.map(point => point.t)))).sort((a, b) => a - b);
  const cursors = lines.map(() => 0);
  return times.map(t => {
    const row = { t } as Row;
    lines.forEach((line, index) => {
      const last = line.points[line.points.length - 1];
      if (!last || t < line.points[0].t || t > last.t) return;
      while (cursors[index] + 1 < line.points.length && line.points[cursors[index] + 1].t <= t) cursors[index] += 1;
      row[line.key] = line.points[cursors[index]].value;
    });
    return row;
  });
}

function CompareChart({ instruments, range, attempt, label }: {
  instruments: readonly MarketInstrument[];
  range: MarketRangeKey;
  attempt: number;
  label: string;
}) {
  const c = useCopy();
  // A symbol keeps its slot while selected, so removing one line never repaints the others.
  const [selected, setSelected] = useState(() => defaultSelection(instruments));
  const [series, setSeries] = useState<Record<string, Loaded>>({});
  const [retry, setRetry] = useState(0);
  const intraday = range === "1D" || range === "1W";
  const blocked = (item: MarketInstrument) => range === "1D" && Boolean(item.daily);
  const active = instruments.filter(item => selected[item.symbol] && !blocked(item));
  const activeKey = active.map(item => item.symbol).join("|");

  const lastForce = useRef(`${attempt}/${retry}`);
  useEffect(() => {
    const controller = new AbortController();
    const forceKey = `${attempt}/${retry}`;
    const force = lastForce.current !== forceKey;
    lastForce.current = forceKey;
    active.forEach(item => {
      const key = `${item.symbol}/${range}`;
      setSeries(current => current[key]?.state === "ready" && !force ? current : { ...current, [key]: { state: "loading", points: current[key]?.points ?? [] } });
      loadMarketSeries(item, range, { force, signal: controller.signal }).then(points => {
        if (!controller.signal.aborted) setSeries(current => ({ ...current, [key]: { state: points.length > 1 ? "ready" : "error", points } }));
      }).catch(() => {
        if (!controller.signal.aborted) setSeries(current => ({ ...current, [key]: { state: "error", points: current[key]?.points ?? [] } }));
      });
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `activeKey` stands in for the instruments it lists.
  }, [activeKey, range, attempt, retry]);

  const lines = useMemo(() => active.flatMap(item => {
    const points = changeFromStart(series[`${item.symbol}/${range}`]?.points ?? []);
    return points.length ? [{ key: `s${selected[item.symbol]}`, slot: selected[item.symbol], item, points }] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activeKey, range, series, selected]);
  const rows = useMemo(() => mergeRows(lines), [lines]);
  const pending = active.some(item => series[`${item.symbol}/${range}`]?.state === "loading" || !series[`${item.symbol}/${range}`]);
  const failed = active.filter(item => series[`${item.symbol}/${range}`]?.state === "error");
  const atCap = Object.keys(selected).length >= SLOTS.length;

  const toggle = (symbol: string) => setSelected(current => {
    if (current[symbol]) {
      const next = { ...current };
      delete next[symbol];
      return next;
    }
    const used = new Set(Object.values(current));
    const slot = SLOTS.find(value => !used.has(value));
    return slot ? { ...current, [symbol]: slot } : current;
  });

  const formatTime = (t: number) => new Intl.DateTimeFormat(c("en-US", "zh-CN"), range === "1D"
    ? { hour: "2-digit", minute: "2-digit", hour12: false }
    : intraday ? { month: "2-digit", day: "2-digit" } : { month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(t);
  const formatFull = (t: number) => new Intl.DateTimeFormat(c("en-US", "zh-CN"), intraday
    ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }
    : { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(t);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-foreground/10 glass-card bg-card-glass p-3 sm:p-4">
      <div role="group" aria-label={c(`Choose instruments to compare, up to ${SLOTS.length}`, `选择对比标的，最多 ${SLOTS.length} 项`)} className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 pb-3 scrollbar-hide sm:-mx-4 sm:px-4 md:mx-0 md:flex-wrap md:px-0">
        {instruments.map(item => {
          const slot = selected[item.symbol];
          const off = blocked(item);
          const line = lines.find(entry => entry.item.symbol === item.symbol);
          const latest = line?.points[line.points.length - 1]?.value;
          return (
            <button
              key={item.symbol}
              type="button"
              aria-pressed={Boolean(slot) && !off}
              disabled={off || (!slot && atCap)}
              title={off ? c("Daily data has no intraday line. Choose a longer range.", "日度数据没有日内走势，请选择更长区间。") : undefined}
              onClick={() => toggle(item.symbol)}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-[0.8125rem] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40",
                slot && !off ? "border-foreground/25 bg-muted text-foreground" : "border-border text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
              )}
            >
              {slot && !off && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slotColor(slot) }} />}
              {c(item.en, item.zh)}
              {latest !== undefined && <span className="figure font-normal text-muted-foreground">{percent(latest)}</span>}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 touch-none select-none" aria-busy={pending} role="img" aria-label={c(`${label}, change since the start of the range`, `${label}，区间起点以来的涨跌幅对比`)}>
        {!active.length ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">{c("Choose at least one instrument.", "请至少选择一个标的。")}</p>
        ) : !rows.length && pending ? (
          <Skeleton className="h-full w-full" />
        ) : !rows.length ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">{c("Comparison data is unavailable.", "暂无可对比的数据。")}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeOpacity={0.6} />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={formatTime} tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "rgb(var(--border))" }} minTickGap={48} />
              <YAxis orientation="right" width={56} tickFormatter={value => percent(Number(value))} tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 12 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <ReferenceLine y={0} stroke="rgb(var(--foreground) / 0.3)" />
              <Tooltip
                isAnimationActive={false}
                cursor={{ stroke: "rgb(var(--foreground) / 0.25)", strokeWidth: 1 }}
                content={({ active: shown, payload }) => {
                  const row = payload?.[0]?.payload as Row | undefined;
                  if (!shown || !row) return null;
                  const entries = lines.filter(line => row[line.key] !== undefined).sort((a, b) => row[b.key] - row[a.key]);
                  return (
                    <div className="max-w-56 rounded-2xl border border-border bg-muted p-3 text-xs text-foreground shadow-md">
                      <p className="figure mb-2 text-muted-foreground">{formatFull(row.t)}</p>
                      <ul className="space-y-1.5">
                        {entries.map(line => (
                          <li key={line.key} className="flex items-center gap-2">
                            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slotColor(line.slot) }} />
                            <span className="min-w-0 flex-1 truncate">{c(line.item.en, line.item.zh)}</span>
                            <span className="figure font-medium">{percent(row[line.key])}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }}
              />
              {lines.map(line => (
                <Line key={line.key} dataKey={line.key} name={c(line.item.en, line.item.zh)} type="linear" stroke={slotColor(line.slot)} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: slotColor(line.slot), stroke: "rgb(var(--card))", strokeWidth: 2 }} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {failed.length > 0 && (
        <div role="status" className="mt-2 flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <p>{c(`${failed.map(item => item.en).join(", ")} unavailable.`, `${failed.map(item => item.zh).join("、")}暂不可用。`)}</p>
          <Button size="xs" variant="ghost" onClick={() => setRetry(value => value + 1)}>{c("Retry", "重试")}</Button>
        </div>
      )}
    </div>
  );
}

/** Opens on the page's range; changing it here leaves the page behind untouched. */
export default function MarketCompareDialog({ instruments, initialRange, attempt, title, onClose }: {
  instruments: readonly MarketInstrument[];
  initialRange: MarketRangeKey;
  attempt: number;
  title: string;
  onClose: () => void;
}) {
  const c = useCopy();
  const [range, setRange] = useState(initialRange);
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent layout="fullscreen" showCloseButton={false} className="flex flex-col gap-3 px-[16px] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] md:px-8">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <DialogTitle className="min-w-0 truncate pr-0 text-lg">{title} · {c("Compare", "对比")}</DialogTitle>
          <DialogClose asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label={c("Close comparison", "关闭对比")}><X className="h-4 w-4" aria-hidden /></Button>
          </DialogClose>
        </div>
        <SegmentedControl
          label={c("Chart range", "走势区间")}
          value={range}
          onChange={setRange}
          className="shrink-0 self-start overflow-x-auto border border-border scrollbar-hide max-md:!flex max-md:w-full max-md:!gap-0.5"
          itemClassName="!min-h-8 max-md:!flex-1 max-md:!px-1 max-md:!text-[0.8125rem]"
          options={MARKET_RANGES.map(item => ({ value: item.key, label: c(item.en, item.zh) }))}
        />
        <CompareChart instruments={instruments} range={range} attempt={attempt} label={title} />
        <DialogDescription className="shrink-0 text-xs leading-5 text-muted-foreground [@media(max-height:500px)]:hidden">
          {c("Each line starts at 0% at the beginning of the range. Yields and spreads show relative change in their level, not basis points.", "各线以区间起点为 0%。收益率和利差显示数值本身的相对变化，不是基点变动。")}
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
