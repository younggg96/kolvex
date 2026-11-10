export interface Filing {
  form: string;
  accession: string;
  filed: string;
  period: string;
  description: string;
  source_url: string;
  items?: string[];
  earnings?: boolean;
}
export interface SecMeta {
  name: string;
  cik: number;
  fetched_at: string;
  source: string;
}
export interface FinancialRow {
  start: string;
  period: string;
  revenue?: number | null;
  gross_profit?: number | null;
  operating_income?: number | null;
  net_income?: number | null;
  eps_diluted?: number | null;
  operating_cash_flow?: number | null;
  capex?: number | null;
  free_cash_flow?: number | null;
  assets?: number | null;
  liabilities?: number | null;
  equity?: number | null;
  gross_margin?: number | null;
  operating_margin?: number | null;
  net_margin?: number | null;
  sources: Record<
    string,
    { source_url?: string; derived: boolean; inputs?: string[] }
  >;
}
export interface SecFinancials extends SecMeta {
  currency: string | null;
  annual: FinancialRow[];
  quarterly: FinancialRow[];
  ttm: FinancialRow | null;
}
export interface SecFilings extends SecMeta {
  filings: Filing[];
}
export interface InsiderTransaction {
  owner: string;
  position: string;
  security: string | null;
  date: string | null;
  filed: string;
  code: string | null;
  direction: string | null;
  shares: number | null;
  price: number | null;
  value: number | null;
  shares_after: number | null;
  ownership: string | null;
  amended: boolean;
  source_url: string;
}
export interface SecInsiders extends SecMeta {
  transactions: InsiderTransaction[];
  filings: Filing[];
  failed_filings: number;
  filing_limit: number;
}
export interface InstitutionManager {
  id: string;
  name: string;
  cik: number;
}
export interface Institution extends SecMeta {
  filing: Filing | null;
  previous_filing: Filing | null;
  partial: boolean;
  amendments: Filing[];
  holdings: {
    issuer: string;
    ticker?: string | null;
    class: string;
    cusip: string;
    put_call: string | null;
    share_type: string | null;
    shares: number | null;
    value: number | null;
    weight: number | null;
    change: number | null;
    change_percent: number | null;
    previous_shares: number | null;
    activity:
      "unknown" | "new" | "increased" | "reduced" | "unchanged" | "exited";
  }[];
}
export interface RevenueOutlook {
  source: string;
  currency: string | null;
  estimates: {
    period: string;
    average: number | null;
    low: number | null;
    high: number | null;
    analysts: number | null;
    year_ago: number | null;
    growth: number | null;
  }[];
}
export const freeResearchKey = (
  symbol: string,
  kind: "financials" | "filings" | "insiders" | "revenue-outlook",
) => `/api/market/free-research/${encodeURIComponent(symbol)}/${kind}`;
export function secSourceUrl(value: string | undefined): string | undefined {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" &&
      url.hostname === "www.sec.gov" &&
      url.pathname.startsWith("/Archives/edgar/data/") &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

const DAY = 86_400_000;
const finiteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const ratio = (a: unknown, b: unknown) =>
  finiteNumber(a) && finiteNumber(b) && b > 0 ? a / b : null;

export const institutionKey = (manager: string) =>
  `/api/market/free-research/institutions/${encodeURIComponent(manager)}`;
export const INSTITUTIONS_KEY = "/api/market/free-research/institutions";
export const institutionSummaryKey = (manager: string) =>
  `${institutionKey(manager)}/summary`;
export type HoldingActivity = Institution["holdings"][number]["activity"];
export interface InstitutionSummary {
  id: string;
  name: string;
  cik: number;
  filing: Filing | null;
  previous_filing: Filing | null;
  partial: boolean;
  positions: number;
  value: number;
  changes: {
    new: number;
    increased: number;
    reduced: number;
    exited: number;
  } | null;
  top: {
    issuer: string;
    ticker?: string | null;
    class: string;
    cusip: string;
    put_call: string | null;
    value: number | null;
    weight: number | null;
    activity: HoldingActivity;
  }[];
}

/** Calendar quarter of a 13F reporting period, e.g. 2026-06-30 → { year: 2026, quarter: 2 }. */
export function reportingQuarter(period: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})/.exec(period ?? "");
  return match
    ? { year: Number(match[1]), quarter: Math.ceil(Number(match[2]) / 3) }
    : null;
}

export interface FinancialRatios {
  revenue_growth: number | null;
  fcf_margin: number | null;
  roe: number | null;
  liabilities_to_equity: number | null;
}

/**
 * Ratios the filings support. Growth compares the same period a year earlier and is
 * omitted when that period is absent or not positive. ROE uses period-end equity and
 * needs a full year of income, so quarterly rows have none.
 */
