"use client";

/**
 * PriceGraph — the one stock line graph of Kolvex.
 *
 * Image 1 (what this replaces) drew a heavy 2.5px single-colour line, no fill, a boxed axis, six-plus
 * crowded date labels and a legend line under the plot. This follows the Finsepa / Apple-Stocks
 * reference instead: a quiet plot with no left axis and no frame, a soft gradient area under a
 * ~2px line, a faint dashed baseline at the price the window opened at, a right-hand axis with
 * small numerals, one quiet floating tag on the peak, the current price as a filled pill on the
 * axis, three or four short date labels and nothing else.
 *
 * The graph owns its controls so both hosts behave the same:
 *  - a range bar (`1D 1W 1M 3M 6M YTD 1Y 5Y All` + a custom chip) that shows ONLY the chosen
 *    window, with a short crossfade between the old and the new path (≤190ms) on change;
 *  - zoom (⌘/Ctrl + wheel, two-finger pinch) and pan (horizontal drag) with a double-click / double-tap
 *    reset; "Reset zoom" appears only while the view is modified;
 *  - scrub on hover or touch: a dashed guide, a dot on the line and a small pill tooltip that stays
 *    inside the plot;
 *  - creator-call triangles above / below the bar (▲ bullish, ▼ bearish, · neutral, with a count).
 *
 * Compact mode opens the advanced chart only from its "Advanced" button; the plot itself just
 * pans and scrubs. Advanced mode is a `role="slider"` the host
 * keyboard-scrubs through `activeIndex` / `onActiveChange`, and hosts candlesticks through
 * `renderPlot`, a drawing overlay, an oscillator pane and its own toolbar through the slots below.
 *
 * Exports used by the advanced chart, the oscillator pane and the drawing layer:
 *  - `PriceGraph` (default) — see `PriceGraphProps`;
 *  - `graphGeometry({ bars, times, view, width, height, intraday, interval, timeAxis, topPad })`;
 *  - `defaultGraphView({ count, times, rangeStart, anchor })` — the window a host starts from;
 *  - `GraphGeometry` — px columns plus `xOf / yOf / indexAt / timeAt / priceAt / toPx / barsBetween`.
 * Colors come from `rgb(var(--chart-up))` (green) and `rgb(var(--chart-down))` (red/orange).
 */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { LocateFixed, Maximize2, MoveHorizontal, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";
import { formatChangePercent, formatPrice, formatVolume, type PriceBar, type StockQuote } from "@/lib/stockApi";
import { latestChartQuote } from "@/lib/chart/quote";
import {
  GRAPH_AXIS_WIDTH,
  GRAPH_MIN_BARS,
  GRAPH_TIME_AXIS,
  GRAPH_TOP_PAD,
  clampGraphView,
  dateTickIndices,
  graphPanBounds,
  priceDomain,
  priceTickValues,
  viewForRange,
  zoomGraphView,
  type GraphView,
  type PriceRangeKey,
} from "@/lib/chart/graph";
import type { Anchor } from "../chartDrawings";
import type { StrengthTone } from "../strength";
import { CallMarker, ExtremeTag, PriceTag } from "./ChartMarkers";
import {
  SPRING_RESPONSE,
  VelocityTracker,
  animateSpring,
  projectRelease,
  rubberBandClamp,
  type SpringAnimation,
} from "@/lib/motion/spring";

type Translate = (key: string, params?: Record<string, string>) => string;
export type GraphMode = "compact" | "advanced";
export type CallCounts = { bullish: number; bearish: number; other: number };
export type PriceRangeOption = { value: PriceRangeKey; label: string; disabled?: boolean };
export type { GraphView, PriceRangeKey };

/** Wheel-zoom strength per px of trackpad scroll. */
const ZOOM_PER_PX = 0.0015;
const DRAG_THRESHOLD = 5;
/** One date label per this many px of plot, capped at four. */
const BARS_PER_LABEL = 84;
const FADE_MS = 190;
/** Creator-call markers closer than this many px merge into one. */
const CALL_MIN_GAP = 20;
const AXIS_BLOCK = { x: 0, y: 0, w: GRAPH_AXIS_WIDTH, h: 0 };

const toneColor: Record<StrengthTone, string> = {
  positive: "rgb(var(--chart-up))",
  negative: "rgb(var(--chart-down))",
  neutral: "rgb(var(--foreground) / 0.55)",
};

/* ------------------------------------------------------------------ geometry */

export interface GraphGeometry {
  width: number;
  height: number;
  /** Plot columns: `width - axisBlock.w` (the right axis is reserved). */
  plotWidth: number;
  /** Plot rows: `height - (timeAxis ?? GRAPH_TIME_AXIS)`. */
  plotHeight: number;
  /** Top of the price scale, inside the plot. */
  priceTop: number;
  /** Bottom of the price scale, inside the plot (the time axis row follows). */
  priceBottom: number;
  /** Width of the right price axis (GRAPH_AXIS_WIDTH). */
  axisWidth: number;
  /** Rows reserved under the plot for date labels (GRAPH_TIME_AXIS). */
  timeAxis: number;
  /** Box handed to ChartDrawingLayer: plot columns × price rows. */
  axisBlock: { x: number; y: number; w: number; h: number };
  view: GraphView;
  /** Highest visible value on the price scale. */
  priceHigh: number;
  /** Lowest visible value on the price scale. */
  priceLow: number;
  count: number;
  /** First / last whole bar inside the view (inclusive). */
  firstIndex: number;
  lastIndex: number;
  xOf: (index: number) => number;
  yOf: (price: number) => number;
  indexAt: (time: number) => number;
  timeAt: (index: number) => number;
  priceAt: (y: number) => number;
  /** Drawing anchor (time × price) to plot px. */
  toPx: (anchor: Anchor) => { x: number; y: number };
  /** Whole bars between two drawing anchors. */
  barsBetween: (a: Anchor, b: Anchor) => number;
}

/**
 * Pixel geometry shared by the line graph, the advanced candlesticks, indicators, the oscillator
 * pane and the drawing layer. The price scale is driven by the visible window; for daily, weekly
 * and monthly bars it spans the visible `close` values, otherwise the visible `high`/`low`.
 */
export function graphGeometry({
  bars,
  times,
  view,
  width,
  height,
  intraday = false,
  interval = "1d",
  timeAxis = GRAPH_TIME_AXIS,
  topPad = GRAPH_TOP_PAD,
  priceExtent = null,
}: {
  bars: PriceBar[] | null | undefined;
  /** `Date.parse(bar.date)` per bar; parsed from `bars` when omitted. */
  times?: number[];
  view: GraphView;
  width: number;
  height: number;
  intraday?: boolean;
  interval?: string;
  timeAxis?: number;
  topPad?: number;
  /** Prices outside the bars the scale must still fit (forecast band). */
  priceExtent?: { lo: number; hi: number } | null;
}): GraphGeometry {
  const list = bars || [];
  const count = list.length;
  const stamps = times && times.length === count ? times : list.map((bar) => Date.parse(bar.date));
  const plotWidth = Math.max(width - GRAPH_AXIS_WIDTH, 1);
  const plotHeight = Math.max(height - timeAxis, 1);
  const span = Math.max(view.end - view.start, 1e-6);
  const slot = plotWidth / span;

  const closeOnly = interval === "1d" || interval === "1wk" || interval === "1mo";
  const firstIndex = Math.max(Math.floor(view.start), 0);
  const lastIndex = Math.min(Math.ceil(view.end) - 1, count - 1);
  const domain = priceDomain(list, count ? view : { start: 0, end: 1 }, priceExtent);
  let priceHigh = -Infinity;
  let priceLow = Infinity;
  for (let index = firstIndex; index <= lastIndex; index++) {
    const bar = list[index];
    if (!bar) continue;
    priceHigh = Math.max(priceHigh, closeOnly ? bar.close : bar.high);
    priceLow = Math.min(priceLow, closeOnly ? bar.close : bar.low);
  }
  if (!Number.isFinite(priceHigh) || priceHigh <= priceLow) {
    priceHigh = domain.hi;
    priceLow = domain.lo;
  }
  const priceTop = topPad;
  const priceBottom = Math.max(plotHeight - Math.max(topPad * 0.5, 8), priceTop + 1);
  const yOf = (price: number) => priceTop + ((domain.hi - price) / (domain.hi - domain.lo)) * (priceBottom - priceTop);
  const priceAt = (y: number) => domain.hi - ((y - priceTop) / (priceBottom - priceTop)) * (domain.hi - domain.lo);
  const xOf = (index: number) => (index - view.start + 0.5) * slot;

  const msPerBar = count > 1 ? (stamps[count - 1] - stamps[0]) / (count - 1) : 86_400_000;
  const indexAt = (time: number) => {
    if (!count) return 0;
    if (time <= stamps[0]) return (time - stamps[0]) / msPerBar;
    if (time >= stamps[count - 1]) return count - 1 + (time - stamps[count - 1]) / msPerBar;
    let low = 0;
    let high = count - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (stamps[middle] <= time) low = middle;
      else high = middle;
    }
    return low + (time - stamps[low]) / (stamps[high] - stamps[low] || 1);
  };
  const timeAt = (index: number) => {
    if (!count) return 0;
    if (index <= 0 || count < 2) return stamps[0] + index * msPerBar;
    if (index >= count - 1) return stamps[count - 1] + (index - count + 1) * msPerBar;
    const base = Math.floor(index);
    return stamps[base] + (index - base) * (stamps[base + 1] - stamps[base]);
  };

  return {
    width,
    height,
    plotWidth,
    plotHeight,
    priceTop,
    priceBottom,
    axisWidth: GRAPH_AXIS_WIDTH,
    timeAxis,
    axisBlock: { ...AXIS_BLOCK, w: plotWidth, h: Math.max(priceBottom, 1) },
    view,
    priceHigh,
    priceLow,
    count,
    firstIndex,
    lastIndex,
    xOf,
    yOf,
    indexAt,
    timeAt,
    priceAt,
    toPx: (anchor: Anchor) => ({ x: xOf(indexAt(anchor.time)), y: yOf(anchor.price) }),
    barsBetween: (a: Anchor, b: Anchor) => Math.round(indexAt(b.time) - indexAt(a.time)),
  };
}

