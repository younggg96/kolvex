/**
 * Time-range → market-data contract for the price graph.
 *
 * The graph's range bar (1D … 全部 / 自定义) has to actually fetch history that covers the
 * chosen window. Today `PriceChart` always asks for yfinance's `3mo`, so picking 1D or 5Y
 * showed the same three months of bars. Everything here is pure and unit-tested from
 * `scripts/chart-range.test.cjs`.
 *
 * The keys deliberately match `PriceRangeKey` in `lib/chart/graph.ts`, so the same value can
 * be handed to the graph's range bar, to `windowStartFor` and to the fetcher. The advanced
 * chart's interval choices (`rangeIntervals`, `advancedHistoryParams`) live here too, so
 * there is one range module for both the compact and the advanced chart.
 */
import {
  addDays,
  differenceInCalendarDays,
  format,
  isAfter,
  startOfYear,
  subMonths,
  subDays,
  subWeeks,
  subYears,
} from "date-fns";
import type { PriceHistoryParams } from "@/lib/stockApi";
import type { PriceRangeKey } from "./graph";

/**
 * The range keys the graph offers are owned by `lib/chart/graph.ts` (`PriceRangeKey`), which
 * `PriceGraph` uses for its `range`/`rangeOptions` props. Aliased here so there is exactly one
 * union in the codebase — never two that could drift apart.
 */
export type PriceRange = PriceRangeKey;

/** Every preset range; only a custom window is not one. */
export type AdvancedRange = Exclude<PriceRange, "CUSTOM">;

/** Ranges offered by the graph, in bar order. */
export const priceRanges: AdvancedRange[] = [
  "1D",
  "1W",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "5Y",
  "ALL",
];

/** True for a preset range (anything but a custom window or an unknown value). */
export function isPresetRange(value: string | null | undefined): value is AdvancedRange {
  return (priceRanges as string[]).includes(value ?? "");
}

/** Longest span (days) still fetched at daily resolution for a custom window. */
const CUSTOM_DAILY_LIMIT = 400;
/** Fallback when a custom window is incomplete or invalid. */
const FALLBACK: PriceHistoryParams = { period: "3mo", interval: "1d" };

export interface HistoryParamsOptions {
  /** "yyyy-MM-dd" custom window start (CUSTOM only). */
  customFrom?: string;
  /** "yyyy-MM-dd" custom window end (CUSTOM only). */
  customTo?: string;
  /** Injectable clock; defaults to now. */
  today?: Date;
}

const iso = (date: Date) => format(date, "yyyy-MM-dd");

