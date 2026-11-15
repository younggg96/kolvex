/** What a stock did after a creator opinion. Facts only: the UI never says a call was right. */

export interface OpinionOutcomeHorizon {
  status: "scored" | "pending";
  exit_date?: string | null;
  return_pct?: number | null;
  benchmark_return_pct?: number | null;
  excess_return_pct?: number | null;
}

export interface OpinionOutcome {
  status: "scored" | "pending" | "no_price_data" | "no_publish_time";
  entry_date: string | null;
  entry_price: number | null;
  /** Entry open to the latest completed close; null before the first full session. */
  latest?: (OpinionOutcomeHorizon & { sessions: number }) | null;
  horizons: Record<string, OpinionOutcomeHorizon>;
}

export interface OpinionOutcomes {
  ticker: string;
  benchmark: string;
  horizons: number[];
  method_version: number;
  as_of: string | null;
  outcomes: Record<string, OpinionOutcome>;
}

export type OutcomeTone = "positive" | "negative" | "flat";

export interface OutcomeRow {
  /** "toDate" is the move so far, shown while a fixed holding period is still running. */
  kind: "horizon" | "toDate";
  days: number;
  /** Signed text such as "+3.2%". */
  stock: string;
  tone: OutcomeTone;
  /** Null when the benchmark move is unknown; it is never replaced by 0. */
  benchmark: string | null;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** One decimal with an explicit sign, so direction never depends on color alone. */
export function signedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0.0%";
  return `${rounded > 0 ? "+" : "-"}${Math.abs(rounded).toFixed(1)}%`;
}

export function outcomeTone(value: number): OutcomeTone {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? "positive" : rounded < 0 ? "negative" : "flat";
}

function row(kind: OutcomeRow["kind"], days: number, result?: OpinionOutcomeHorizon | null) {
  if (!result || result.status !== "scored" || !finite(result.return_pct)) return null;
  return {
    kind,
    days,
    stock: signedPercent(result.return_pct),
    tone: outcomeTone(result.return_pct),
    benchmark: finite(result.benchmark_return_pct)
      ? signedPercent(result.benchmark_return_pct)
      : null,
  } satisfies OutcomeRow;
}

/**
 * Finished holding periods, then one "so far" row while a period is still running.
 * Unfinished periods are left out rather than shown as zero.
 */
export function outcomeRows(outcome: OpinionOutcome, horizons: number[]): OutcomeRow[] {
  if (outcome.status !== "scored") return [];
  const rows: OutcomeRow[] = [];
  for (const days of horizons) {
    const finished = row("horizon", days, outcome.horizons[String(days)]);
    if (finished) rows.push(finished);
  }
  const latest = outcome.latest;
  if (rows.length < horizons.length && latest && finite(latest.sessions)) {
    const soFar = rows.some((item) => item.days === latest.sessions)
      ? null
      : row("toDate", latest.sessions, latest);
    if (soFar) rows.push(soFar);
  }
  return rows;
}
