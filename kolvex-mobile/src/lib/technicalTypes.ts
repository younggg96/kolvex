import type { TechnicalCategory } from "./technicalFocus";
export type PriceBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};
export interface AiChartPoint {
  date: string;
  price: number;
}

export interface AiTechnicalAnalysis {
  provider?: string;
  model?: string;
  overlays?: {
    category: TechnicalCategory;
    status?: "pending" | "confirmed" | "failed" | "unconfirmed";
    level?: number;
    detected_at?: string;
    label: string;
    shape: "line" | "area";
    direction: "bullish" | "bearish" | "neutral";
    points: AiChartPoint[];
  }[];
  operation?: "analysis" | "drawings";
  categories?: TechnicalCategory[];
  custom_scenarios?: string[];
  findings?: {
    id: string;
    status: "available" | "unavailable";
    explanation: string;
  }[];
  version_id?: string;
  saved_at?: string;
  symbol: string;
  interval: string;
  view: { start: string; end: string };
  generated_at: string;
  indicators: Record<string, number | null>;
  trend: "uptrend" | "downtrend" | "sideways";
  bias: "bullish" | "bearish" | "neutral";
  summary: string;
  levels: {
    kind: "support" | "resistance";
    price: number;
    strength: "weak" | "medium" | "strong";
    reason: string;
  }[];
  trendlines: {
    kind: "support" | "resistance";
    start: AiChartPoint;
    end: AiChartPoint;
    reason: string;
  }[];
  fib: { from: AiChartPoint; to: AiChartPoint } | null;
  signals: string[];
  invalidation: string | null;
  setup?: {
    name: string;
    direction: "bullish" | "bearish";
    entry_low: number;
    entry_high: number;
    invalidation: number;
    targets: number[];
    reason: string;
    risk_reward: number;
    score: number | null;
    checks: Record<string, boolean | null>;
  } | null;
}

export type Drawing = {
  id: string;
  type:
    | "trend"
    | "ray"
    | "hline"
    | "rect"
    | "fib"
    | "measure"
    | "vline"
    | "extended"
    | "fibext";
  points: { time: number; price: number }[];
  color: string;
  label?: string;
  source?: "ai";
};
export type ChartVersion = {
  id: string;
  user_id: string;
  created_at: string;
  payload: AiTechnicalAnalysis;
  kind: string;
};