/** "yyyy-MM-dd" (or any Date-parseable string) at local midnight, or null when unusable. */
function parseDay(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * yfinance parameters that cover the selected window.
 *
 * Intervals are chosen so the window reads as a line rather than a couple of dots: intraday
 * for 1D/1W (yfinance keeps 5m only for 60 days and 15m for 60 days), daily up to 1Y, weekly
 * for 5Y, monthly for everything.
 */
export function historyParamsFor(
  range: PriceRange,
  options: HistoryParamsOptions = {},
): PriceHistoryParams {
  const today = options.today ?? new Date();
  switch (range) {
    case "1D":
      return { period: "1d", interval: "5m" };
    case "1W":
      return { period: "5d", interval: "15m" };
    case "1M":
      return { period: "1mo", interval: "1d" };
    case "3M":
      return { period: "3mo", interval: "1d" };
    case "6M":
      return { period: "6mo", interval: "1d" };
    case "YTD":
      return { period: "ytd", interval: "1d" };
    case "1Y":
      return { period: "1y", interval: "1d" };
    case "5Y":
      return { period: "5y", interval: "1wk" };
    case "ALL":
      return { period: "max", interval: "1mo" };
    case "CUSTOM": {
      const from = parseDay(options.customFrom);
      const to = parseDay(options.customTo) ?? parseDay(iso(today));
      if (!from || !to || isAfter(from, to)) return { ...FALLBACK };
      const span = differenceInCalendarDays(to, from);
      return {
        start: iso(from),
        end: iso(addDays(to, 1)),
        interval: span > CUSTOM_DAILY_LIMIT ? "1wk" : "1d",
      };
    }
    default:
      return { ...FALLBACK };
  }
}

/**
 * Sensible range when a page only knows the opinion window it is showing (or nothing at all):
 * the graph should open on a window comparable to the opinions, not always three months.
 */
export function defaultRangeForWindow(
  earliest: string | undefined,
  today: Date = new Date(),
): PriceRange {
  const start = parseDay(earliest);
  if (!start) return "3M";
  const span = differenceInCalendarDays(today, start);
  if (span <= 10) return "1W";
  if (span <= 45) return "1M";
  if (span <= 100) return "3M";
  if (span <= 200) return "6M";
  if (span <= 400) return "1Y";
  return "5Y";
}

/**
 * Earliest bar time (ms) that belongs to the selected range; null shows every loaded bar.
 * Used by both the compact and the advanced chart.
 */
export function windowStartFor(
  range: PriceRange,
  lastBarTime: number,
  customFrom?: string,
): number | null {
  const last = new Date(lastBarTime);
  switch (range) {
    case "1D":
      return new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime();
    case "1W":
      return subWeeks(last, 1).getTime();
    case "1M":
      return subMonths(last, 1).getTime();
    case "3M":
      return subMonths(last, 3).getTime();
    case "6M":
      return subMonths(last, 6).getTime();
    case "YTD":
      return startOfYear(last).getTime();
    case "1Y":
      return subYears(last, 1).getTime();
    case "5Y":
      return subYears(last, 5).getTime();
    case "CUSTOM": {
      const from = parseDay(customFrom);
      return from ? from.getTime() : null;
    }
    default:
      return null;
  }
}

/** Start the 1D view before the most recent cash session without discarding chart history. */
export function extendedDayStart(dates: string[], interval: string): number | null {
  const minutes = Number.parseInt(interval, 10) * (interval.endsWith("h") ? 60 : 1);
  const regularDay = dates
    .findLast((date) => {
      const hours = Number(date.slice(11, 13)) * 60 + Number(date.slice(14, 16));
      return hours < 16 * 60 && hours + minutes > 9 * 60 + 30;
    })
    ?.slice(0, 10);
  const day = regularDay ? Date.parse(regularDay) : NaN;
  if (!Number.isFinite(day)) return null;
  const previous = new Date(day - 86_400_000).toISOString().slice(0, 10);
  const first = dates.find((date) => date.slice(0, 16) >= `${previous}T20:00`);
  return first ? Date.parse(first) : null;
}

/**
 * Extra history requested ahead of the window so a range is never cramped: yfinance
 * returns a handful of bars for `period: "1d"`, so the graph reserves scroll room instead.
 * Kept here so the graph and the fetcher agree on the loaded span.
 */
export function rangeScrollDays(range: PriceRange): number {
  switch (range) {
    case "1D":
      return 1;
    case "1W":
      return 5;
    case "1M":
      return 30;
    case "6M":
      return 180;
    default:
      return 0;
  }
}

/** Earliest calendar day the selected range starts at, for labels and the custom picker. */
export function rangeStartDay(range: PriceRange, today: Date = new Date()): string | null {
  switch (range) {
    case "1D":
      return iso(today);
    case "1W":
      return iso(subDays(today, 7));
    case "1M":
      return iso(subMonths(today, 1));
    case "3M":
      return iso(subMonths(today, 3));
    case "6M":
      return iso(subMonths(today, 6));
    case "YTD":
      return iso(startOfYear(today));
    case "1Y":
      return iso(subYears(today, 1));
    case "5Y":
      return iso(subYears(today, 5));
    default:
      return null;
  }
}

/** The lowercase windows the Creator Opinions page has always used in its filters and URLs. */
export type LegacyRange = "1m" | "3m" | "6m" | "1y" | "all";

const LEGACY_TO_RANGE: Record<string, PriceRange> = {
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
  all: "ALL",
};

/**
 * Map a page-level filter value ("1m" … "all") onto the graph's range keys.
 *
 * The explorer keeps its existing lowercase filter values because they are already in share
 * links and drive the opinion query; only the boundary where they reach the graph is mapped.
 * Unknown or missing values fall back to `fallback` (3M by default).
 */
export function legacyRangeToPriceRange(
  value: string | undefined | null,
  fallback: PriceRange = "3M",
): PriceRange {
  if (!value) return fallback;
  return LEGACY_TO_RANGE[value] ?? LEGACY_TO_RANGE[value.toLowerCase()] ?? fallback;
}

/** Inverse of `legacyRangeToPriceRange`; null for windows the filters do not offer. */
export function priceRangeToLegacyRange(range: PriceRange): LegacyRange | null {
  switch (range) {
    case "1M":
      return "1m";
    case "3M":
      return "3m";
    case "6M":
      return "6m";
    case "1Y":
      return "1y";
    case "ALL":
      return "all";
    default:
      return null;
  }
}

/** Human label for a range: the localized range name, or the custom window's dates. */
export function rangeLabelFor(
  range: PriceRange,
  options: { customFrom?: Date; customTo?: Date; fallback: string },
): string {
  if (range !== "CUSTOM") return options.fallback;
  const { customFrom, customTo } = options;
  if (!customFrom) return options.fallback;
  return `${format(customFrom, "MMM d")} – ${format(customTo ?? new Date(), "MMM d")}`;
}

/* ---------------------------------------------------------------------------------------
 * Advanced chart: the user picks a bar interval inside the selected range.
 * ------------------------------------------------------------------------------------- */

export type ChartInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1wk" | "1mo";

/** Every interval the advanced chart offers, shortest first (the interval menu's order). */
export const CHART_INTERVALS: readonly ChartInterval[] = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
  "1wk",
  "1mo",
];

