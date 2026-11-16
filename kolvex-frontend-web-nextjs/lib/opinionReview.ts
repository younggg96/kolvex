/**
 * How stocks moved after bullish and bearish creator opinions, across every opinion.
 * Facts only: no verdict on any call, no per-creator figure, no ranking. A group below the
 * sample threshold carries its count but no statistics, and the UI must not invent them.
 */

import { outcomeTone, signedPercent, type OutcomeTone } from "./opinionOutcome";
import { withSign } from "@/lib/format";

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
  /** Opinions whose stock beat the benchmark (snapshot v4+). */
  beat_count?: number;
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
    /** Directional opinions on the benchmark itself: listed, never in the statistics. */
    on_benchmark?: number;
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

type Translate = (key: string, p?: Record<string, string>) => string;

/** A band edge as a signed percent: "-20%", "0%", "+5%". */
const edge = (value: number) => withSign(value, (magnitude) => `${magnitude}%`);

/** A bar's excess-return band: "< -20%", "-20% ~ -15%", "0% ~ +5%", "≥ +20%". */
export function binLabel(bin: ReviewHistogramBin, t: Translate) {
  const { low, high } = bin;
  if (low === null && high !== null)
    return t("youtubeOpinions.review.relBelow", { value: edge(high) });
  if (high === null && low !== null)
    return t("youtubeOpinions.review.relAbove", { value: edge(low) });
  return t("youtubeOpinions.review.relRange", { low: edge(low ?? 0), high: edge(high ?? 0) });
}

/** Whether a call on the benchmark itself moved its way: excess return is meaningless there. */
export function callDirection(
  sentiment: ReviewSentiment,
  returnPct: number,
): "match" | "against" | "flat" {
  const direction = relativeDirection(returnPct);
  if (direction === "same") return "flat";
  return (direction === "more") === (sentiment === "bullish") ? "match" : "against";
}

/** The holding period as people say it: 5 sessions is a week, 20 a month. */
export function horizonLabel(days: number, t: Translate) {
  if (days === 5) return t("youtubeOpinions.review.horizonWeek");
  if (days === 20) return t("youtubeOpinions.review.horizonMonth");
  return t("youtubeOpinions.review.horizon", { days: String(days) });
}

export type RelativeDirection = "less" | "more" | "same";

/** Which way a stock-minus-benchmark figure points, at the one decimal shown. */
export function relativeDirection(value: number): RelativeDirection {
  const rounded = Math.round(value * 10) / 10;
  return rounded < 0 ? "less" : rounded > 0 ? "more" : "same";
}

/** Unsigned one-decimal percent, for sentences that carry the direction in words. */
export function magnitude(value: number): string {
  return `${Math.abs(Math.round(value * 10) / 10).toFixed(1)}%`;
}

/** How many opinions beat the benchmark; older snapshots only carry the share. */
export function beatCount(stats: ReviewStats): number | null {
  if (typeof stats.beat_count === "number") return stats.beat_count;
  if (typeof stats.beat_share_pct !== "number") return null;
  return Math.round((stats.beat_share_pct * stats.n) / 100);
}

/** Where 0% falls along the histogram, as a share of its width (bins at or below zero). */
export function zeroPosition(bins: ReviewHistogramBin[]): number {
  if (!bins.length) return 0.5;
  return bins.filter((bin) => bin.high !== null && bin.high <= 0).length / bins.length;
}

/**
 * Segment label. Confidence is a 0-1 score shown as a percent; strength is |direction score|.
 * Unknown values get their own label rather than being merged into a range.
 */
export function segmentLabel(
  segment: ReviewSegment,
  dimension: "confidence" | "strength",
  t: Translate,
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

/** One opinion behind a histogram bar: its source and what the price did. */
export interface ReviewBinOpinion {
  id: string;
  channel_id: string | null;
  channel_title: string | null;
  channel_avatar_url?: string | null;
  ticker: string;
  sentiment: ReviewSentiment;
  video_id: string | null;
  video_title: string | null;
  video_url: string | null;
  published_at: string | null;
  entry_date: string;
  return_pct: number;
  benchmark_return_pct: number;
  excess_return_pct: number;
}

export interface ReviewBinOpinions {
  horizon: number;
  sentiment: ReviewSentiment;
  low: number | null;
  high: number | null;
  total: number;
  opinions: ReviewBinOpinion[];
  as_of: string;
  benchmark: string;
}

export interface CreatorHalf {
  n: number;
  enough: boolean;
  mean_excess_pct?: number;
  beat_share_pct?: number;
}

export interface CreatorReviewGroup extends ReviewStats {
  early: CreatorHalf;
  late: CreatorHalf;
}

/** One creator's card. Below the gates only the history size is known. */
export interface CreatorReview {
  channel_id: string;
  channel_title?: string | null;
  counted: number;
  first_entry: string | null;
  last_entry: string | null;
  span_days: number;
  enough: boolean;
  /** Per horizon: the median entry date of the calls that horizon counts. */
  split_dates?: Record<string, string>;
  groups?: Record<string, Record<ReviewSentiment, CreatorReviewGroup>>;
  benchmark: string;
  horizons: number[];
  min_group: number;
  min_span_days: number;
  min_half: number;
  as_of: string;
  refreshing?: boolean;
}

/** Query string for the opinions behind one bar; open-ended edges are left out. */
export function binQuery(
  horizon: number,
  sentiment: ReviewSentiment,
  bin: ReviewHistogramBin,
): string {
  const params = new URLSearchParams({ horizon: String(horizon), sentiment });
  if (bin.low !== null) params.set("low", String(bin.low));
  if (bin.high !== null) params.set("high", String(bin.high));
  return params.toString();
}

/** What a stock and the benchmark did over one holding period after an opinion. */
export interface ReviewMove {
  return_pct: number;
  benchmark_return_pct: number;
  excess_return_pct: number;
}

/** A creator in the review page's picker. Activity only; no performance figure. */
export interface ReviewCreator {
  channel_id: string;
  channel_title: string | null;
  channel_avatar_url?: string | null;
  opinions: number;
  stocks: number;
}

export interface ReviewCreators {
  creators: ReviewCreator[];
  as_of: string;
  refreshing?: boolean;
}

/** One opinion of a creator; a horizon it has not reached yet is absent. */
export interface CreatorOpinion {
  id: string;
  channel_id: string;
  channel_title: string | null;
  channel_avatar_url?: string | null;
  ticker: string;
  sentiment: ReviewSentiment;
  video_id: string | null;
  video_title: string | null;
  video_url: string | null;
  published_at: string | null;
  entry_date: string;
  horizons: Record<string, ReviewMove>;
}

export interface CreatorOpinions {
  channel_id: string;
  channel_title: string | null;
  channel_avatar_url?: string | null;
  total: number;
  stocks: { ticker: string; count: number }[];
  opinions: CreatorOpinion[];
  benchmark: string;
  horizons: number[];
  as_of: string;
  refreshing?: boolean;
}

export type ReviewView = "all" | "creators";

/** The review page's view and creator from its query string. */
export function readReviewRoute(search: string): { view: ReviewView; creator: string | null } {
  const params = new URLSearchParams(search);
  const creator = params.get("creator") || null;
  const view = params.get("view") === "creators" || creator ? "creators" : "all";
  return { view, creator: view === "creators" ? creator : null };
}

/** Query string for a view; the default view keeps the URL clean. */
export function reviewRouteSearch(view: ReviewView, creator: string | null): string {
  if (view === "all") return "";
  const params = new URLSearchParams({ view });
  if (creator) params.set("creator", creator);
  return `?${params.toString()}`;
}
