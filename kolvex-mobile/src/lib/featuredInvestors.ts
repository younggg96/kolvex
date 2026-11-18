import type { Institution } from "./freeResearch";

// Match by SEC CIK so an existing admin slug still links to the right filing.
export const FEATURED_INSTITUTIONS = [
  { cik: 1067983, en: "Buffett", zh: "巴菲特" },
  { cik: 1350694, en: "Bridgewater", zh: "桥水" },
  { cik: 1336528, en: "Ackman", zh: "阿克曼" },
  { cik: 1697748, en: "Cathie Wood", zh: "凯茜·伍德" },
  { cik: 1065521, en: "SoftBank", zh: "软银" },
  { cik: 2045724, en: "Leopold", zh: "Leopold" },
  { cik: 1759760, en: "Duan Yongping", zh: "段永平" },
  { cik: 1029160, en: "Soros", zh: "索罗斯" },
] as const;

export const RETURN_RANGES = ["1m", "3m", "6m", "ytd"] as const;
export type ReturnRange = (typeof RETURN_RANGES)[number];
const RANGE_MONTHS: Record<Exclude<ReturnRange, "ytd">, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
};

/** First day of the window that ends on `end` (YYYY-MM-DD): calendar months back, or Jan 1 for YTD. */
export function rangeStart(end: string, range: ReturnRange) {
  const [year, month, day] = end.split("-").map(Number);
  if (range === "ytd") return `${year}-01-01`;
  const back = new Date(Date.UTC(year, month - 1 - RANGE_MONTHS[range], 1));
  const last = new Date(
    Date.UTC(back.getUTCFullYear(), back.getUTCMonth() + 1, 0),
  ).getUTCDate();
  back.setUTCDate(Math.min(day, last));
  return back.toISOString().slice(0, 10);
}

export type ReturnPoint = { date: string; value: number; benchmark?: number };
export type AdjustedHistory = {
  prices: { date: string; adjusted_close: number }[];
};
export type PortfolioPerformance =
  | { status: "pending" | "insufficient"; points: [] }
  | {
      status: "ready";
      points: { date: string; value: number; benchmark: number }[];
      /** Same curve at daily closes for roughly the last 400 days. */
      daily?: { date: string; value: number; benchmark: number }[];
      coverage_min: number;
    };

export const PELOSI_TRADES_PATH =
  "/congress/trades?member=Pelosi&chamber=house&limit=20";
export type PelosiDisclosure = {
  id: number;
  member_name: string;
  ticker: string | null;
  trade_date: string;
  filed_date: string;
  direction: "buy" | "sell" | "exchange" | "other";
  amount_range: string | null;
  source_url: string | null;
};

export function pelosiDisclosures(rows: PelosiDisclosure[]) {
  return rows
    .filter(
      ({ member_name }) =>
        /\bNancy\b/i.test(member_name) && /\bPelosi\b/i.test(member_name),
    )
    .slice(0, 5);
}

export function houseDisclosureUrl(value: string | null) {
  return value &&
    /^https:\/\/disclosures-clerk\.house\.gov\/public_disc\/ptr-pdfs\/\d{4}\/\d+\.pdf$/i.test(
      value,
    )
    ? value
    : null;
}

export function stockReturnPath(ticker: string | null | undefined) {
  const symbol = ticker
    ?.trim()
    .toUpperCase()
    .replace(/\.([A-Z])$/, "-$1");
  return symbol && /^[A-Z0-9][A-Z0-9.\-]{0,11}$/.test(symbol)
    ? `/market/free-research/${encodeURIComponent(symbol)}/stock-returns`
    : null;
}

type Position = {
  cusip: string;
  issuer: string;
  ticker: string | null;
  value: number;
};

export function featuredHoldings(holdings: Institution["holdings"]) {
  const positions = new Map<string, Position>();
  for (const row of holdings) {
    const value = row.value;
    if (
      row.activity === "exited" ||
      row.share_type !== "SH" ||
      row.put_call ||
      !row.cusip ||
      value === null ||
      !Number.isFinite(value) ||
      value <= 0
    )
      continue;
    const current = positions.get(row.cusip);
    positions.set(row.cusip, {
      cusip: row.cusip,
      issuer: current?.issuer ?? row.issuer,
      ticker: current?.ticker ?? row.ticker ?? null,
      value: (current?.value ?? 0) + value,
    });
  }
  const rows = Array.from(positions.values());
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((row) => ({ ...row, weight: row.value / total }));
}

export function stockReturnPoints(
  history: AdjustedHistory,
  range: ReturnRange,
): ReturnPoint[] {
  const prices = new Map<string, number>();
  for (const { date, adjusted_close } of history.prices) {
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) &&
      Number.isFinite(adjusted_close) &&
      adjusted_close > 0
    ) {
      prices.set(date, adjusted_close);
    }
  }
  const dates = [...prices.keys()].sort();
  const end = dates.at(-1);
  if (!end) return [];
  const window = windowFrom(dates, rangeStart(end, range));
  const first = prices.get(window[0]);
  if (!first || window.length < 2) return [];
  return window.map((date) => ({
    date,
    value: (prices.get(date)! / first - 1) * 100,
  }));
}

/** Sorted dates from the last one before `start` (the base close) through the end. */
function windowFrom(dates: string[], start: string) {
  const first = dates.findIndex((day) => day >= start);
  if (first < 0) return [];
  return dates.slice(Math.max(first - 1, 0));
}

/**
 * The daily 13F model curve for one window, rebased so the base close is 0%.
 * Values come in as fractions since the curve start and go out as percents.
 */
export function portfolioReturnPoints(
  daily: { date: string; value: number; benchmark: number }[],
  range: ReturnRange,
): ReturnPoint[] {
  const rows = daily
    .filter(
      (row) =>
        /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
        Number.isFinite(row.value) &&
        Number.isFinite(row.benchmark) &&
        row.value > -1 &&
        row.benchmark > -1,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const end = rows.at(-1)?.date;
  if (!end) return [];
  const start = rangeStart(end, range);
  const firstIn = rows.findIndex((row) => row.date >= start);
  // Without a close before the window, the curve does not reach back far enough to cover it.
  if (firstIn < 1) return [];
  const window = rows.slice(firstIn - 1);
  const base = window[0];
  return window.map((row) => ({
    date: row.date,
    value: ((1 + row.value) / (1 + base.value) - 1) * 100,
    benchmark: ((1 + row.benchmark) / (1 + base.benchmark) - 1) * 100,
  }));
}
