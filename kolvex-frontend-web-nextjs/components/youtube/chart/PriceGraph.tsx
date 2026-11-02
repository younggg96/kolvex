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
 * Compact mode makes the plot the "open advanced chart" hit target: the pointer only pans / scrubs
 * after a short drag threshold, so a tap still opens. Advanced mode is a `role="slider"` the host
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
import { cn } from "@/lib/utils";
import { formatChangePercent, formatPrice, formatVolume, type PriceBar } from "@/lib/stockApi";
import {
  GRAPH_AXIS_WIDTH,
  GRAPH_MIN_BARS,
  GRAPH_TIME_AXIS,
  GRAPH_TOP_PAD,
  clampGraphView,
  dateTickIndices,
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
  const domain = priceDomain(list, count ? view : { start: 0, end: 1 });
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
  /** Height classes for the plot box, e.g. `h-[260px] sm:h-[320px]` (workspace `h-[320px] sm:h-[420px]`). */
  heightClass: string;
  bars: PriceBar[] | null;
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
  /** Controls placed in the graph's control row before the range bar. */
  leadingControls?: ReactNode;
  /** Controls placed in the graph's control row after the range bar. */
  trailingControls?: ReactNode;
  /** Called with the geometry after every resize / view / data change (drawing host hooks). */
  onGeometry?: (geometry: GraphGeometry) => void;
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
  leadingControls,
  trailingControls,
  onGeometry,
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
  const gesture = useRef<{ kind: "pan"; x: number; moved: boolean; view: GraphView } | { kind: "pinch"; distance: number; mid: number; view: GraphView } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const suppressClick = useRef(false);
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
    () => graphGeometry({ bars, times, view: current, width: size.width, height: size.height, intraday, interval, topPad: advanced ? GRAPH_TOP_PAD : GRAPH_TOP_PAD - 6 }),
    [bars, times, current, size.width, size.height, intraday, interval, advanced],
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
    onViewChange(null);
    onActiveChange(null);
  };

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
        panBy((event.deltaX / geometry.plotWidth) * span);
        return;
      }
      if (!advanced && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
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
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const rect = plotRef.current!.getBoundingClientRect();
      gesture.current = { kind: "pinch", distance: Math.abs(a.x - b.x) || 1, mid: Math.min(Math.max(((a.x + b.x) / 2 - rect.left) / geometry.plotWidth, 0), 1), view: current };
      suppressClick.current = true;
      return;
    }
    if (event.button !== 0) return;
    // Compact: capturing the pointer would swallow the tap that opens the advanced chart.
    if (advanced) event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { kind: "pan", x: event.clientX, moved: false, view: current };
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
    suppressClick.current = true;
    setDragging(true);
    const slot = geometry.plotWidth / Math.max(now.view.end - now.view.start, 1e-6);
    commit({ start: now.view.start - dx / slot, end: now.view.end - dx / slot });
  };

  const endGesture = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const now = gesture.current;
    if (now?.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    if (now?.moved) suppressClick.current = true;
    gesture.current = null;
    setDragging(false);
  };

  const onPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current || event.buttons) return;
    if (activeIndex !== null) onActiveChange(null);
  };

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onOpenAdvanced?.();
  };

  const onPlotDoubleClick = () => {
    if (!count) return;
    suppressClick.current = true;
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
  const headerChange = headerBar && firstBar && firstBar.close ? ((headerBar.close - firstBar.close) / firstBar.close) * 100 : 0;
  const tone: StrengthTone = headerChange > 0 ? "positive" : headerChange < 0 ? "negative" : "neutral";
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
        className="flex min-w-0 basis-full items-center gap-0.5 overflow-x-auto scrollbar-hide sm:basis-auto"
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
                "inline-flex h-11 shrink-0 select-none items-center justify-center rounded-full px-3 text-[13px] font-semibold transition-colors duration-150 sm:h-8",
                "focus-visible:outline-none focus-visible:bg-muted/60",
                "disabled:pointer-events-none disabled:opacity-40",
                selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
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
              "inline-flex h-11 max-w-[min(15rem,52vw)] shrink-0 items-center justify-center rounded-full px-3 text-[13px] font-semibold transition-colors duration-150 sm:h-8",
              "focus-visible:outline-none focus-visible:bg-muted/60",
              range === "CUSTOM" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
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
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:bg-muted/60 sm:h-8"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t("youtubeOpinions.graph.resetZoom")}
        </button>
      )}
    </>
  );

  const iconButton = (active: boolean) =>
    cn(
      "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:bg-muted/60 sm:h-8 sm:w-8",
      active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
    );

  const plotTone = toneColor[tone];

  const body = (
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
      firstBar={firstBar}
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
      onClick={onOpenAdvanced ? onClick : undefined}
      onDoubleClick={onPlotDoubleClick}
      onKeyDown={advanced ? onKeyDown : undefined}
      ariaLabel={
        advanced
          ? plotAriaLabel || t("youtubeOpinions.priceChartLabel")
          : plotAriaLabel ||
            t("youtubeOpinions.graph.plotLabel", {
              symbol,
              price: headerBar ? formatPrice(headerBar.close) : "—",
              change: formatChangePercent(headerChange),
            })
      }
      dragging={dragging}
    />
  );

  if (error) {
    return (
      <div className={cn("flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground", heightClass)} role="alert">
        <span>{t("youtubeOpinions.priceUnavailable")}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-11 items-center rounded-full border border-border px-4 text-[13px] font-semibold text-foreground transition-colors hover:border-foreground/25 hover:bg-foreground/[0.06] focus-visible:outline-none sm:h-8"
          >
            {t("common.retry")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", advanced && "flex min-h-0 flex-1 flex-col")}>
      {/* header: price · change · window label, as in the reference */}
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {headerLabel}
        {headerBar ? (
          <span className="flex min-w-0 items-baseline gap-2" aria-live="polite">
            <span className="text-[15px] font-semibold tabular-nums text-foreground">{formatPrice(headerBar.close)}</span>
            <span className={cn("text-[13px] font-semibold tabular-nums", headerChange > 0 ? "text-positive" : headerChange < 0 ? "text-negative" : "text-muted-foreground")}>
              {formatChangePercent(headerChange)}
            </span>
            <span className="text-[11px] text-muted-foreground">{rangeChangeLabel || t("youtubeOpinions.priceRangeChange")}</span>
          </span>
        ) : (
          loading || !bars ? <Skeleton className="h-5 w-32" aria-hidden="true" /> : null
        )}
        {activeBar && activeIndex !== null && (
          <span className="text-[11px] tabular-nums text-muted-foreground">{barLabel(activeBar)}</span>
        )}
      </div>

      <div className={cn("mt-1.5", advanced && "flex min-h-0 flex-1 flex-col")}>{body}</div>

      {/* Phones stack the range bar over the icon row so a long label never hides the icons. */}
      <div className="mt-1.5 flex shrink-0 flex-col items-stretch gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
        <div className="flex w-full min-w-0 flex-1 items-center gap-1 sm:w-auto">
          {leadingControls}
          {rangeBar}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1 sm:justify-start">
          {trailingControls}
          {advanced ? (
            <>
              <button type="button" aria-label={t("youtubeOpinions.zoomIn")} title={t("youtubeOpinions.zoomIn")} onClick={() => zoomBy(0.8, 0.5)} className={iconButton(false)}>
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label={t("youtubeOpinions.zoomOut")} title={t("youtubeOpinions.zoomOut")} onClick={() => zoomBy(1.25, 0.5)} className={iconButton(false)}>
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
            </>
          ) : (
            onOpenAdvanced && (
              <button
                type="button"
                onClick={onOpenAdvanced}
                className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:bg-muted/60 sm:h-8"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("youtubeOpinions.advancedChart")}
              </button>
            )
          )}
        </div>
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
  firstBar,
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
  onClick,
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
  firstBar: PriceBar | null;
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
  onClick?: () => void;
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
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      className={cn(
        "relative select-none overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:bg-muted/20",
        heightClass,
        advanced ? "touch-none" : "touch-pan-y",
        advanced ? "" : "cursor-pointer",
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
              {firstBar && (
                <line
                  x1={0}
                  x2={geometry.plotWidth}
                  y1={geometry.yOf(firstBar.close)}
                  y2={geometry.yOf(firstBar.close)}
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
            Array.from(calls.entries()).map(([index, entry]) => {
              const bar = bars?.[index];
              if (!bar || index < geometry.firstIndex || index > geometry.lastIndex) return null;
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
                className="pointer-events-none absolute -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground/80"
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
              decimals={0}
            />
          )}
          {tooltipPill(activeBar, activeIndex, activeBar ? { x: geometry.xOf(activeIndex!), y: geometry.yOf(activeBar.close) } : null, geometry, plotTone, activeLabel, advanced)}
  
          {/* date labels: three or four, never dense */}
          {timeTicks.map((tick) => (
            <span
              key={tick.index}
              aria-hidden="true"
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground sm:text-[11px]"
              style={{ left: tick.x, top: geometry.plotHeight + 6 }}
            >
              {tick.label}
            </span>
          ))}
  
          {/* host popover for the active bar (creator calls) */}
          {activeBar && activeIndex !== null && (renderEventPopover ? renderEventPopover(activeIndex) : eventsAt?.(activeIndex))}
  
          {drawingLayer && (
            <div className="absolute left-0 top-0 overflow-hidden" style={{ width: geometry.plotWidth, height: geometry.axisBlock.h }}>
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
        className="pointer-events-none absolute z-20 inline-flex items-baseline gap-1.5 whitespace-nowrap rounded-full bg-foreground px-2 py-1 text-[11px] font-medium leading-none tabular-nums text-background shadow-sm"
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
