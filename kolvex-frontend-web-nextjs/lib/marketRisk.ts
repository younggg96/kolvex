/** Market Risk Monitor (experimental): API types and pure display helpers. */

export const MARKET_RISK_API_PREFIX = "/api/market-risk";

export type RiskLevel = "low" | "moderate" | "elevated" | "high" | "extreme";
export type RiskStage =
  "stable" | "stress_build_up" | "stress_acceleration" | "post_stress_normalization";
export type Freshness = "fresh" | "delayed" | "stale";
export type MetricStatus = "normal" | "watch" | "elevated" | "critical";
export type ChecklistStatus =
  "triggered" | "not_triggered" | "pending_confirmation" | "insufficient_data" | "disabled";

export const STAGE_ORDER: RiskStage[] = [
  "stable",
  "stress_build_up",
  "stress_acceleration",
  "post_stress_normalization",
];

export interface ScoreComponent {
  metric_key: string;
  dimension: string;
  weight: number;
  value: number;
  percentile: number;
  contribution: number;
  history_size: number;
}

export interface MetricRow {
  metric_key: string;
  name_en: string;
  name_zh: string;
  unit: "index_points" | "ratio";
  value: number | null;
  previous_value: number | null;
  previous_date: string | null;
  status: MetricStatus | null;
  bands: [number, number, number] | null;
  percentile: number | null;
  weight: number | null;
  contribution: number | null;
  quality: "valid" | "suspect" | null;
  latest_date: string | null;
  source: string;
  source_symbol: string;
}

export interface ChecklistItem {
  rule_key: string;
  rule_type: "escalation" | "recovery";
  status: ChecklistStatus;
  evaluated_on: string;
  first_triggered_on: string | null;
}

export interface StageEvent {
  effective_date: string;
  previous_stage: RiskStage | null;
  new_stage: RiskStage;
  risk_score: number | null;
  rules: string[];
}

export interface StageRules {
  build_up_enter: number;
  build_up_exit: number;
  acceleration_enter: number;
  acceleration_hold: number;
  min_stress_conditions: number;
  peak_window: number;
  peak_drop: number;
  min_recovery_conditions: number;
  confirm_sessions: number;
  confirm_normalized_to_stable: number;
}

export interface MarketRiskLatest {
  model_version: string;
  as_of: string;
  freshness: Freshness;
  data_source: "database" | "live";
  loaded_at: string;
  unscored_latest_date: string | null;
  score: {
    value: number;
    level: RiskLevel;
    previous_value: number | null;
    previous_date: string | null;
    confidence: "complete" | "partial";
    coverage: number;
    components: ScoreComponent[];
    history_window: number;
    min_history: number;
    inputs_hash: string;
  };
  stage: {
    current: RiskStage;
    since: string;
    pending: RiskStage | null;
    pending_sessions: number;
    sessions_to_confirm: number | null;
    stress_conditions: Record<string, boolean | null>;
    recovery_conditions: Record<string, boolean | null>;
    peak_score: number | null;
    rules: StageRules;
  };
  metrics: MetricRow[];
  checklist: ChecklistItem[];
  recent_events: StageEvent[];
  source_errors: Record<string, string>;
}

export interface HistoryPoint {
  date: string;
  score: number;
  stage: RiskStage;
  vix: number | null;
  vix9d: number | null;
  vix3m: number | null;
}

export type HistoryRange = "1M" | "3M" | "6M" | "1Y" | "3Y" | "MAX";
export const HISTORY_RANGES: HistoryRange[] = ["1M", "3M", "6M", "1Y", "3Y", "MAX"];

export interface MarketRiskHistory {
  model_version: string;
  range: HistoryRange;
  points: HistoryPoint[];
  events: StageEvent[];
}

/** Display tone for a risk level; text always accompanies the colour. */
export function levelTone(level: RiskLevel): "positive" | "muted" | "warning" | "negative" {
  if (level === "low") return "positive";
  if (level === "moderate") return "muted";
  if (level === "elevated") return "warning";
  return "negative";
}

export function stageTone(stage: RiskStage): "positive" | "warning" | "negative" | "muted" {
  if (stage === "stable") return "positive";
  if (stage === "stress_build_up") return "warning";
  if (stage === "stress_acceleration") return "negative";
  return "muted";
}

export function statusTone(
  status: MetricStatus | null,
): "positive" | "muted" | "warning" | "negative" {
  if (status === "normal") return "positive";
  if (status === "watch") return "muted";
  if (status === "elevated") return "warning";
  if (status === "critical") return "negative";
  return "muted";
}

/** Index points with two decimals, ratios with three. "—" when missing. */
export function formatMetric(value: number | null | undefined, unit: MetricRow["unit"]): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(unit === "ratio" ? 3 : 2);
}

/** Change vs the previous session in the metric's own units; null when either side is missing. */
export function metricChange(row: Pick<MetricRow, "value" | "previous_value">): number | null {
  if (row.value === null || row.previous_value === null) return null;
  return row.value - row.previous_value;
}

/** Contango when the 30-day index is below the 3-month one, backwardation when above. */
export function termStructureShape(
  vix: number | null | undefined,
  vix3m: number | null | undefined,
): "contango" | "backwardation" | "flat" | null {
  if (vix == null || vix3m == null) return null;
  if (Math.abs(vix - vix3m) < 0.005) return "flat";
  return vix > vix3m ? "backwardation" : "contango";
}

/** Contiguous runs of one stage, for the background bands on the history chart. */
export function stageSpans(points: Pick<HistoryPoint, "date" | "stage">[]) {
  const spans: { stage: RiskStage; start: string; end: string }[] = [];
  for (const point of points) {
    const last = spans[spans.length - 1];
    if (last && last.stage === point.stage) last.end = point.date;
    else spans.push({ stage: point.stage, start: point.date, end: point.date });
  }
  return spans;
}

async function request<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${MARKET_RISK_API_PREFIX}${endpoint}`, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(body.error || `Request failed: ${response.status}`), {
      status: response.status,
      code: typeof body.code === "string" ? body.code : undefined,
    });
  }
  return body as T;
}

export function fetchMarketRiskLatest(): Promise<MarketRiskLatest> {
  return request("/latest");
}

export function fetchMarketRiskHistory(range: HistoryRange): Promise<MarketRiskHistory> {
  return request(`/history?range=${range}`);
}