/**
 * The view a host starts from before the user zooms or pans.
 *
 * - `anchor` (a saved snapshot or an opinion window) shows that window plus `anchor.barsChange`
 *   bars of context on both sides — unless `anchorWins` is false and the range should win.
 * - otherwise the `rangeStart` (ms) window is shown: exactly its bars, extended backwards to
 *   GRAPH_MIN_BARS when the window holds fewer.
 * `range` is accepted so hosts can pass their range key through; the window itself always comes
 * from `rangeStart` (use `rangeWindowStart(range, lastBarTime)` when it is not known yet).
 * Returns `null` for fewer than three loaded bars, so the host keeps its own default.
 */
export function defaultGraphView({
  count,
  times,
  rangeStart = null,
  range: _range,
  anchor = null,
  anchorWins = true,
  minBars = GRAPH_MIN_BARS,
}: {
  count: number;
  times: number[];
  /** Window start in ms; `null`/`undefined` shows every loaded bar. */
  rangeStart?: number | null;
  /** Range key, for hosts that pass it alongside `rangeStart`; does not change the result. */
  range?: PriceRangeKey;
  /** Explicit [start, end] window in ms plus optional context bars. */
  anchor?: { start: number; end: number; barsChange?: number } | null;
  /** When false the range wins over `anchor`. */
  anchorWins?: boolean;
  minBars?: number;
}): GraphView | null {
  if (count < 3) return null;
  if (anchor && anchorWins) return viewForRange({ count, times, kind: "anchor", anchor, minBars });
  return viewForRange({ count, times, kind: "range", rangeStart, minBars });
}

/** Window start (ms) for a range key, measured back from the last bar; `null` = every loaded bar. */
export function rangeWindowStart(range: PriceRangeKey, lastBarTime: number): number | null {
  const last = new Date(lastBarTime);
  const back = (months: number, days = 0, years = 0) => {
    const date = new Date(last);
    if (years) date.setFullYear(date.getFullYear() - years);
    if (months) date.setMonth(date.getMonth() - months);
    if (days) date.setDate(date.getDate() - days);
    return date.getTime();
  };
  switch (range) {
    case "1D":
      return new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime();
    case "1W":
      return back(0, 7);
    case "1M":
      return back(1);
    case "3M":
      return back(3);
    case "6M":
      return back(6);
    case "YTD":
      return new Date(last.getFullYear(), 0, 1).getTime();
    case "1Y":
      return back(0, 0, 1);
    case "5Y":
      return back(0, 0, 5);
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ helpers */

const reducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const axisNumber = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Never hand `Intl` a placeholder: a missing i18n key resolves to itself and would throw. */
function safeLocale(locale: string | undefined) {
  if (!locale || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(locale)) return "en-US";
  try {
    return new Intl.DateTimeFormat(locale).resolvedOptions().locale;
  } catch {
    return "en-US";
  }
}

function shortDate(date: string, locale: string) {
  const [year, month, day] = date.split("-").map(Number);
  const local = new Date(year, (month || 1) - 1, day || 1);
  if (!Number.isFinite(local.getTime())) return date;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(local);
}

function tickLabel(bar: PriceBar, intraday: boolean, interval: string, locale: string) {
  const date = bar.date.slice(0, 10);
  const [year, month, day] = date.split("-").map(Number);
  const local = new Date(year, (month || 1) - 1, day || 1);
  if (intraday) {
    return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12: false }).format(new Date(bar.date));
  }
  if (interval === "1wk" || interval === "1mo") {
    return new Intl.DateTimeFormat(locale, { year: "2-digit", month: "short" }).format(local);
  }
  return shortDate(date, locale);
}

/* -------------------------------------------------------------------- props */

