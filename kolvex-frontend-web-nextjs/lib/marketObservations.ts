export interface MarketObservation { date: string; value: number }

export const MARKET_RANGES = [
  { key: "1D", period: "1d", interval: "5m", en: "1D", zh: "1天" },
  { key: "1W", period: "5d", interval: "30m", en: "1W", zh: "1周" },
  { key: "1M", period: "1mo", interval: "1d", en: "1M", zh: "1月" },
  { key: "3M", period: "3mo", interval: "1d", en: "3M", zh: "3月" },
  // Fetch beyond the boundary to retain the preceding close for the return.
  { key: "1Y", period: "2y", interval: "1d", en: "1Y", zh: "1年" },
  { key: "QTD", period: "2y", interval: "1d", en: "QTD", zh: "QTD" },
  { key: "YTD", period: "2y", interval: "1d", en: "YTD", zh: "YTD" },
] as const;

export function marketCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function marketRangeBoundary(range: string, latest: string, asOf = marketCalendarDate()): string | null {
  if (range === "YTD") return `${asOf.slice(0, 4)}-01-01`;
  if (range === "QTD") {
    const month = Math.floor((Number(asOf.slice(5, 7)) - 1) / 3) * 3 + 1;
    return `${asOf.slice(0, 4)}-${String(month).padStart(2, "0")}-01`;
  }
  if (range === "1Y") {
    const date = new Date(`${latest.slice(0, 10)}T00:00:00Z`);
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCFullYear(date.getUTCFullYear() - 1);
    date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate()));
    return date.toISOString().slice(0, 10);
  }
  return null;
}

export const FRED_MARKET_SERIES = ["DGS2", "DGS10", "BAMLH0A0HYM2"] as const;

/** Missing FRED observations are dots, never zero. Keep genuine zero/negative yields. */
export function parseMarketObservations(csv: string, series: string): MarketObservation[] {
  const rows = csv.trim().split(/\r?\n/).map(row => row.split(","));
  const header = rows.shift() ?? [];
  const dateColumn = header.findIndex(value => ["observation_date", "DATE"].includes(value.replace(/^\uFEFF/, "")));
  const valueColumn = header.indexOf(series);
  if (dateColumn < 0 || valueColumn < 0) throw new Error("Invalid FRED export");
  const points = new Map<string, number>();
  for (const row of rows) {
    const date = row[dateColumn];
    const raw = row[valueColumn]?.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !raw || raw === ".") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) points.set(date, value);
  }
  return [...points].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

/** Daily cards compare observations, and use the most recent release as the range end. */
export function observationRange(points: MarketObservation[], range: string, asOf = marketCalendarDate()): MarketObservation[] {
  if (range === "1D") return points.slice(-2);
  const latest = points.at(-1);
  if (!latest) return [];
  const boundary = marketRangeBoundary(range, latest.date, asOf);
  if (boundary) {
    const first = points.findIndex(point => point.date.slice(0, 10) >= boundary);
    // No release in this quarter/year yet: do not show the previous period's return.
    if (first < 0) return [];
    return points.slice(Math.max(0, first - 1));
  }
  const cutoff = new Date(`${latest.date.slice(0, 10)}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - (range === "1W" ? 7 : range === "1M" ? 31 : 93));
  return points.filter(point => point.date >= cutoff.toISOString().slice(0, 10));
}

export function marketRangeBaseline(points: MarketObservation[], range: string, asOf = marketCalendarDate()): number | undefined {
  const first = points[0];
  if (!first) return undefined;
  const boundary = marketRangeBoundary(range, points.at(-1)!.date, asOf);
  // A newly listed instrument without a prior close cannot provide a full-period return.
  return boundary && first.date.slice(0, 10) >= boundary ? undefined : first.value;
}
