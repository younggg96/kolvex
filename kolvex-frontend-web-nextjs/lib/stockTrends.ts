import { getStockHistory, type PriceBar, type PriceHistoryParams } from "./stockApi";

export type TrendSession = "regular" | "pre" | "post" | "overnight";

export interface TrendPoint {
  date: string;
  value: number;
  /** US extended-hours phase; absent when the bar's exchange clock is not New York. */
  session?: TrendSession;
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

const REGULAR_OPEN = 9 * 60 + 30;
const REGULAR_CLOSE = 16 * 60;
const NIGHT_OPEN = 20 * 60;
const EXTENDED_OPEN = 4 * 60;
const SESSIONS = new Set<TrendSession>(["regular", "pre", "post", "overnight"]);

/** Minutes after midnight on the New York clock, or null for other exchange offsets. */
function newYorkMinutes(date: string): number | null {
  const match = /T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(-0[45]:00)$/.exec(date);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function intervalLength(interval?: string): number {
  const match = /^(\d+)(m|h)$/.exec(interval ?? "");
  return match ? Number(match[1]) * (match[2] === "h" ? 60 : 1) : 0;
}

/** Session of a bar from its New York start time; a bar overlapping the open counts as regular. */
export function trendSession(
  date: string,
  interval?: string,
  hint?: string | null,
): TrendSession | undefined {
  if (hint === "overnight") return "overnight";
  const start = newYorkMinutes(date);
  if (start === null) return undefined;
  if (start >= NIGHT_OPEN || start < EXTENDED_OPEN) return "overnight";
  if (start + intervalLength(interval) <= REGULAR_OPEN) return "pre";
  if (start >= REGULAR_CLOSE) return "post";
  return "regular";
}

/** ISO time on the New York clock with its offset, so session parsing matches the bars. */
function newYorkIso(ms: number): string | null {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(new Date(ms))
        .map((part) => [part.type, part.value]),
    );
    const wall = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
    const offset = Math.round((Date.parse(`${wall}Z`) - Math.floor(ms / 1000) * 1000) / 60_000);
    if (offset !== -240 && offset !== -300) return null;
    return `${wall}-0${-offset / 60}:00`;
  } catch {
    return null;
  }
}

export function trendPoints(bars: PriceBar[], interval?: string): TrendPoint[] {
  return bars
    .filter(
      (bar) => Number.isFinite(bar.close) && bar.close > 0 && Number.isFinite(Date.parse(bar.date)),
    )
    .map((bar) => {
      const session = /^\d+[mh]$/.test(interval ?? "")
        ? trendSession(bar.date, interval, bar.session)
        : undefined;
      return session
        ? { date: bar.date, value: bar.close, session }
        : { date: bar.date, value: bar.close };
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

/** US trading day a New York bar belongs to: the 20:00 overnight session opens the next day. */
function tradingDay(point: TrendPoint): string | null {
  const minutes = newYorkMinutes(point.date);
  if (minutes === null) return null;
  const day = point.date.slice(0, 10);
  if (minutes < NIGHT_OPEN) return day;
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/**
 * One-day preview of the current US trading day — overnight, pre-market, regular and
 * after-hours — anchored on the previous regular-session close, so a pre-market move is
 * the whole line instead of a sliver after yesterday's session.
 */
export function currentTradingDay(points: TrendPoint[]): TrendPoint[] {
  const day = points.length ? tradingDay(points[points.length - 1]) : null;
  if (!day) return points;
  let first = points.length - 1;
  while (first > 0 && tradingDay(points[first - 1]) === day) first--;
  let anchor = first - 1;
  while (anchor >= 0 && points[anchor].session !== "regular") anchor--;
  const visible = anchor >= 0 ? [points[anchor], ...points.slice(first)] : points.slice(first);
  return visible.length >= 2 ? visible : points;
}

export interface TrendSegment {
  session: TrendSession;
  points: string;
}

/** The preview line split by session, each run joined to the previous run's last point. */
export function trendSegments(points: TrendPoint[]): TrendSegment[] {
  const coordinates = trendPath(points).split(" ");
  if (coordinates.length < 2) return [];
  const segments: Array<{ session: TrendSession; coordinates: string[] }> = [];
  points.forEach((point, index) => {
    const session = index === 0 ? (points[1].session ?? "regular") : (point.session ?? "regular");
    const current = segments[segments.length - 1];
    if (current && current.session === session) current.coordinates.push(coordinates[index]);
    else
      segments.push({
        session,
        coordinates:
          index > 0 ? [coordinates[index - 1], coordinates[index]] : [coordinates[index]],
      });
  });
  return segments
    .filter((segment) => segment.coordinates.length > 1)
    .map((segment) => ({ session: segment.session, points: segment.coordinates.join(" ") }));
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
    const local = newYorkIso(quoteTime.getTime());
    // The quote already names its session; an instant has no bar length to overlap the open.
    const session = local
      ? SESSIONS.has(quote.session as TrendSession)
        ? (quote.session as TrendSession)
        : trendSession(local)
      : undefined;
    // Keep the series on one clock: a US quote is written in New York time like the bars.
    const date = local && lastPoint.session ? local : quoteTime.toISOString();
    return [
      ...points,
      session && lastPoint.session
        ? { date, value: quote.price, session }
        : { date, value: quote.price },
    ];
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
            const points = trendPoints(bars, effectiveParams.interval);
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