export interface PriceGraphProps {
  mode: GraphMode;
  /** Height classes for the plot box, e.g. `h-[16.25rem] sm:h-[20rem]` (workspace `h-[20rem] sm:h-[26.25rem]`). */
  heightClass: string;
  bars: PriceBar[] | null;
  quote?: StockQuote | null;
  quoteEnabled?: boolean;
  quoteLoading?: boolean;
  quoteError?: boolean;
  onQuoteRetry?: () => void;
  historyStale?: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Controlled horizontal window (bars); `null` = "the selected range's own window". */
  view: GraphView | null;
  onViewChange: (view: GraphView | null) => void;
  range: PriceRangeKey;
  onRangeChange: (range: PriceRangeKey) => void;
  /** Custom (date picker) state, owned by the host; the host renders the picker itself. */
  rangeOpen?: boolean;
  onRangeOpenChange?: (open: boolean) => void;
  rangeOptions: PriceRangeOption[];
  /** Label of the active window for the custom chip, e.g. "Sep 26 – Oct 30". */
  rangeLabel?: string;
  /** Window start (ms) of `range`; omitted derives it from `range` + the last bar, `null` = all bars. */
  rangeStart?: number | null;
  calls?: Map<number, CallCounts>;
  showCalls?: boolean;
  /** Host content for the active bar popover (creator calls); the price pill is always drawn. */
  renderEventPopover?: (index: number) => ReactNode;
  activeIndex: number | null;
  onActiveChange: (index: number | null) => void;
  onOpenAdvanced?: () => void;
  /** Absolutely positioned nodes inside the plot box: AI drawing layers, indicator legends. */
  overlay?: ReactNode;
  /** Drawing layer rendered inside the plot, clipped to the plot box. */
  drawingLayer?: ReactNode | ((geometry: GraphGeometry) => ReactNode);
  /** Advanced: candles / indicators on the shared geometry, drawn instead of the close line. */
  renderPlot?: (geometry: GraphGeometry) => ReactNode;
  /** Rendered under the time axis (advanced: oscillator pane). */
  subPane?: ReactNode;
  /** Sits at the end of the range row (the interval pill), Robinhood-style. */
  rangeTrailing?: ReactNode;
  /** Controls placed in the graph's control row before the range bar. */
  leadingControls?: ReactNode;
  /** Controls placed in the graph's control row after the range bar. */
  trailingControls?: ReactNode;
  /** Called with the geometry after every resize / view / data change (drawing host hooks). */
  onGeometry?: (geometry: GraphGeometry) => void;
  /** Prices outside the bars the scale must still fit (forecast band). */
  priceExtent?: { lo: number; hi: number } | null;
  formatDate: (date: string) => string;
  t: Translate;
  symbol: string;
  interval?: string;
  intraday?: boolean;
  /** Inline popover for the active bar; only rendered when `renderEventPopover` is absent. */
  eventsAt?: (index: number) => ReactNode;
  /** Shown right after the change percent, e.g. "所选区间". */
  rangeChangeLabel?: string;
  /** Accessible name of the range bar; defaults to `youtubeOpinions.graph.rangeLabel`. */
  rangeAriaLabel?: string;
  /** Accessible name of the plot in compact mode; defaults to `youtubeOpinions.graph.plotLabel`. */
  plotAriaLabel?: string;
  /** Small leading line in the header (symbol / company); optional. */
  headerLabel?: ReactNode;
  /** Crossfade the line on range change; defaults to on (`prefers-reduced-motion` still wins). */
  animate?: boolean;
}

/* ---------------------------------------------------------------- component */

