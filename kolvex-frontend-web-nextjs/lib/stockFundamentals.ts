import type { StockOverview } from "./stockApi";

export type StatementKind = "income-statement" | "balance-sheet" | "cash-flow";
export type StatementPeriod = {
  period: string;
  [metric: string]: string | number | null;
};
export interface EarningsData {
  earnings_history: {
    quarter: string | null;
    eps_actual: number | null;
    eps_estimate: number | null;
    surprise_percent: number | null;
  }[];
  earnings_dates: {
    date: string | null;
    reported_eps: number | null;
    eps_estimate: number | null;
    surprise_percent: number | null;
  }[];
}
export const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
export function metricValue(
  row: StatementPeriod,
  keys: string[],
): number | null {
  for (const key of keys) if (finite(row[key])) return row[key] as number;
  return null;
}
export function sortPeriods(rows: StatementPeriod[]): StatementPeriod[] {
  return rows
    .filter(
      (row) =>
        row &&
        typeof row.period === "string" &&
        Number.isFinite(Date.parse(row.period)),
    )
    .sort((a, b) => Date.parse(b.period) - Date.parse(a.period));
}
/** Oldest to newest for chart reading; keep missing observations as gaps. */
export function statementTrend(rows: StatementPeriod[], metric: string) {
  return sortPeriods(rows)
    .reverse()
    .map((row) => ({
      period: row.period,
      value: finite(row[metric]) ? (row[metric] as number) : null,
    }));
}
export function financialChange(latest: unknown, previous: unknown) {
  if (!finite(latest) || !finite(previous)) return null;
  return {
    absolute: latest - previous,
    relative: previous > 0 ? (latest - previous) / previous : null,
  };
}
/** Compare reported EPS with its estimate, including zero and negative EPS. */
export function epsOutcome(actual: unknown, estimate: unknown) {
  if (!finite(actual) || !finite(estimate)) return null;
  const delta = Math.round((actual - estimate) * 100_000_000) / 100_000_000;
  return {
    kind:
      delta > 0
        ? ("beat" as const)
        : delta < 0
          ? ("miss" as const)
          : ("met" as const),
    delta,
  };
}
export function fundamentalsKey(
  symbol: string,
  kind: StatementKind | "earnings" | "analyst",
  quarterly = false,
) {
  return `/api/market/fundamentals/${encodeURIComponent(symbol)}/${kind}?quarterly=${quarterly}`;
}
export async function loadFundamentals<T>(
  key: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(key, { signal });
  if (!response.ok)
    throw Object.assign(new Error("Fundamentals unavailable"), {
      status: response.status,
    });
  return response.json();
}
export async function getStockOverview(
  symbol: string,
  signal?: AbortSignal,
): Promise<StockOverview> {
  const data = await loadFundamentals<StockOverview>(
    `/api/stocks?action=overview&symbol=${encodeURIComponent(symbol)}`,
    signal,
  );
  if (!data?.quote || !data.company || !data.financials)
    throw new Error("Invalid stock overview");
  return data;
}
// Yahoo's history uses fractional surprise; earnings_dates uses percentage points.
export function earningsRows(data: EarningsData) {
  const numeric = (value: unknown) => (finite(value) ? value : null);
  const dated = data.earnings_dates
    .filter((row) => row.date && Number.isFinite(Date.parse(row.date)))
    .map((row) => ({
      period: row.date!,
      actual: numeric(row.reported_eps),
      estimate: numeric(row.eps_estimate),
      surprise: numeric(row.surprise_percent),
    }));
  const history = data.earnings_history
    .filter((row) => row.quarter && Number.isFinite(Date.parse(row.quarter)))
    .map((row) => ({
      period: row.quarter!,
      actual: numeric(row.eps_actual),
      estimate: numeric(row.eps_estimate),
      surprise: finite(row.surprise_percent)
        ? row.surprise_percent * 100
        : null,
    }));
  const rows = dated.some((row) => finite(row.actual))
    ? dated
    : [...history, ...dated.filter((row) => row.actual === null)];
  return [...new Map(rows.map((row) => [row.period, row])).values()].sort(
    (a, b) => Date.parse(a.period) - Date.parse(b.period),
  );
}
export function csvCell(value: string | number | null): string {
  // Keep raw source labels from becoming spreadsheet formulas on export.
  const text = String(value ?? "");
  const safe =
    typeof value === "string" && /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