export function financialRatios(
  row: FinancialRow,
  history: FinancialRow[],
  fullYear: boolean,
): FinancialRatios {
  const end = Date.parse(row.period);
  const yearAgo = history.find((other) => {
    const gap = (end - Date.parse(other.period)) / DAY;
    return gap >= 355 && gap <= 375;
  });
  const prior = ratio(row.revenue, yearAgo?.revenue);
  return {
    revenue_growth: prior === null ? null : prior - 1,
    fcf_margin: ratio(row.free_cash_flow, row.revenue),
    roe: fullYear ? ratio(row.net_income, row.equity) : null,
    liabilities_to_equity: ratio(row.liabilities, row.equity),
  };
}

export const OPEN_MARKET_CODES = { buy: "P", sell: "S" } as const;

/** Only open-market purchases and sales count; grants, exercises and tax withholding do not signal a trade decision. */
export function insiderSummary(rows: InsiderTransaction[]) {
  const total = (code: string) =>
    rows
      .filter((row) => row.code === code)
      .reduce(
        (sum, row) => ({
          shares: sum.shares + (row.shares ?? 0),
          value: sum.value + (row.value ?? 0),
          count: sum.count + 1,
          incomplete: sum.incomplete || row.value === null,
        }),
        { shares: 0, value: 0, count: 0, incomplete: false },
      );
  const dates = rows
    .map((row) => row.date)
    .filter((date): date is string => Boolean(date))
    .sort();
  return {
    buys: total(OPEN_MARKET_CODES.buy),
    sells: total(OPEN_MARKET_CODES.sell),
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  };
}

const issuerName = (value: string) =>
  value
    .toUpperCase()
    .replace(/[.,/'&-]/g, " ")
    .replace(
      /\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PLC|HOLDINGS?|GROUP|CLASS|CL|NEW|THE|DEL)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

/** 13F rows carry no ticker. Exact normalized names only, so a miss never reads as "not held". */
export function sameIssuer(
  issuer: string | null | undefined,
  company: string | null | undefined,
): boolean {
  if (!issuer || !company) return false;
  const a = issuerName(issuer);
  return a.length > 0 && a === issuerName(company);
}

export const MAX_PEERS = 4;

export function parsePeers(
  value: string | null | undefined,
  symbol: string,
): string[] {
  const seen = new Set([symbol.toUpperCase()]);
  const peers: string[] = [];
  for (const raw of (value ?? "").split(",")) {
    const peer = raw.trim().toUpperCase();
    if (
      !/^[A-Z0-9][A-Z0-9.\-]{0,11}$/.test(peer) ||
      seen.has(peer) ||
      peers.length >= MAX_PEERS
    )
      continue;
    seen.add(peer);
    peers.push(peer);
  }
  return peers;
}

export interface ReturnSeriesPoint {
  date: string;
  value: number;
}

/**
 * Rebases each series to 0% at the first date every series has, so all lines share a
 * start. A later-listed company shortens the window instead of being compared unfairly.
 */
export function rebasedReturns(series: Record<string, ReturnSeriesPoint[]>) {
  const symbols = Object.keys(series).filter(
    (symbol) => series[symbol].length > 0,
  );
  if (!symbols.length)
    return {
      start: null as string | null,
      rows: [] as ({ date: string } & Record<string, number | string | null>)[],
      totals: {} as Record<string, number>,
    };
  const sorted = Object.fromEntries(
    symbols.map((symbol) => [
      symbol,
      series[symbol]
        .filter((point) => finiteNumber(point.value) && point.value > 0)
        .map((point) => ({ date: point.date.slice(0, 10), value: point.value }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    ]),
  );
  const live = symbols.filter((symbol) => sorted[symbol].length > 0);
  const start = live
    .map((symbol) => sorted[symbol][0].date)
    .sort()
    .at(-1)!;
  const rows = new Map<
    string,
    { date: string } & Record<string, number | string | null>
  >();
  const totals: Record<string, number> = {};
  for (const symbol of live) {
    const points = sorted[symbol].filter((point) => point.date >= start);
    if (!points.length) continue;
    const base = points[0].value;
    for (const point of points) {
      const row = rows.get(point.date) ?? { date: point.date };
      row[symbol] = point.value / base - 1;
      rows.set(point.date, row);
    }
    totals[symbol] = points[points.length - 1].value / base - 1;
  }
  return {
    start,
    rows: [...rows.values()].sort((a, b) => a.date.localeCompare(b.date)),
    totals,
  };
}

/** A US-listed ADR quotes in USD but may report in TWD; the source's cross-currency ratios are not comparable. */
export function mixesCurrencies(
  quote: string | null | undefined,
  reporting: string | null | undefined,
): boolean {
  return Boolean(
    quote && reporting && quote.toUpperCase() !== reporting.toUpperCase(),
  );
}
