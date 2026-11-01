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

export const metricLabels: Record<string, string> = {
  "Total Revenue": "营收",
  "Gross Profit": "毛利",
  "Operating Income": "营业利润",
  "Net Income": "净利润",
  "Basic EPS": "基本每股收益",
  "Diluted EPS": "摊薄每股收益",
  "Total Assets": "总资产",
  "Total Liabilities Net Minority Interest": "总负债",
  "Stockholders Equity": "股东权益",
  "Cash And Cash Equivalents": "现金及等价物",
  "Total Debt": "总债务",
  "Operating Cash Flow": "经营现金流",
  "Investing Cash Flow": "投资现金流",
  "Financing Cash Flow": "融资现金流",
  "Free Cash Flow": "自由现金流",
  "Capital Expenditure": "资本开支",
};
export const statementCore: Record<StatementKind, string[]> = {
  "income-statement": [
    "Total Revenue",
    "Gross Profit",
    "Operating Income",
    "Net Income",
    "Basic EPS",
    "Diluted EPS",
  ],
  "balance-sheet": [
    "Total Assets",
    "Total Liabilities Net Minority Interest",
    "Stockholders Equity",
    "Cash And Cash Equivalents",
    "Total Debt",
  ],
  "cash-flow": [
    "Operating Cash Flow",
    "Investing Cash Flow",
    "Financing Cash Flow",
    "Free Cash Flow",
    "Capital Expenditure",
  ],
};
export function statementKeys(
  rows: StatementPeriod[],
  kind: StatementKind,
  all = false,
) {
  const available = [
    ...new Set(
      rows.flatMap((row) => Object.keys(row).filter((key) => key !== "period")),
    ),
  ];
  const core = statementCore[kind].filter((key) => available.includes(key));
  return all || !core.length
    ? [...core, ...available.filter((key) => !core.includes(key))]
    : core;
}
export function statementCSV(rows: StatementPeriod[], keys: string[]) {
  return [
    ["Metric", ...rows.map((row) => row.period)].map(csvCell).join(","),
    ...keys.map((key) =>
      [
        key,
        ...rows.map((row) => (finite(row[key]) ? (row[key] as number) : null)),
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");
}
export type AnalystData = {
  current_price: number | null;
  target_mean_price: number | null;
  target_low_price: number | null;
  target_high_price: number | null;
  target_median_price?: number | null;
  number_of_analyst_opinions: number | null;
  recommendations_summary: {
    period: string | null;
    strong_buy: number | null;
    buy: number | null;
    hold: number | null;
    sell: number | null;
    strong_sell: number | null;
  }[];
  recommendations?: {
    date?: string;
    firm?: string;
    from_grade?: string;
    to_grade?: string;
    action?: string;
  }[];
};

/** Compact display only; exports and accessibility retain the exact source value. */
export function financialNumber(value: unknown): string {
  if (!finite(value)) return "—";
  for (const [size, unit] of [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
  ] as const) {
    if (Math.abs(value) >= size)
      return `${(value / size).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unit}`;
  }
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
