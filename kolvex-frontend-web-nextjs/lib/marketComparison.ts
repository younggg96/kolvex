import { marketCalendarDate, marketRangeBoundary, type MarketObservation } from "./marketObservations";
import type { MarketInstrument } from "./marketBenchmarks";

export const COMPARISON_PERIODS = [
  { key: "1D", en: "1D", zh: "1天" },
  { key: "1W", en: "1W", zh: "1周" },
  { key: "1M", en: "1M", zh: "1月" },
  { key: "1Y", en: "1Y", zh: "1年" },
  { key: "QTD", en: "QTD", zh: "QTD" },
  { key: "YTD", en: "YTD", zh: "YTD" },
] as const;
export type ComparisonPeriod = (typeof COMPARISON_PERIODS)[number]["key"];
export type ComparisonUnit = "percent" | "pp" | "points";

/** Skip the active daily candle: US sessions are complete by 17:00 New York; crypto days close at 00:00 UTC. */
export function completedComparisonDate(instrument: MarketInstrument, now = new Date()): string {
  const marketDay = marketCalendarDate(now);
  if (instrument.source === "fred") return marketDay;
  const crypto = instrument.symbol === "BTC-USD";
  const date = new Date(`${crypto ? now.toISOString().slice(0, 10) : marketDay}T00:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(now));
  if (crypto || hour < 17) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function monthAgo(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return date.toISOString().slice(0, 10);
}

/** One daily-close snapshot powers every column; no mixing intraday quotes with old closes. */
export function comparisonSnapshot(history: MarketObservation[], instrument: MarketInstrument, asOf = marketCalendarDate()) {
  const points = history.filter(point => Number.isFinite(point.value) && /^\d{4}-\d{2}-\d{2}/.test(point.date))
    .map(point => ({ date: point.date.slice(0, 10), value: point.value }))
    .filter(point => point.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = points.at(-1);
  const unit: ComparisonUnit = instrument.unit === "percent" ? "pp" : instrument.symbol === "^MOVE" ? "points" : "percent";
  const changes = {} as Record<ComparisonPeriod, number | null>;
  for (const { key } of COMPARISON_PERIODS) {
    let base: MarketObservation | undefined;
    if (latest && key === "1D") {
      base = points.at(-2);
      if (base && new Date(`${latest.date}T00:00:00Z`).getTime() - new Date(`${base.date}T00:00:00Z`).getTime() > 10 * 86400000) base = undefined;
    } else if (latest) {
      const calendar = key === "QTD" || key === "YTD";
      let cutoff = calendar || key === "1Y" ? marketRangeBoundary(key, latest.date, asOf)! : monthAgo(latest.date);
      if (key === "1W") {
        const date = new Date(`${latest.date}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() - 7);
        cutoff = date.toISOString().slice(0, 10);
      }
      // Quarter/year returns start at the last close before the new calendar period.
      // Rolling periods use the last close on or before the anniversary (holiday safe).
      if (!calendar || latest.date >= cutoff) {
        base = points.findLast(point => calendar ? point.date < cutoff : point.date <= cutoff);
        // Do not silently substitute a much older observation across source gaps.
        if (base && new Date(`${cutoff}T00:00:00Z`).getTime() - new Date(`${base.date}T00:00:00Z`).getTime() > 10 * 86400000) base = undefined;
      }
    }
    changes[key] = latest && base
      ? unit === "percent" ? (base.value === 0 ? null : (latest.value - base.value) / Math.abs(base.value) * 100) : latest.value - base.value
      : null;
  }
  return { value: latest?.value ?? null, date: latest?.date ?? null, unit, changes };
}
