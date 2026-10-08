import { addDays, format, startOfYear, subDays, subMonths, subWeeks, subYears } from "date-fns";
import type { PriceHistoryParams } from "@/lib/stockApi";

export type AdvancedRange = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y" | "ALL";
export type ChartInterval = "5m" | "15m" | "1h" | "4h" | "1d" | "1wk" | "1mo";

export const advancedRanges: AdvancedRange[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"];

/** Intervals that give a readable number of bars for each range, within yfinance's intraday limits. */
export const rangeIntervals: Record<AdvancedRange, ChartInterval[]> = {
  "1D": ["5m", "15m", "1h"],
  "1W": ["5m", "15m", "1h", "4h"],
  "1M": ["15m", "1h", "4h", "1d"],
  "3M": ["1h", "4h", "1d"],
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
  YTD: "1d",
  "1Y": "1d",
  "5Y": "1wk",
  ALL: "1mo",
};

export const isIntraday = (interval: string) => /m$|h$/.test(interval) && interval !== "1mo";

const iso = (date: Date) => format(date, "yyyy-MM-dd");

/**
 * More history than the range is loaded so long EMAs are warmed up and the user can pan
 * back; yfinance caps 5m/15m at 60 days and hourly at 730 days.
 */
export function advancedHistoryParams(range: AdvancedRange, interval: ChartInterval): PriceHistoryParams {
  const tomorrow = iso(addDays(new Date(), 1));
  switch (interval) {
    case "5m":
    case "15m":
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

/** Earliest bar time shown when a range is first opened; null shows everything loaded. */
export function rangeStart(range: AdvancedRange, lastBarTime: number): number | null {
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
    case "YTD":
      return startOfYear(last).getTime();
    case "1Y":
      return subYears(last, 1).getTime();
    case "5Y":
      return subYears(last, 5).getTime();
    default:
      return null;
  }
}
