/**
 * How stocks moved after bullish and bearish creator opinions, across every opinion.
 * Facts only: no verdict on any call, no per-creator figure, no ranking. A group below the
 * sample threshold carries its count but no statistics, and the UI must not invent them.
 */

import { outcomeTone, signedPercent, type OutcomeTone } from "./opinionOutcome";

export type ReviewSentiment = "bullish" | "bearish";

export interface ReviewHistogramBin {
  low: number | null;
  high: number | null;
  count: number;
}

export interface ReviewStats {
  n: number;
  /** False below the sample threshold: only `n` is present. */
  enough: boolean;
  mean_excess_pct?: number;
  median_excess_pct?: number;
  beat_share_pct?: number;
  beat_share_ci?: [number, number];
  mean_return_pct?: number;
  mean_benchmark_pct?: number;
  histogram?: ReviewHistogramBin[];
}

export interface ReviewSegment extends ReviewStats {
  low: number | null;
  high: number | null;
  unknown?: boolean;
}

export interface ReviewGroup {
  overall: ReviewStats;
  confidence: ReviewSegment[];
  strength: ReviewSegment[];
}

export interface OpinionReview {
  method_version: number;
  benchmark: string;
  horizons: number[];
  min_group: number;
  as_of: string;
  built_at: string;
  refreshing?: boolean;
  counts: {
    opinions: number;
    after_dedupe: number;
    scored: number;
    bullish: number;
    bearish: number;
    neutral_or_mixed: number;
    no_price_data: number;
    no_publish_time: number;
    not_started: number;
  };
  groups: Record<string, Record<ReviewSentiment, ReviewGroup>>;
  market: {
    benchmark: { date: string; close: number }[];
    weekly_opinions: { week: string; bullish: number; bearish: number }[];
  };
}

export interface ReviewFigure {
  text: string;
  tone: OutcomeTone;
}

/** Signed one-decimal percent with its tone; direction is never carried by color alone. */
export function reviewFigure(value: number): ReviewFigure {
  return { text: signedPercent(value), tone: outcomeTone(value) };
}

/** "-20% to -15%", "below -20%", "20% or more" — the histogram's x labels. */
export function binLabel(
  bin: ReviewHistogramBin,
  t: (key: string, p?: Record<string, string>) => string,
) {
  if (bin.low === null && bin.high !== null)
    return t("youtubeOpinions.review.binBelow", { value: `${bin.high}%` });
  if (bin.high === null && bin.low !== null)
    return t("youtubeOpinions.review.binAbove", { value: `${bin.low}%` });
  return t("youtubeOpinions.review.binRange", { low: `${bin.low}%`, high: `${bin.high}%` });
}

/**
 * Segment label. Confidence is a 0-1 score shown as a percent; strength is |direction score|.
 * Unknown values get their own label rather than being merged into a range.
 */
export function segmentLabel(
  segment: ReviewSegment,
  dimension: "confidence" | "strength",
  t: (key: string, p?: Record<string, string>) => string,
) {
  if (segment.unknown) return t("youtubeOpinions.review.segmentUnknown");
  const scale = (value: number) =>
    dimension === "confidence" ? `${Math.round(value * 100)}%` : String(value);
  if (segment.low === null && segment.high !== null)
    return t("youtubeOpinions.review.segmentBelow", { value: scale(segment.high) });
  if (segment.high === null && segment.low !== null)
    return t("youtubeOpinions.review.segmentAbove", { value: scale(segment.low) });
  return t("youtubeOpinions.review.segmentRange", {
    low: scale(segment.low ?? 0),
    high: scale(segment.high ?? 0),
  });
}

/** Bar heights as a share of the tallest bin (0-1); an all-empty histogram stays flat. */
export function histogramHeights(bins: ReviewHistogramBin[]): number[] {
  const max = Math.max(0, ...bins.map((bin) => bin.count));
  return bins.map((bin) => (max ? bin.count / max : 0));
}

/** SVG polyline points for the benchmark closes inside a width x height box. */
export function benchmarkPath(points: { close: number }[], width: number, height: number): string {
  if (points.length < 2) return "";
  const closes = points.map((point) => point.close);
  const low = Math.min(...closes);
  const span = Math.max(...closes) - low || 1;
  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.close - low) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Percent change of the benchmark over the shown period, or null with too few points. */
export function benchmarkChange(points: { close: number }[]): number | null {
  if (points.length < 2 || !(points[0].close > 0)) return null;
  return (points[points.length - 1].close / points[0].close - 1) * 100;
}