export default function PriceGraph({
  mode,
  heightClass,
  bars,
  quote,
  quoteEnabled = false,
  quoteLoading = false,
  quoteError = false,
  onQuoteRetry,
  historyStale = false,
  loading = false,
  error = false,
  onRetry,
  view,
  onViewChange,
  range,
  onRangeChange,
  rangeOpen = false,
  onRangeOpenChange,
  rangeOptions,
  rangeLabel,
  rangeStart,
  calls,
  showCalls = true,
  renderEventPopover,
  activeIndex,
  onActiveChange,
  onOpenAdvanced,
  overlay,
  drawingLayer,
  renderPlot,
  subPane,
  rangeTrailing,
  leadingControls,
  trailingControls,
  onGeometry,
  priceExtent = null,
  formatDate,
  t,
  symbol,
  interval = "1d",
  intraday = false,
  eventsAt,
  rangeChangeLabel,
  rangeAriaLabel,
  plotAriaLabel,
  headerLabel,
  animate = true,
}: PriceGraphProps) {
  const advanced = mode === "advanced";
  const clipId = `pricegraph-clip-${useId().replace(/:/g, "")}`;
  const gradientId = `pricegraph-area-${useId().replace(/:/g, "")}`;
  const plotRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [fading, setFading] = useState<{ bars: PriceBar[]; view: GraphView } | null>(null);
  const gesture = useRef<{ kind: "pan"; x: number; moved: boolean; view: GraphView; last: number } | { kind: "pinch"; distance: number; mid: number; view: GraphView } | null>(null);
  /** Release velocity of a pan, in bars per second. */
  const tracker = useRef(new VelocityTracker());
  /** The spring that carries a released pan to rest (or back inside the data). */
  const settling = useRef<SpringAnimation | null>(null);
  /** Unclamped start while a trackpad scroll is pushing past an edge, and its settle timer. */
  const wheelPan = useRef<{ raw: number; timer: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastSnapshot = useRef<{ key: string; bars: PriceBar[]; view: GraphView } | null>(null);
  const rangeKey = `${range}|${bars?.length ?? 0}`;

  const count = bars?.length ?? 0;
  const times = useMemo(() => (bars || []).map((bar) => Date.parse(bar.date)), [bars]);
  const locale = safeLocale(t("common.intlLocale"));

  /* plot box size */
  useEffect(() => {
    const box = plotRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  /* the window the range asks for */
  const requestedStart = useMemo(() => {
    if (rangeStart !== undefined) return rangeStart;
    if (!count || !times.length || !Number.isFinite(times[count - 1])) return null;
    return rangeWindowStart(range, times[count - 1]);
  }, [rangeStart, range, count, times]);

  const defaultView = useMemo<GraphView | null>(() => {
    if (!count) return { start: 0, end: 1 };
    return defaultGraphView({ count, times, rangeStart: requestedStart });
  }, [count, times, requestedStart]);
  const current = useMemo<GraphView>(
    () => view || defaultView || { start: 0, end: Math.max(count, 1) },
    [view, defaultView, count],
  );
  /** The "Reset zoom" affordance; ±0.5 bars of slack absorbs float drift. */
  const modified = Boolean(defaultView && view && (Math.abs(view.start - defaultView.start) > 0.5 || Math.abs(view.end - defaultView.end) > 0.5));

  const geometry = useMemo(
    () => graphGeometry({ bars, times, view: current, width: size.width, height: size.height, intraday, interval, topPad: advanced ? GRAPH_TOP_PAD : GRAPH_TOP_PAD - 6, priceExtent }),
    [bars, times, current, size.width, size.height, intraday, interval, advanced, priceExtent],
  );
  const loaded = Boolean(count && size.width >= 40 && size.height >= 40);
  /**
   * Hosts that draw their own candles / drawings / oscillator align them to this geometry. The
   * geometry object is memoized, so the callback only fires when the box, the data or the view
   * actually change — not on every render.
   */
  const reportedGeometry = useRef<GraphGeometry | null>(null);
  useEffect(() => {
    if (!loaded || reportedGeometry.current === geometry) return;
    reportedGeometry.current = geometry;
    onGeometry?.(geometry);
  }, [geometry, loaded, onGeometry]);

  /* ---------------------------------------------------------------- fading */

  // `lastSnapshot` always holds the last *drawn* frame and the range key it belonged to. When the
  // key changes (new range, or a reload with a different bar count) the old frame is re-drawn for
  // one fade-out; pinning the key keeps the following zoom / pan renders from refiring the fade.
  useEffect(() => {
    if (!animate || !loaded || !bars) return;
    const previous = lastSnapshot.current;
    lastSnapshot.current = { key: rangeKey, bars, view: current };
    if (!previous || previous.key === rangeKey || !previous.bars.length || reducedMotion()) return;
    setFading({ bars: previous.bars, view: previous.view });
    const timer = window.setTimeout(() => setFading(null), FADE_MS);
    return () => window.clearTimeout(timer);
    // Only a range / reload change crossfades, not zoom or pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, loaded, animate]);

  /* ---------------------------------------------------------------- views */

  const commit = (next: GraphView) => onViewChange(clampGraphView(next, count));
  const zoomBy = (factor: number, anchorRatio: number) => {
    if (!count) return;
    commit(zoomGraphView(current, factor, Math.min(Math.max(anchorRatio, 0), 1), count));
  };
  const panBy = (bars: number) => {
    if (!count) return;
    commit({ start: current.start + bars, end: current.end + bars });
  };
  const resetView = () => {
    stopSettling();
    onViewChange(null);
    onActiveChange(null);
  };

  /* -------------------------------------------------------------- physics */

  // Pans past the data stretch with a rubber band instead of stopping dead, and a release keeps
  // the hand's speed: a critically damped spring (lib/motion/spring.ts) carries the view to where
  // the flick would come to rest, clamped to the data, so a hard flick into an edge springs back.
  function stopSettling() {
    settling.current?.stop();
    settling.current = null;
    if (wheelPan.current) window.clearTimeout(wheelPan.current.timer);
    wheelPan.current = null;
  }
  const showStart = (start: number, span: number) => onViewChange({ start, end: start + span });
  const elastic = (start: number, span: number) => {
    const { min, max } = graphPanBounds(span, count);
    return rubberBandClamp(start, min, max, span);
  };
  function settle(from: number, span: number, velocity: number) {
    if (!count) return;
    const { min, max } = graphPanBounds(span, count);
    const to = Math.min(Math.max(projectRelease(from, velocity), min), max);
    settling.current?.stop();
    settling.current = animateSpring({
      from,
      to,
      velocity,
      response: SPRING_RESPONSE.gentle,
      precision: Math.max(span * 1e-4, 1e-3),
      onUpdate: (value) => showStart(rubberBandClamp(value, min, max, span), span),
      onComplete: () => {
        settling.current = null;
      },
    });
  }
  // A new range or data set must not be pushed around by a spring from the old one.
  useEffect(() => stopSettling, [rangeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* wheel: horizontal pans, ⌘/Ctrl wheel (pinch) zooms; advanced zooms on a plain wheel too. */
  useEffect(() => {
    const box = plotRef.current;
    if (!box || !loaded) return;
    const onWheel = (event: WheelEvent) => {
      const rect = box.getBoundingClientRect();
      const ratio = Math.min(Math.max((event.clientX - rect.left) / geometry.plotWidth, 0), 1);
      const span = current.end - current.start || 1;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        if (!count) return;
        settling.current?.stop();
        settling.current = null;
        // Trackpad scrolling past an edge stretches, then springs back once the scroll stops.
        const pan = wheelPan.current ?? { raw: current.start, timer: 0 };
        window.clearTimeout(pan.timer);
        pan.raw += (event.deltaX / geometry.plotWidth) * span;
        const shown = elastic(pan.raw, span);
        showStart(shown, span);
        pan.timer = window.setTimeout(() => {
          wheelPan.current = null;
          settle(shown, span, 0);
        }, 140);
        wheelPan.current = pan;
        return;
      }
      if (!advanced && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      stopSettling();
      zoomBy(Math.exp(event.deltaY * ZOOM_PER_PX * (event.ctrlKey ? 4 : 1)), ratio);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  });

  /* ------------------------------------------------------------- pointers */

  const indexAtClientX = (clientX: number) => {
    const rect = plotRef.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    const slot = geometry.plotWidth / Math.max(current.end - current.start, 1e-6);
    return { px, index: Math.round(px / slot + current.start - 0.5) };
  };

  const scrub = (clientX: number, clientY: number) => {
    const rect = plotRef.current!.getBoundingClientRect();
    const { px, index } = indexAtClientX(clientX);
    const py = clientY - rect.top;
    const inside = px >= 0 && px <= geometry.plotWidth && py >= 0 && py <= geometry.plotHeight;
    if (!inside || index < 0 || index >= count) {
      if (activeIndex !== null) onActiveChange(null);
      return;
    }
    if (index !== activeIndex) onActiveChange(index);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!loaded) return;
    // Catch the view where it is: a touch stops a settling spring, as a finger stops a scroll.
    stopSettling();
    tracker.current.reset();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const rect = plotRef.current!.getBoundingClientRect();
      gesture.current = { kind: "pinch", distance: Math.abs(a.x - b.x) || 1, mid: Math.min(Math.max(((a.x + b.x) / 2 - rect.left) / geometry.plotWidth, 0), 1), view: current };
      return;
    }
    if (event.button !== 0) return;
    if (advanced) event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { kind: "pan", x: event.clientX, moved: false, view: current, last: current.start };
    scrub(event.clientX, event.clientY);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!loaded) return;
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const now = gesture.current;
    if (now?.kind === "pinch" && pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const ratio = now.distance / (Math.abs(a.x - b.x) || 1);
      const base = now.view.end - now.view.start;
      const anchor = now.view.start + base * now.mid;
      commit({ start: anchor - base * ratio * now.mid, end: anchor + base * ratio * (1 - now.mid) });
      return;
    }
    scrub(event.clientX, event.clientY);
    if (now?.kind !== "pan") return;
    // Advanced: dragging the plot pans only with the pan tool (leave drags to the drawing layer);
    // touch and pen always pan there. Compact pans on everything.
    const mouse = event.pointerType === "mouse";
    if (advanced && mouse && !panMode) return;
    const dx = event.clientX - now.x;
    if (!now.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    now.moved = true;
    setDragging(true);
    const span = now.view.end - now.view.start;
    const slot = geometry.plotWidth / Math.max(span, 1e-6);
    const shown = elastic(now.view.start - dx / slot, span);
    now.last = shown;
    tracker.current.add(shown, event.timeStamp);
    showStart(shown, span);
  };

  const endGesture = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const now = gesture.current;
    if (now?.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    gesture.current = null;
    setDragging(false);
    if (now?.kind === "pan" && now.moved) {
      // A cancelled pointer has no meaningful speed; it only springs back inside the data.
      const velocity = event.type === "pointercancel" ? 0 : tracker.current.velocity(event.timeStamp);
      settle(now.last, now.view.end - now.view.start, velocity);
    }
  };

  const onPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current || event.buttons) return;
    if (activeIndex !== null) onActiveChange(null);
  };

  const onPlotDoubleClick = () => {
    if (!count) return;
    resetView();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const base = activeIndex ?? Math.max(Math.min(geometry.lastIndex, count - 1), 0);
    if (event.key === "ArrowLeft") onActiveChange(Math.max(base - 1, 0));
    else if (event.key === "ArrowRight") onActiveChange(Math.min(base + 1, count - 1));
    else if (event.key === "+" || event.key === "=") zoomBy(0.8, 0.5);
    else if (event.key === "-") zoomBy(1.25, 0.5);
    else if (event.key === "0") resetView();
    else if (event.key === "Escape") {
      if (activeIndex === null) return;
      onActiveChange(null);
    } else return;
    event.preventDefault();
  };

  /* -------------------------------------------------------------- data */

  const activeBar = activeIndex === null ? null : bars?.[activeIndex] || null;
  const lastBar = count ? bars![Math.min(geometry.lastIndex, count - 1)] || bars![count - 1] : null;
  const firstBar = count ? bars![Math.min(Math.max(geometry.firstIndex, 0), count - 1)] : null;
  const headerBar = activeBar || lastBar;
  const baseline = range === "1D" && quote && Number.isFinite(quote.previousClose) && quote.previousClose! > 0
    ? quote.previousClose! : firstBar?.close;
  const headerChange = headerBar && baseline ? ((headerBar.close - baseline) / baseline) * 100 : 0;
  const latest = quoteEnabled ? latestChartQuote(quote, false) : null;
  const extended = quoteEnabled ? latestChartQuote(quote) : null;
  const showQuote = !activeBar && !!latest;
  const displayedPrice = showQuote ? latest.price : headerBar?.close;
  // Change follows the selected range: 1D compares with the previous close (the quote's own
  // change), every other range compares the latest price with the first bar of the window.
  const quoteVsPreviousClose = range === "1D" && baseline === quote?.previousClose;
  const quoteRangeChange = showQuote && baseline
    ? quoteVsPreviousClose && latest.changePercent !== null ? latest.changePercent : ((latest.price - baseline) / baseline) * 100
    : null;
  const displayedChange = showQuote ? quoteRangeChange : headerChange;
  const quoteTime = latest?.time ? new Date(latest.time * 1000).toLocaleString(t("common.intlLocale"), {
    timeZone: quote?.exchangeTimezone || "America/New_York", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
  }) : t("youtubeOpinions.quoteTimeUnknown");
  const toneChange = displayedChange ?? headerChange;
  const tone: StrengthTone = toneChange > 0 ? "positive" : toneChange < 0 ? "negative" : "neutral";
  const color = toneColor[tone];
  const barLabel = (bar: PriceBar) => `${formatDate(bar.date.slice(0, 10))}${intraday ? ` ${bar.date.slice(11, 16)}` : ""}`;

  const line = useMemo(() => {
    if (!bars?.length) return { d: "", area: "", points: [] as Array<{ x: number; y: number; index: number }> };
    const points: Array<{ x: number; y: number; index: number }> = [];
    let d = "";
    let pen = false;
    for (let index = Math.max(geometry.firstIndex - 1, 0); index <= Math.min(geometry.lastIndex + 1, count - 1); index++) {
      const close = bars[index]?.close;
      if (!Number.isFinite(close)) {
        pen = false;
        continue;
      }
      const x = geometry.xOf(index);
      const y = geometry.yOf(close);
      points.push({ x, y, index });
      d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      pen = true;
    }
    if (!d) return { d: "", area: "", points };
    const inside = points.filter((point) => point.x >= -1 && point.x <= geometry.plotWidth + 1);
    const area =
      inside.length >= 2
        ? `M${inside[0].x.toFixed(1)},${geometry.priceBottom.toFixed(1)}L${inside.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join("L")}L${inside[inside.length - 1].x.toFixed(1)},${geometry.priceBottom.toFixed(1)}Z`
        : "";
    return { d, area, points };
    // `geometry` is memoized on the box/data/view triple, so depending on it is stable.
  }, [bars, count, geometry]);

  const axisRules = useMemo(() => priceTickValues(geometry.priceLow, geometry.priceHigh, 4), [geometry.priceLow, geometry.priceHigh]);

  const timeTicks = useMemo(() => {
    if (!loaded || !bars?.length || geometry.plotWidth < 140) return [];
    const slots = Math.max(Math.min(Math.floor(geometry.plotWidth / BARS_PER_LABEL), 4), 2);
    return dateTickIndices(current, count, slots)
      .filter((index) => Boolean(bars[index]))
      .map((index) => ({ index, x: geometry.xOf(index), label: tickLabel(bars[index], intraday, interval, locale) }))
      .filter((tick) => tick.x > 20 && tick.x < geometry.plotWidth - 14);
  }, [loaded, bars, current, count, geometry, intraday, interval, locale]);

  const extremes = useMemo(() => {
    if (!bars?.length || geometry.lastIndex < geometry.firstIndex) return null;
    let high = geometry.firstIndex;
    let low = geometry.firstIndex;
    for (let index = geometry.firstIndex; index <= geometry.lastIndex; index++) {
      if (bars[index].close > bars[high].close) high = index;
      if (bars[index].close < bars[low].close) low = index;
    }
    return { high, low };
  }, [bars, geometry.firstIndex, geometry.lastIndex]);

  /* ------------------------------------------------------------- controls */

  const selectedRangeLabel = rangeLabel || rangeOptions.find((option) => option.value === range)?.label || "";
  const customOption = rangeOptions.find((option) => option.value === "CUSTOM");
  const rangeButtons = rangeOptions.filter((option) => option.value !== "CUSTOM");

  const rangeBar = (
    <>
      {/* A radiogroup of windows; the custom chip also opens the host's date picker. */}
      <div
        role="radiogroup"
        aria-label={rangeAriaLabel || t("youtubeOpinions.graph.rangeLabel")}
        className={cn("flex min-w-0 basis-full items-center gap-0.5 overflow-x-auto rounded-full p-0.5 glass-track scrollbar-hide sm:basis-auto", !advanced && "justify-between sm:justify-start")}
      >
        {rangeButtons.map((option) => {
          const selected = option.value === range;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={option.disabled}
              onClick={() => {
                if (option.value !== range) onRangeChange(option.value);
                onViewChange(null);
                onActiveChange(null);
              }}
              className={cn(
                "inline-flex h-8 shrink-0 select-none items-center justify-center rounded-full px-3 text-[0.8125rem] font-semibold transition-colors duration-150",
                "focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-40",
                selected ? "glass-thumb text-foreground" :"text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:bg-muted/60",
              )}
            >
              {option.label}
            </button>
          );
        })}
        {customOption && (
          <button
            type="button"
            role="radio"
            aria-checked={range === "CUSTOM"}
            aria-label={customOption.label}
            onClick={() => {
              onRangeOpenChange?.(!rangeOpen);
              if (range !== "CUSTOM") onRangeChange("CUSTOM");
              else if (!rangeOpen) return;
              onViewChange(null);
            }}
            className={cn(
              "inline-flex h-8 max-w-[min(15rem,52vw)] shrink-0 items-center justify-center rounded-full px-3 text-[0.8125rem] font-semibold transition-colors duration-150",
              "focus-visible:outline-none",
              range === "CUSTOM" ? "glass-thumb text-foreground" :"text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:bg-muted/60",
            )}
            title={customOption.label}
          >
            <span className="truncate">{range === "CUSTOM" && selectedRangeLabel ? selectedRangeLabel : customOption.label}</span>
          </button>
        )}
      </div>
      {modified && (
        <button
          type="button"
          onClick={resetView}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[0.75rem] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:bg-muted/60"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t("youtubeOpinions.graph.resetZoom")}
        </button>
      )}
    </>
  );

  const iconButton = (active: boolean) =>
    cn(
      "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none sm:h-8 sm:w-8",
      active ? "glass-thumb glass-thumb-touch text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:bg-muted/60",
    );

  const plotTone = toneColor[tone];

  const body = error ? (
    <div className={cn("flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground", heightClass)} role="alert">
      <span>{t("youtubeOpinions.priceUnavailable")}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="glass-button glass-button-neutral inline-flex h-11 items-center rounded-full border border-foreground/[0.12] bg-foreground/[0.05] px-4 text-sm font-semibold text-foreground hover:bg-foreground/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-8">
          {t("common.retry")}
        </button>
      )}
    </div>
  ) : (
    <PriceGraphPlot
      advanced={advanced}
      size={size}
      geometry={geometry}
      bars={bars}
      count={count}
      rangeKey={rangeKey}
      heightClass={heightClass}
      loaded={loaded}
      plotRef={plotRef}
      plotTone={plotTone}
      gradientId={gradientId}
      clipId={clipId}
      axisRules={axisRules}
      baselinePrice={baseline}
      line={line}
      activeBar={activeBar}
      activeIndex={activeIndex}
      fading={fading}
      showCalls={showCalls}
      calls={calls}
      extremes={extremes}
      lastBar={lastBar}
      tone={tone}
      activeLabel={headerBar ? barLabel(headerBar) : ""}
      timeTicks={timeTicks}
      renderPlot={renderPlot}
      renderEventPopover={renderEventPopover}
      eventsAt={eventsAt}
      drawingLayer={drawingLayer}
      overlay={overlay}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onPointerLeave={onPointerLeave}
      onDoubleClick={onPlotDoubleClick}
      onKeyDown={advanced ? onKeyDown : undefined}
      ariaLabel={
        advanced
          ? plotAriaLabel || t("youtubeOpinions.priceChartLabel")
          : plotAriaLabel ||
            t("youtubeOpinions.graph.plotLabel", {
              symbol,
              price: displayedPrice !== undefined ? formatPrice(displayedPrice) : "—",
              change: displayedChange !== null ? formatChangePercent(displayedChange) : "—",
            })
      }
      dragging={dragging}
    />
  );

  const showExtended = Boolean(extended && extended.session !== "regular");
  const quoteProblem = Boolean(quoteError || (!latest && !quoteLoading));
  /** Source, timestamps and the delay notice stay one tap away instead of two lines over the chart. */
  const quoteDetails = quoteEnabled && latest ? (
    <InfoTip label={t("youtubeOpinions.quoteMayBeDelayed")} className="self-center">
      <span className="block">{quote?.source || "Yahoo Finance"} · {quoteTime}</span>
      {extended && showExtended && extended.time ? (
        <span className="block">
          {t(`youtubeOpinions.quoteSession.${extended.session}`)} · {new Date(extended.time * 1000).toLocaleString(t("common.intlLocale"), {
            timeZone: quote?.exchangeTimezone || "America/New_York", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
          })}
        </span>
      ) : null}
      <span className="block">{t("youtubeOpinions.quoteMayBeDelayed")}{showExtended ? ` · ${t("youtubeOpinions.regularSessionChart")}` : ""}</span>
    </InfoTip>
  ) : null;

  return (
    <div className={cn("min-w-0", advanced && "flex min-h-0 flex-1 flex-col")}>
      {/* header: price · change · window label, as in the reference */}
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {headerLabel}
          {displayedPrice !== undefined ? (
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1" aria-live="polite">
              <span className="text-base font-semibold tabular-nums text-foreground">{formatPrice(displayedPrice)}</span>
              {displayedChange !== null && <span className={cn("text-sm font-semibold tabular-nums", displayedChange > 0 ? "text-positive" : displayedChange < 0 ? "text-negative" : "text-muted-foreground")}>
                {formatChangePercent(displayedChange)}
              </span>}
              <span className="text-xs text-muted-foreground">{showQuote && quoteVsPreviousClose
                ? t(`youtubeOpinions.quoteSession.${latest.session}`)
                : quoteVsPreviousClose ? t("youtubeOpinions.quoteSession.regular")
                  : rangeChangeLabel || t("youtubeOpinions.priceRangeChange")}</span>
              {quoteDetails}
            </span>
          ) : (
            loading || !bars ? <Skeleton className="h-5 w-32" aria-hidden="true" /> : null
          )}
          {activeBar && activeIndex !== null && (
            <span className="text-[0.6875rem] tabular-nums text-muted-foreground">{barLabel(activeBar)}</span>
          )}
        </div>
        {/* Sits on the price line, not under the range bar; the negative margin keeps the phone hit area without growing the row. */}
        {!advanced && onOpenAdvanced && (
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="-my-3 -mr-1 inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-[0.75rem] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:bg-muted/60 sm:-my-1.5 sm:h-8"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("youtubeOpinions.advancedChart")}
          </button>
        )}
      </div>
      {quoteEnabled && (showExtended || quoteProblem || (!latest && quoteLoading)) && (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {showExtended && extended && <span className="tabular-nums">
            {t(`youtubeOpinions.quoteSession.${extended.session}`)} {formatPrice(extended.price)}
            {extended.changePercent !== null && ` (${formatChangePercent(extended.changePercent)})`}
          </span>}
          {!latest && quoteLoading && <span>{t("youtubeOpinions.quoteLoading")}</span>}
          {quoteProblem && <span role="status">{t(latest ? "youtubeOpinions.quoteRefreshFailed" : "youtubeOpinions.quoteUnavailable")}</span>}
          {quoteProblem && onQuoteRetry && (
            <button type="button" onClick={onQuoteRetry} className="rounded px-1 font-semibold text-foreground underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{t("common.retry")}</button>
          )}
        </div>
      )}
      {historyStale && <div role="status" className="mt-1 text-xs text-muted-foreground">{t("youtubeOpinions.historyRefreshFailed")}</div>}

      {/* Phones give the plot every spare pixel (no gap above the controls); panes stack right under it. */}
      <div className={cn("mt-1.5", advanced && "flex flex-1 flex-col sm:min-h-0")}>{body}</div>

      {/* Phones stack the range bar over the icon row so a long label never hides the icons. */}
      <div className="my-1.5 flex shrink-0 flex-col items-stretch gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
        <div className="flex w-full min-w-0 flex-1 items-center gap-1 sm:w-auto">
          {leadingControls}
          {rangeBar}
          {rangeTrailing}
        </div>
        {advanced && (
          <div className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain px-1 scrollbar-hide sm:mx-0 sm:shrink-0 sm:overflow-visible sm:px-0">
            {trailingControls}
            <span className="ml-auto" aria-hidden="true" />
            <button type="button" aria-label={t("youtubeOpinions.zoomIn")} title={t("youtubeOpinions.zoomIn")} onClick={() => zoomBy(0.8, 0.5)} className={cn(iconButton(false), "max-sm:hidden")}>
              <ZoomIn className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={t("youtubeOpinions.zoomOut")} title={t("youtubeOpinions.zoomOut")} onClick={() => zoomBy(1.25, 0.5)} className={cn(iconButton(false), "max-sm:hidden")}>
              <ZoomOut className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-pressed={panMode}
              aria-label={t("youtubeOpinions.graph.panMode")}
              title={t("youtubeOpinions.graph.panMode")}
              onClick={() => setPanMode((value) => !value)}
              className={iconButton(panMode)}
            >
              <MoveHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={t("youtubeOpinions.resetZoom")}
              title={t("youtubeOpinions.resetZoom")}
              onClick={resetView}
              disabled={!modified}
              className={cn(iconButton(false), "disabled:pointer-events-none disabled:opacity-40")}
            >
              {modified ? <LocateFixed className="h-4 w-4" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        )}
      </div>
      {subPane}
    </div>
  );
}

/**
 * The plot surface of the graph: rules, opening baseline, line + area (or the host's candles via
 * `renderPlot`), call markers, the peak tag, the right axis, the scrub overlay and the date row.
 * Extracted from the component body so the same geometry, markers and accessibility attributes
 * can be asserted without a browser.
 */
export function PriceGraphPlot({
  advanced,
  size,
  geometry,
  bars,
  count,
  rangeKey,
  heightClass,
  loaded,
  plotRef,
  plotTone,
  gradientId,
  clipId,
  axisRules,
  baselinePrice,
  line,
  activeBar,
  activeIndex,
  fading,
  showCalls,
  calls,
  extremes,
  lastBar,
  tone,
  activeLabel,
  timeTicks,
  renderPlot,
  renderEventPopover,
  eventsAt,
  drawingLayer,
  overlay,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onDoubleClick,
  onKeyDown,
  ariaLabel,
  dragging,
}: {
  advanced: boolean;
  size: { width: number; height: number };
  geometry: GraphGeometry;
  bars: PriceBar[] | null;
  count: number;
  /** Identifies range + bar count; keys the line so a window change restarts its fade-in. */
  rangeKey: string;
  heightClass: string;
  loaded: boolean;
  plotRef: RefObject<HTMLDivElement>;
  plotTone: string;
  gradientId: string;
  clipId: string;
  axisRules: number[];
  baselinePrice: number | undefined;
  line: { d: string; area: string; points: Array<{ x: number; y: number; index: number }> };
  activeBar: PriceBar | null;
  activeIndex: number | null;
  fading: { bars: PriceBar[]; view: GraphView } | null;
  showCalls: boolean;
  calls?: Map<number, CallCounts>;
  extremes: { high: number; low: number } | null;
  lastBar: PriceBar | null;
  tone: StrengthTone;
  activeLabel: string;
  timeTicks: Array<{ index: number; x: number; label: string }>;
  renderPlot?: (geometry: GraphGeometry) => ReactNode;
  renderEventPopover?: (index: number) => ReactNode;
  eventsAt?: (index: number) => ReactNode;
  drawingLayer?: ReactNode | ((geometry: GraphGeometry) => ReactNode);
  overlay?: ReactNode;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  ariaLabel: string;
  dragging: boolean;
}) {
  return (
    <div
      ref={plotRef}
      role={advanced ? "slider" : "group"}
      tabIndex={advanced ? 0 : undefined}
      aria-label={ariaLabel}
      aria-valuemin={advanced ? 0 : undefined}
      aria-valuemax={advanced ? Math.max(count - 1, 0) : undefined}
      aria-valuenow={advanced ? activeIndex ?? Math.max(Math.min(geometry.lastIndex, count - 1), 0) : undefined}
      aria-valuetext={advanced && activeBar ? `${activeLabel} ${formatPrice(activeBar.close)}` : undefined}
      data-price-graph={advanced ? "advanced" : "compact"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={cn(
        "relative select-none overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:bg-muted/20",
        heightClass,
        advanced ? "touch-none" : "touch-pan-y",
        dragging && "cursor-grabbing",
      )}
    >
      {!loaded ? (
        <Skeleton className="absolute inset-0 rounded-none" aria-hidden="true" />
      ) : (
        <>
          <svg width={size.width} height={size.height} className="pointer-events-none absolute inset-0" aria-hidden="true">
            <defs>
              <clipPath id={clipId}>
                <rect x={0} y={0} width={geometry.plotWidth} height={geometry.plotHeight} />
              </clipPath>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={plotTone} stopOpacity={0.24} />
                <stop offset="62%" stopColor={plotTone} stopOpacity={0.07} />
                <stop offset="100%" stopColor={plotTone} stopOpacity={0} />
              </linearGradient>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              {axisRules.map((value) => {
                const y = geometry.yOf(value);
                return <line key={`rule-${value}`} x1={0} x2={geometry.plotWidth} y1={y} y2={y} stroke="rgb(var(--foreground) / 0.055)" />;
              })}
              {baselinePrice !== undefined && (
                <line
                  x1={0}
                  x2={geometry.plotWidth}
                  y1={geometry.yOf(baselinePrice)}
                  y2={geometry.yOf(baselinePrice)}
                  stroke="rgb(var(--foreground) / 0.18)"
                  strokeDasharray="3 4"
                />
              )}
              {renderPlot && <g>{renderPlot(geometry)}</g>}
              {!renderPlot && line.area && <path d={line.area} fill={`url(#${gradientId})`} />}
              {!renderPlot && line.d && (
                <path
                  key={rangeKey}
                  d={line.d}
                  fill="none"
                  stroke={plotTone}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={activeBar ? 0.35 : 1}
                >
                  {/* A range change fades the new line in under the old one (see FadingLine). */}
                  {fading && <animate attributeName="opacity" from="0" to={activeBar ? "0.35" : "1"} dur={`${FADE_MS}ms`} fill="freeze" calcMode="spline" keySplines="0.25 1 0.5 1" keyTimes="0;1" />}
                </path>
              )}
              {!renderPlot && line.d && activeBar && activeIndex !== null && (
                <path d={lineUntil(line.points, activeIndex)} fill="none" stroke={plotTone} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              )}
              {fading && <FadingLine geometry={geometry} bars={fading.bars} view={fading.view} />}
            </g>
          </svg>
  
          {/* creator calls */}
          {showCalls &&
            calls &&
            mergeNearbyCalls(calls, geometry).map(({ index, entry }) => {
              const bar = bars?.[index];
              if (!bar) return null;
              const x = geometry.xOf(index);
              const closeY = geometry.yOf(bar.close);
              const lowAnchor = advanced ? geometry.yOf(bar.low) : closeY;
              const highAnchor = advanced ? geometry.yOf(bar.high) : closeY;
              return (
                <span key={index}>
                  {entry.bearish > 0 && <CallMarker direction="down" count={entry.bearish} x={x} y={Math.max(highAnchor - 5, 10)} />}
                  {entry.bullish > 0 && <CallMarker direction="up" count={entry.bullish} x={x} y={Math.min(Math.max(lowAnchor + 5, 12), geometry.plotHeight - 8)} />}
                  {entry.other > 0 && (
                    <CallMarker
                      direction="dot"
                      count={entry.other}
                      x={x}
                      y={Math.min(lowAnchor + 8 + (entry.bullish > 0 ? (entry.bullish > 1 ? 20 : 10) : 0), geometry.plotHeight - 6)}
                    />
                  )}
                </span>
              );
            })}
  
          {/* the window's peak: one quiet floating tag, Finsepa-style */}
          {extremes && bars && (
            <ExtremeTag
              side="high"
              value={bars[extremes.high].close}
              x={geometry.xOf(extremes.high)}
              y={Math.max(geometry.yOf(bars[extremes.high].close) - 5, 1)}
              clamp={geometry.plotWidth}
            />
          )}
  
          {/* right axis: 2–3 interior numerals, the current price as a filled tag */}
          {axisRules.map((value) => {
            const y = geometry.yOf(value);
            const currentValue = lastBar?.close;
            if (currentValue !== undefined && Math.abs(geometry.yOf(currentValue) - y) < 12) return null;
            if (y < geometry.priceTop || y > geometry.priceBottom) return null;
            return (
              <span
                key={`axis-${value}`}
                aria-hidden="true"
                className="pointer-events-none absolute -translate-y-1/2 text-[0.625rem] tabular-nums text-muted-foreground/80"
                style={{ left: geometry.plotWidth + 8, top: y }}
              >
                {axisNumber(value)}
              </span>
            );
          })}
          {lastBar && (
            <PriceTag
              value={lastBar.close}
              x={geometry.plotWidth + 1}
              y={Math.min(Math.max(geometry.yOf(lastBar.close), 10), geometry.plotHeight - 10)}
              tone={tone}
              decimals={2}
            />
          )}
          {tooltipPill(activeBar, activeIndex, activeBar ? { x: geometry.xOf(activeIndex!), y: geometry.yOf(activeBar.close) } : null, geometry, plotTone, activeLabel, advanced)}
  
          {/* date labels: three or four, never dense */}
          {timeTicks.map((tick) => (
            <span
              key={tick.index}
              aria-hidden="true"
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[0.625rem] tabular-nums text-muted-foreground sm:text-[0.6875rem]"
              style={{ left: tick.x, top: geometry.plotHeight + 6 }}
            >
              {tick.label}
            </span>
          ))}
  
          {/* host popover for the active bar (creator calls) */}
          {activeBar && activeIndex !== null && (renderEventPopover ? renderEventPopover(activeIndex) : eventsAt?.(activeIndex))}
  
          {drawingLayer && (
            // Spans the price axis too, so drawings can post their levels there; the layer clips its own lines.
            <div className="absolute left-0 top-0 overflow-hidden" style={{ width: geometry.plotWidth + geometry.axisWidth, height: geometry.axisBlock.h }}>
              {typeof drawingLayer === "function" ? drawingLayer(geometry) : drawingLayer}
            </div>
          )}
          {overlay}
        </>
      )}
    </div>
  
  );
}

/* -------------------------------------------------------------- sub-views */

/**
 * Visible calls closer than CALL_MIN_GAP px share one marker on the latest bar, with summed
 * counts, so a long window never stacks triangles and numbers on top of each other.
 */
function mergeNearbyCalls(calls: Map<number, CallCounts>, geometry: GraphGeometry) {
  const merged: Array<{ index: number; startX: number; entry: CallCounts }> = [];
  const visible = Array.from(calls.entries())
    .filter(([index]) => index >= geometry.firstIndex && index <= geometry.lastIndex)
    .sort(([a], [b]) => a - b);
  for (const [index, entry] of visible) {
    const x = geometry.xOf(index);
    const group = merged[merged.length - 1];
    if (group && x - group.startX < CALL_MIN_GAP) {
      group.index = index;
      group.entry = {
        bullish: group.entry.bullish + entry.bullish,
        bearish: group.entry.bearish + entry.bearish,
        other: group.entry.other + entry.other,
      };
    } else {
      merged.push({ index, startX: x, entry });
    }
  }
  return merged;
}

/** The line up to the hovered index, drawn solid over the dimmed whole. */
function lineUntil(points: Array<{ x: number; y: number; index: number }>, active: number) {
  const upTo = points.filter((point) => point.index <= active);
  if (upTo.length < 2) return "";
  return upTo.map((point, offset) => `${offset ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join("");
}

function tooltipPill(
  bar: PriceBar | null,
  index: number | null,
  point: { x: number; y: number } | null,
  geometry: GraphGeometry,
  color: string,
  label: string,
  advanced: boolean,
) {
  if (!bar || index === null || !point) return null;
  const above = point.y > 44;
  const top = Math.min(Math.max(above ? point.y - 34 : point.y + 14, 2), geometry.plotHeight - 22);
  const right = point.x > geometry.plotWidth / 2;
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 w-px border-l border-dashed border-foreground/30"
        style={{ left: point.x, height: geometry.plotHeight }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
        style={{ left: point.x, top: point.y, backgroundColor: color }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute z-20 inline-flex items-baseline gap-1.5 whitespace-nowrap rounded-full bg-foreground px-2 py-1 text-[0.6875rem] font-medium leading-none tabular-nums text-background shadow-sm"
        style={right ? { right: geometry.plotWidth - point.x + 12, top } : { left: point.x + 12, top }}
      >
        <span className="opacity-75">{label}</span>
        <span className="font-semibold">{formatPrice(bar.close)}</span>
        {advanced && bar.volume != null && bar.volume > 0 && <span className="opacity-70">{formatVolume(bar.volume)}</span>}
      </span>
    </>
  );
}

/**
 * The outgoing line of a range change: it is drawn in the previous window's own scale and fades
 * to nothing while the new line fades in. Declarative SMIL rather than CSS keyframes so the
 * animation needs no injected stylesheet, and `prefers-reduced-motion` skips the whole crossfade
 * (the component never sets `fading` then, so nothing renders here).
 */
function FadingLine({ geometry, bars, view }: { geometry: GraphGeometry; bars: PriceBar[]; view: GraphView }) {
  const span = Math.max(view.end - view.start, 1e-6);
  const slot = geometry.plotWidth / span;
  const domain = priceDomain(bars, view);
  const first = Math.max(Math.floor(view.start) - 1, 0);
  const last = Math.min(Math.ceil(view.end), bars.length - 1);
  let d = "";
  let pen = false;
  for (let index = first; index <= last; index++) {
    const close = bars[index]?.close;
    if (!Number.isFinite(close)) {
      pen = false;
      continue;
    }
    const x = (index - view.start + 0.5) * slot;
    const y = geometry.priceTop + ((domain.hi - close) / (domain.hi - domain.lo)) * (geometry.priceBottom - geometry.priceTop);
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  }
  if (!d) return null;
  return (
    <path d={d} fill="none" stroke="rgb(var(--muted-foreground))" strokeWidth={1.5} strokeLinejoin="round" opacity={0.5}>
      <animate attributeName="opacity" from="0.5" to="0" dur={`${FADE_MS}ms`} fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1" />
      <animate attributeName="display" from="inline" to="none" begin={`${FADE_MS}ms`} fill="freeze" />
    </path>
  );
}
