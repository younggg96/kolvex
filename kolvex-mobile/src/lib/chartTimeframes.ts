// Ported from the Web's components/youtube/chart/timeframes.ts so both charts load the same history.
export type AdvancedRange =
  "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "ALL";
export type ChartInterval = "5m" | "15m" | "1h" | "4h" | "1d" | "1wk" | "1mo";

export const advancedRanges: AdvancedRange[] = [
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
export const rangeLabels: Record<AdvancedRange, string> = {
  "1D": "1日",
  "1W": "1周",
  "1M": "1月",
  "3M": "3月",
  "6M": "6月",
  YTD: "年初至今",
  "1Y": "1年",
  "5Y": "5年",
  ALL: "全部",
};
export const intervalLabels: Record<ChartInterval, string> = {
  "5m": "5分钟",
  "15m": "15分钟",
  "1h": "1小时",
  "4h": "4小时",
  "1d": "日线",
  "1wk": "周线",
  "1mo": "月线",
};

/** Intervals that give a readable number of bars for each range, within yfinance's intraday limits. */
export const rangeIntervals: Record<AdvancedRange, ChartInterval[]> = {
  "1D": ["5m", "15m", "1h"],
  "1W": ["5m", "15m", "1h", "4h"],
  "1M": ["15m", "1h", "4h", "1d"],
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

export const isIntraday = (interval: string) =>
  /m$|h$/.test(interval) && interval !== "1mo";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 86_400_000);

/**
 * More history than the range is loaded so long EMAs are warmed up and the reader can pan
 * back; yfinance caps 5m/15m at 60 days and hourly at 730 days.
 */
export function advancedHistoryQuery(
  range: AdvancedRange,
  interval: ChartInterval,
) {
  const params = new URLSearchParams({ interval });
  switch (interval) {
    case "5m":
    case "15m":
      params.set("period", "1mo");
      break;
    case "1h":
    case "4h":
      params.set("start", iso(addDays(new Date(), -725)));
      params.set("end", iso(addDays(new Date(), 1)));
      break;
    case "1d":
      params.set("period", range === "5Y" || range === "ALL" ? "max" : "5y");
      break;
    default:
      params.set("period", "max");
  }
  return params.toString();
}

/** Earliest bar time shown when a range is first opened; null shows everything loaded. */
export function rangeStart(
  range: AdvancedRange,
  lastBarTime: number,
): number | null {
  const last = new Date(lastBarTime);
  const months = (n: number) => {
    const d = new Date(last);
    d.setMonth(d.getMonth() - n);
    return d.getTime();
  };
  switch (range) {
    case "1D":
      return new Date(
        last.getFullYear(),
        last.getMonth(),
        last.getDate(),
      ).getTime();
    case "1W":
      return last.getTime() - 7 * 86_400_000;
    case "1M":
      return months(1);
    case "3M":
      return months(3);
    case "6M":
      return months(6);
    case "YTD":
      return new Date(last.getFullYear(), 0, 1).getTime();
    case "1Y":
      return months(12);
    case "5Y":
      return months(60);
    default:
      return null;
  }
}
