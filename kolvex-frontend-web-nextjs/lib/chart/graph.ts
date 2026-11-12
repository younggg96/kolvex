/**
 * Shared contract for the stock price graph (`components/youtube/chart/PriceGraph.tsx`).
 *
 * The graph is one surface used by the compact preview (Creator Opinions page and the
 * stock workspace Technicals tab) and by the full-screen advanced chart. It owns geometry
 * only: scale padding, how many date ticks fit, what a range change should zoom to, and
 * the call-marker placement. Rendering stays in the component so the same helpers can be
 * unit-tested from `scripts/chart-graph-helpers.test.cjs`.
 */

/** Reference style: near-black plot, faint horizontal rules, price axis on the right. */
export const GRAPH_AXIS_WIDTH = 56;
export const GRAPH_TIME_AXIS = 26;
/** Top inner padding reserved for the high tag / call markers. */
export const GRAPH_TOP_PAD = 28;
/** Minimum number of source bars worth of horizontal zoom the graph allows. */
export const GRAPH_MIN_BARS = 8;

export type GraphView = { start: number; end: number };
export type PriceRangeKey = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "ALL" | "CUSTOM";

export interface ViewInput {
  /** Number of loaded bars. */
  count: number;
  /** Bar timestamps (ms). */
  times: number[];
  /** Required when `kind` is "anchor". */
  anchor?: { start: number; end: number; barsChange?: number } | null;
  /** How the user arrived at this range. */
  kind: "range" | "anchor";
  /** Range window start (ms) for the "range" kind; null means "all loaded bars". */
  rangeStart?: number | null;
  /** Minimum bars kept visible. */
  minBars?: number;
}

/**
 * First visible index for an explicit window. Returns 0 when nothing is out of range.
 * The window is snapped to the first bar at or after `startMs`.
 */
export function firstIndexAt(times: number[], startMs: number | null | undefined): number {
  if (!times.length || startMs === null || startMs === undefined || !Number.isFinite(startMs)) return 0;
  const index = times.findIndex(time => time >= startMs);
  return index === -1 ? 0 : index;
}

/**
 * The horizontal view a range selection produces.
 *
 * - "range": show the selected window; if the window is shorter than `minBars`, keep
 *   `minBars` visible by extending backwards.
 * - "anchor": an anchored window (opinion window / saved snapshot). `barsChange` extends
 *   the window by the same number of bars on both sides; `{-6, 0}` therefore adds six
 *   bars of context before the window.
 */
export function viewForRange(input: ViewInput): GraphView {
  const { count, times, kind, anchor, minBars = GRAPH_MIN_BARS } = input;
  if (count <= 0) return { start: 0, end: 1 };
  if (kind === "anchor" && anchor) {
    const start = firstIndexAt(times, anchor.start);
    const endIndex = times.findLastIndex(time => time <= anchor.end);
    const end = (endIndex === -1 ? count - 1 : endIndex) + 1 + (anchor.barsChange || 0);
    return clampGraphView({ start: start - (anchor.barsChange || 0), end }, count, minBars);
  }
  const first = firstIndexAt(times, input.rangeStart);
  const visibleCount = count - first;
  if (visibleCount >= Math.min(minBars, count)) return clampGraphView({ start: first, end: count }, count, minBars);
  return clampGraphView({ start: count - Math.min(minBars, count), end: count }, count, minBars);
}

function clampGraphSpan(span: number, count: number, minBars: number) {
  return Math.min(Math.max(span, Math.min(minBars, count)), count * 1.15 + 4);
}

/** Keep the view inside the data with a little scroll room, as Apple Stocks does while panning. */
export function clampGraphView(view: GraphView, count: number, minBars = GRAPH_MIN_BARS): GraphView {
  if (count <= 0) return { start: 0, end: 1 };
  const span = clampGraphSpan(view.end - view.start, count, minBars);
  const { min, max } = graphPanBounds(span, count);
  const start = Math.min(Math.max(view.start, min), max);
  return { start, end: start + span };
}

