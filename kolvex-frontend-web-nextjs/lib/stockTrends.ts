import { getStockHistory, type PriceBar, type PriceHistoryParams } from "./stockApi";

export interface TrendPoint {
  date: string;
  value: number;
}
type Job = { signal: AbortSignal; start: () => void; cancel: () => void };
const cache = new Map<string, { points: TrendPoint[]; expires: number }>();
const queue: Job[] = [];
let active = 0;

function pump() {
  while (active < 3 && queue.length) {
    const job = queue.shift()!;
    if (job.signal.aborted) {
      job.cancel();
      continue;
    }
    active++;
    job.start();
  }
}

export function trendPoints(bars: PriceBar[]): TrendPoint[] {
  return bars
    .filter(
      (bar) => Number.isFinite(bar.close) && bar.close > 0 && Number.isFinite(Date.parse(bar.date)),
    )
    .map((bar) => ({ date: bar.date, value: bar.close }))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export function augmentTrendWithQuote(
  points: TrendPoint[],
  quote?: { price?: number; time?: number; session?: string } | null,
): TrendPoint[] {
  if (
    !points.length ||
    !quote ||
    typeof quote.price !== "number" ||
    !Number.isFinite(quote.price) ||
    quote.price <= 0
  ) {
    return points;
  }
  const lastPoint = points[points.length - 1];
  const quoteTime = typeof quote.time === "number" ? new Date(quote.time * 1000) : null;
  if (quoteTime && quoteTime.getTime() > Date.parse(lastPoint.date)) {
    return [...points, { date: quoteTime.toISOString(), value: quote.price }];
  }
  return points;
}

/** Passive list previews: viewport-driven, cancellable, cached, and three requests at most. */
export function loadStockTrend(
  symbol: string,
  params: PriceHistoryParams,
  signal: AbortSignal,
  force = false,
): Promise<TrendPoint[]> {
  const isIntraday = /^\d+[mh]$/.test(params.interval ?? "");
  const effectiveParams: PriceHistoryParams = isIntraday ? { prepost: "true", ...params } : params;
  const key = JSON.stringify([
    symbol.trim().toUpperCase(),
    effectiveParams.period,
    effectiveParams.interval,
    effectiveParams.start,
    effectiveParams.end,
    effectiveParams.prepost,
  ]);
  if (signal.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  if (force) cache.delete(key);
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return Promise.resolve(saved.points);
  if (saved) cache.delete(key);
  return new Promise((resolve, reject) => {
    let started = false;
    const cancel = () => {
      if (started) return;
      const index = queue.indexOf(job);
      if (index >= 0) queue.splice(index, 1);
      signal.removeEventListener("abort", cancel);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const job: Job = {
      signal,
      cancel,
      start: () => {
        started = true;
        signal.removeEventListener("abort", cancel);
        getStockHistory(symbol, effectiveParams, signal, force)
          .then((bars) => {
            if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
            const points = trendPoints(bars);
            if (points.length < 2) throw new Error("Trend unavailable");
            if (cache.size >= 500) cache.delete(cache.keys().next().value!);
            cache.set(key, { points, expires: Date.now() + (isIntraday ? 60_000 : 300_000) });
            resolve(points);
          })
          .catch(reject)
          .finally(() => {
            active--;
            pump();
          });
      },
    };
    signal.addEventListener("abort", cancel, { once: true });
    queue.push(job);
    pump();
  });
}

export function trendPath(points: TrendPoint[]): string {
  if (points.length < 2) return "";
  const values = points.map((point) => point.value);
  const low = Math.min(...values),
    high = Math.max(...values);
  const span = high - low;
  return points
    .map(
      (point, index) =>
        `${(2 + (index / (points.length - 1)) * 96).toFixed(2)},${(span ? 34 - ((point.value - low) / span) * 28 : 20).toFixed(2)}`,
    )
    .join(" ");
}