/** Intervals that give a readable number of bars for each range, within yfinance's intraday limits. */
export const rangeIntervals: Record<AdvancedRange, ChartInterval[]> = {
  "1D": ["1m", "5m", "15m", "30m", "1h"],
  "1W": ["1m", "5m", "15m", "30m", "1h", "4h"],
  "1M": ["5m", "15m", "30m", "1h", "4h", "1d"],
  "3M": ["1h", "4h", "1d"],
  "6M": ["1h", "4h", "1d", "1wk"],
  YTD: ["1h", "4h", "1d", "1wk"],
  "1Y": ["1h", "4h", "1d", "1wk"],
  "5Y": ["1d", "1wk", "1mo"],
  ALL: ["1d", "1wk", "1mo"],
};

export const defaultInterval: Record<AdvancedRange, ChartInterval> = {
  "1D": "5m",
  "1W": "15m",
  "1M": "1h",
  "3M": "1d",
  "6M": "1d",
  YTD: "1d",
  "1Y": "1d",
  "5Y": "1wk",
  ALL: "1mo",
};

/**
 * Picking an interval the current range can't hold moves to this range (TradingView-style:
 * the interval menu always lists every interval). 1m stays within yfinance's 7-day limit.
 */
export const rangeForInterval: Record<ChartInterval, AdvancedRange> = {
  "1m": "1D",
  "5m": "1D",
  "15m": "1W",
  "30m": "1W",
  "1h": "1M",
  "4h": "3M",
  "1d": "6M",
  "1wk": "5Y",
  "1mo": "ALL",
};

export const isIntraday = (interval: string) => /m$|h$/.test(interval) && interval !== "1mo";

/**
 * More history than the range is loaded so long EMAs are warmed up and the user can pan
 * back; yfinance caps 1m at 7 days, 5m–30m at 60 days and hourly at 730 days.
 */
export function advancedHistoryParams(
  range: AdvancedRange,
  interval: ChartInterval,
): PriceHistoryParams {
  const tomorrow = iso(addDays(new Date(), 1));
  switch (interval) {
    case "1m":
      return { interval, period: "5d" };
    case "5m":
    case "15m":
    case "30m":
      return { interval, period: "1mo" };
    case "1h":
    case "4h":
      return { interval, start: iso(subDays(new Date(), 725)), end: tomorrow };
    case "1d":
      return { interval, period: range === "5Y" || range === "ALL" ? "max" : "5y" };
    default:
      return { interval, period: "max" };
  }
}
