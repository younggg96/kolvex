export type ActivitySession = "pre" | "intraday" | "post";
export type ActivitySentiment = "bullish" | "bearish" | "mixed";
export const ACTIVITY_SESSIONS: ActivitySession[] = ["pre", "intraday", "post"];

export interface ActivityMarket {
  call_premium: number; put_premium: number; net_premium: number;
  pc_premium_ratio: number | null; pc_baseline: number | null; baseline_runs: number;
  etf_net_premium: number; stock_net_premium: number; tickers_scanned: number;
}

export interface Contributor { symbol: string; is_etf: boolean; net_premium: number }

export interface ActivityContract {
  symbol: string; underlying: string; is_etf: boolean; type: "call" | "put";
  strike: number; expiration: string; dte: number; premium: number;
  volume: number; open_interest: number; vol_oi: number | null;
  price: number | null; last: number | null; iv: number | null; delta: number | null; otm_pct: number | null;
  flags: { new_positions: boolean; crosses_earnings: boolean };
}

export interface ActivityTicker {
  symbol: string; is_etf: boolean; spot: number | null; change_pct: number | null;
  call_premium: number; put_premium: number; net_premium: number;
  pc_premium_ratio: number | null; pc_baseline: number | null;
  implied_range: { expiration: string; low: number; high: number; pct: number; method: string } | null;
  max_pain: { expiration: string; strike: number } | null;
  gamma_level: { strike: number; gex: number; total_gex: number } | null;
  earnings_date: string | null;
}

export interface ActivitySummary {
  sentiment: ActivitySentiment; points_zh: string[]; points_en: string[];
  source: "ai" | "template"; model_id: string | null;
  /** Absent on runs saved before AI candidates existed. */
  candidates?: ActivityCandidates;
}

export interface ActivityCandidate extends Omit<ActivityContract, "last"> {
  thesis_zh: string; thesis_en: string;
  risk_zh: string; risk_en: string;
  invalidation_zh: string; invalidation_en: string;
  confidence: "low" | "medium" | "high";
}

export interface ActivityCandidates { status: "ok" | "unavailable"; items: ActivityCandidate[] }

export interface DayRun { id: string; trade_date: string; session: ActivitySession; run_at: string; data_date: string | null; market?: ActivityMarket }

export interface ActivityRun {
  id: string; trade_date: string; session: ActivitySession; run_at: string; data_date: string | null;
  universe_size: number; failed_symbols: string[];
  payload: {
    market: ActivityMarket;
    contributors: { positive: Contributor[]; negative: Contributor[]; positive_total: number; negative_total: number };
    contracts: ActivityContract[];
    tickers: ActivityTicker[];
  };
  summary: ActivitySummary | null;
  day_runs: DayRun[];
}

export interface RunList { date: string | null; dates: string[]; runs: DayRun[] }

export const runKey = (id: string | null) => `/api/market/options-activity/runs/${id ?? "latest"}`;
export const runsKey = (date: string | null) => `/api/market/options-activity/runs${date ? `?date=${date}` : ""}`;

/** "$12.3M" style; sign only when asked. */
export function formatPremium(value: number | null | undefined, signed = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = signed ? (value > 0 ? "+" : value < 0 ? "−" : "") : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const body = abs >= 1e9 ? `${(abs / 1e9).toFixed(2)}B` : abs >= 1e6 ? `${(abs / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${(abs / 1e3).toFixed(0)}K` : abs.toFixed(0);
  return `${sign}$${body}`;
}

/** Share of the largest magnitude, for bar widths. */
export const barShare = (value: number, max: number) => (max > 0 ? Math.min(1, Math.abs(value) / max) : 0);
