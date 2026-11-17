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

export const RETURN_RANGES = ["3m", "6m", "1y"] as const;
export type ReturnRange = (typeof RETURN_RANGES)[number];
const RANGE_DAYS: Record<ReturnRange, number> = {
  "3m": 90,
  "6m": 182,
  "1y": 365,
};

export type ReturnPoint = { date: string; value: number; benchmark?: number };
export type AdjustedHistory = {
  prices: { date: string; adjusted_close: number }[];
};
export type PortfolioPerformance =
  | { status: "pending" | "insufficient"; points: [] }
  | {
      status: "ready";
      points: { date: string; value: number; benchmark: number }[];
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
  const cutoff = Date.parse(end) - RANGE_DAYS[range] * 86_400_000;
  const window = dates.filter((day) => Date.parse(day) >= cutoff);
  const first = prices.get(window[0]);
  if (!first || window.length < 2) return [];
  return window.map((date) => ({
    date,
    value: (prices.get(date)! / first - 1) * 100,
  }));
}
