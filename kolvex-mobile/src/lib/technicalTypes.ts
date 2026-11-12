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
    shape: "line" | "area" | "channel" | "pitchfork";
    direction: "bullish" | "bearish" | "neutral";
    points: AiChartPoint[];
  }[];
  operation?: "analysis" | "drawings";
  /** Kronos forecast saved with the analysis, so its band matches the text. */
  forecast?: import("./stockExtrasApi").KlineForecast | null;
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
    | "fibext"
    | "polyline"
    | "channel"
    | "pitchfork";
  /** `time` is epoch milliseconds, as the Web stores it (synced drawings are shared). */
  points: { time: number; price: number }[];
  color: string;
  label?: string;
  source?: "ai";
  /** AI layer the chart can toggle; manual drawings carry none and are always shown. */
  group?: DrawingGroup;
  /** Higher wins label space when labels collide (0–100). */
  priority?: number;
};
export type DrawingGroup =
  "plan" | "levels" | "trend" | "fib" | "zones" | "pattern";
export const drawingGroups: DrawingGroup[] = [
  "plan",
  "levels",
  "trend",
  "fib",
  "zones",
  "pattern",
];
export const drawingGroupLabels: Record<DrawingGroup, string> = {
  plan: "交易计划",
  levels: "支撑阻力",
  trend: "趋势线",
  fib: "斐波那契",
  zones: "区域",
  pattern: "形态",
};
/** Manual tools in the Web toolbar's order; polylines, channels and pitchforks are AI-only. */
export type DrawingTool =
  "cursor" | Exclude<Drawing["type"], "polyline" | "channel" | "pitchfork">;
export const drawingColors = [
  "rgb(41 98 255)",
  "rgb(245 158 11)",
  "rgb(168 85 247)",
  "rgb(var(--foreground))",
];
export type ChartVersion = {
  id: string;
  user_id: string;
  created_at: string;
  payload: AiTechnicalAnalysis;
  kind: string;
};