/** The range a view of `span` bars may start in: a little empty space before the first bar, and at least 30% of the window still showing data at the end. */
export function graphPanBounds(span: number, count: number) {
  return { min: -span * 0.1, max: count - Math.min(span * 0.3, count) };
}

/** Zoom around an anchor ratio (0 = left edge, 1 = right edge). */
export function zoomGraphView(view: GraphView, factor: number, anchorRatio: number, count: number, minBars = GRAPH_MIN_BARS): GraphView {
  const span = view.end - view.start;
  const anchor = view.start + span * anchorRatio;
  const nextSpan = clampGraphSpan(span * factor, count, minBars);
  return clampGraphView({ start: anchor - nextSpan * anchorRatio, end: anchor - nextSpan * anchorRatio + nextSpan }, count, minBars);
}

/** Indices whose date labels should be drawn: the visible window split into up to `maxTicks` even slots. */
export function dateTickIndices(view: GraphView, count: number, maxTicks = 6): number[] {
  const first = Math.max(Math.ceil(view.start), 0);
  const last = Math.min(Math.floor(view.end) - 1, count - 1);
  if (last < first) return [];
  const visible = last - first + 1;
  if (visible <= maxTicks) return Array.from({ length: visible }, (_, offset) => first + offset);
  const step = (visible - 1) / (maxTicks - 1);
  const ticks: number[] = [];
  for (let slot = 0; slot < maxTicks; slot++) {
    const index = Math.round(first + slot * step);
    if (!ticks.includes(index)) ticks.push(index);
  }
  return ticks;
}

/** Interior price rules; the high/low edges get their own labels instead. */
export function priceTickValues(lo: number, hi: number, target = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [];
  const raw = (hi - lo) / Math.max(target, 2);
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const step = (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
  const ticks: number[] = [];
  for (let value = Math.ceil(lo / step) * step; value <= hi; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return ticks;
}

/** Padded y domain so the line never touches the top tag or the zero baseline. */
export function priceDomain(
  bars: Array<{ close: number }>,
  view: GraphView,
  /** Extra prices the scale must include, e.g. a forecast band past the last bar. */
  extent?: { lo: number; hi: number } | null,
): { lo: number; hi: number } {
  const first = Math.max(Math.floor(view.start), 0);
  const last = Math.min(Math.ceil(view.end) - 1, bars.length - 1);
  let lo = Infinity;
  let hi = -Infinity;
  for (let index = first; index <= last; index++) {
    const close = bars[index]?.close;
    if (!Number.isFinite(close)) continue;
    lo = Math.min(lo, close);
    hi = Math.max(hi, close);
  }
  if (!Number.isFinite(lo)) return { lo: 0, hi: 1 };
  if (extent) {
    lo = Math.min(lo, extent.lo);
    hi = Math.max(hi, extent.hi);
  }
  const pad = (hi - lo || hi * 0.01 || 1) * 0.12;
  return { lo: lo - pad, hi: hi + pad };
}

/** Resize a linear price scale around a vertical anchor (0 = top, 1 = bottom). */
export function zoomPriceDomain(domain: { lo: number; hi: number }, factor: number, ratio: number, referenceSpan: number) {
  const span = domain.hi - domain.lo;
  const nextSpan = Math.min(Math.max(span * factor, referenceSpan / 100), referenceSpan * 100);
  const anchor = domain.hi - span * ratio;
  const hi = anchor + nextSpan * ratio;
  return { lo: hi - nextSpan, hi };
}

export type CallEntry = {
  index: number;
  bullish: number;
  bearish: number;
  other: number;
};

/** Vertical placement of a call marker so a cluster of calls never covers the price line. */
export function callMarkerOffset(direction: "up" | "down" | "dot", px = 4): number {
  if (direction === "up") return px;
  if (direction === "down") return -px;
  return px;
}
