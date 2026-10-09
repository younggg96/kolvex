"use client";

import { DEFAULT_TECHNICAL_FOCUS, type TechnicalFocus } from "@/lib/technicalFocus";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent,
} from "react";
import {
  Activity,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  GanttChart,
  Loader2,
  Lock,
  LockOpen,
  Magnet,
  Maximize2,
  Minus,
  MousePointer2,
  MoveUpRight,
  RectangleHorizontal,
  RotateCcw,
  Ruler,
  ScanSearch,
  Slash,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import CreatorAvatar from "../CreatorAvatar";
import type { YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import {
  AiAnalysisError,
  formatChangePercent,
  formatPrice,
  formatVolume,
  getAiTechnicalAnalysis,
  getStockHistory,
  type AiTechnicalAnalysis,
  type PriceBar,
  type PriceHistoryParams,
} from "@/lib/stockApi";
import ChartDrawingLayer from "../ChartDrawingLayer";
import { drawingColors, newDrawingId, type Anchor, type Drawing, type DrawingTool, type SyncStatus } from "../chartDrawings";
import { toneStroke, toneText, type StrengthTone } from "../strength";
import AiAnalysisPanel from "./AiAnalysisPanel";
import { computeIndicators, indicatorMeta, indicatorOrder, vwap, type IndicatorKey, type Series } from "./indicators";
import {
  advancedHistoryParams,
  advancedRanges,
  defaultInterval,
  isIntraday,
  rangeIntervals,
  rangeStart,
  type AdvancedRange,
  type ChartInterval,
} from "./timeframes";

type Translate = (key: string, params?: Record<string, string>) => string;
type Mode = "compact" | "advanced";
type View = { start: number; end: number };
type Draft = {
  drawing: Drawing;
  start: { x: number; y: number };
  awaitingSecond: boolean;
};
type Gesture =
  | {
      kind: "edit";
      id: string;
      handle: number | "body";
      origin: Anchor;
      before: Drawing[];
      moved: boolean;
    }
  | { kind: "pan"; x: number; view: View; moved: boolean }
  | { kind: "pinch"; distance: number; mid: number; view: View };
type Calls = {
  bullish: YouTubeOpinion[];
  bearish: YouTubeOpinion[];
  other: YouTubeOpinion[];
};

const AXIS_WIDTH = 60;
const TIME_AXIS = 22;
const SNAP_PX = 12;
const MIN_BARS = 8;
const HEIGHT_CLASS: Record<Mode, string> = {
  compact: "h-[260px] sm:h-[320px]",
  advanced: "h-[calc(100dvh-210px)] min-h-[320px]",
};
const defaultIndicators: Record<Mode, IndicatorKey[]> = {
  compact: ["volume"],
  advanced: ["volume", "vwap", "ema20", "ema50", "ema200"],
};

const tools: Array<{
  value: DrawingTool;
  icon: ComponentType<{ className?: string }>;
  label: string;
}> = [
  { value: "cursor", icon: MousePointer2, label: "toolCursor" },
  { value: "trend", icon: Slash, label: "toolTrend" },
  { value: "ray", icon: MoveUpRight, label: "toolRay" },
  { value: "hline", icon: Minus, label: "toolHline" },
  { value: "rect", icon: RectangleHorizontal, label: "toolRect" },
  { value: "fib", icon: GanttChart, label: "toolFib" },
  { value: "measure", icon: Ruler, label: "toolMeasure" },
];
const syncIcons: Record<SyncStatus, ComponentType<{ className?: string }>> = {
  loading: Loader2,
  syncing: Loader2,
  synced: Cloud,
  local: CloudOff,
  offline: CloudOff,
};
const callTone: Record<keyof Calls, StrengthTone> = {
  bullish: "positive",
  bearish: "negative",
  other: "neutral",
};
const sentimentTone = (sentiment: YouTubeOpinion["sentiment"]): StrengthTone =>
  sentiment === "bullish" ? "positive" : sentiment === "bearish" ? "negative" : "neutral";

function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

function readIndicators(mode: Mode): IndicatorKey[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(`kolvex:chart-indicators:${mode}`) || "null");
    if (Array.isArray(saved)) return saved.filter((key) => key in indicatorMeta);
  } catch {
    // Fall back to the defaults.
  }
  return defaultIndicators[mode];
}

function CallMarker({ direction, count, x, y }: { direction: "up" | "down" | "dot"; count: number; x: number; y: number }) {
  const color = toneStroke[direction === "up" ? "positive" : direction === "down" ? "negative" : "neutral"];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute flex -translate-x-1/2 items-center gap-px text-[10px] font-semibold leading-none tabular-nums",
        direction === "down" ? "-translate-y-full flex-col-reverse" : "flex-col",
      )}
      style={{ left: x, top: y, color }}
    >
      {direction === "dot" ? (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <svg width={9} height={7} viewBox="0 0 9 7" className="drop-shadow-[0_0_1px_rgb(var(--background))]">
          <path d={direction === "up" ? "M4.5 0L9 7H0z" : "M0 0h9L4.5 7z"} fill={color} />
        </svg>
      )}
      {count > 1 && <span>{count}</span>}
    </span>
  );
}

export interface ChartViewProps {
  mode: Mode;
  symbol: string;
  /** Compact mode loads this window; advanced mode picks its own range and interval. */
  params: PriceHistoryParams;
  events: YouTubeOpinion[];
  drawings: Drawing[];
  setDrawings: (next: Drawing[], recordFrom?: Drawing[] | null) => void;
  undo: () => void;
  canUndo: boolean;
  syncStatus: SyncStatus;
  formatDate: (date: string) => string;
  t: Translate;
  onOpenAdvanced?: () => void;
  onAnalysisChange?: (result: AiTechnicalAnalysis | null) => void;
  onDrawingsChange?: (result: AiTechnicalAnalysis | null) => void;
  savedDrawings?: AiTechnicalAnalysis | null;
  drawingRequest?: number;
  aiBusy?: boolean;
  savedAnalysis?: AiTechnicalAnalysis | null;
  snapshotBars?: PriceBar[];
  generationRequest?: number;
  technicalFocus?: TechnicalFocus;
  onAnalysisBusy?: (busy: boolean) => void;
  /** Advanced mode runs inside a dialog that owns Escape; this lets the chart consume it first. */
  escapeRef?: MutableRefObject<(() => boolean) | null>;
}

/**
 * Candlestick chart with zoom and pan, price and time axes, indicators, creator calls,
 * drawing tools and AI-drawn levels. Compact mode sits in the page; advanced mode fills a dialog.
 */
export default function ChartView({
  mode,
  symbol,
  params: compactParams,
  events,
  drawings,
  setDrawings,
  undo,
  canUndo,
  syncStatus,
  formatDate,
  t,
  onOpenAdvanced,
  onAnalysisChange,
  onDrawingsChange,
  savedDrawings,
  drawingRequest = 0,
  aiBusy = false,
  savedAnalysis,
  snapshotBars,
  generationRequest = 0,
  technicalFocus = DEFAULT_TECHNICAL_FOCUS,
  onAnalysisBusy,
  escapeRef,
}: ChartViewProps) {
  const advanced = mode === "advanced";
  const [range, setRange] = useState<AdvancedRange>("3M");
  const [interval, setChartInterval] = useState<ChartInterval>(defaultInterval["3M"]);
  const params = advanced && !snapshotBars ? advancedHistoryParams(range, interval) : compactParams;
  const paramsKey = JSON.stringify(params);
  const intraday = isIntraday(params.interval || "1d");

  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bars, setBars] = useState<PriceBar[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View | null>(null);
  const [autoScale, setAutoScale] = useState(true);
  const [active, setActive] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [tool, setTool] = useState<DrawingTool>("cursor");
  const [color, setColor] = useState(drawingColors[0]);
  const [magnet, setMagnet] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showCalls, setShowCalls] = useState(true);
  const [indicators, setIndicators] = useState<IndicatorKey[]>(defaultIndicators[mode]);
  const [ai, setAi] = useState<{
    status: "idle" | "loading" | "done" | "error";
    result?: AiTechnicalAnalysis;
    error?: string;
  }>({
    status: "idle",
  });
  const [drawingAi, setDrawingAi] = useState<{ status: "idle" | "loading" | "done" | "error"; error?: string }>({ status: "idle" });
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const aiRequest = useRef<AbortController | null>(null);

  useEffect(() => setIndicators(readIndicators(mode)), [mode]);

  useEffect(() => {
    const controller = new AbortController();
    setBars(null);
    setError(false);
    setActive(null);
    setView(null);
    if (snapshotBars) { setBars(snapshotBars); return () => controller.abort(); }
    getStockHistory(symbol, JSON.parse(paramsKey), controller.signal)
      .then(setBars)
      .catch((reason) => {
        if (!controller.signal.aborted) {
          console.error("Failed to load price history:", reason);
          setError(true);
        }
      });
    return () => controller.abort();
  }, [symbol, paramsKey, attempt, snapshotBars]);

  useEffect(() => {
    setSelectedId(null);
    setDraft(null);
    setAi({ status: "idle" });
    setDrawingAi({ status: "idle" });
    aiRequest.current?.abort();
  }, [symbol]);

  useEffect(() => {
    if (!box) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);

  const count = bars?.length ?? 0;
  const times = useMemo(() => (bars || []).map((bar) => Date.parse(bar.date)), [bars]);
  const series = useMemo(() => computeIndicators(bars || [], intraday), [bars, intraday]);

  const defaultView = useMemo<View>(() => {
    if (!count) return { start: 0, end: 1 };
    if (!advanced) return { start: 0, end: count };
    const startTime = rangeStart(range, times[count - 1]);
    const first =
      startTime === null
        ? 0
        : Math.max(
            times.findIndex((time) => time >= startTime),
            0,
          );
    return {
      start: Math.min(first, count - MIN_BARS),
      end: count + Math.max((count - first) * 0.04, 1),
    };
  }, [advanced, count, range, times]);
  const current = view || defaultView;

  /**
   * Daily bars: a call made on a weekend or holiday lands on the next session.
   * Weekly or monthly bars: it lands on the bar that contains it. Intraday: the session's first bar.
   */
  const calls = useMemo(() => {
    const byBar = new Map<number, Calls>();
    if (!bars?.length) return byBar;
    const containing = params.interval === "1wk" || params.interval === "1mo";
    const starts = bars.map((bar) => bar.date.slice(0, 10));
    for (const opinion of events) {
      const date = opinion.opinion_date?.slice(0, 10);
      if (!date || date < starts[0]) continue;
      let index = containing ? starts.findLastIndex((start) => start <= date) : starts.findIndex((start) => start >= date);
      if (index === -1) {
        if (containing) continue;
        if ((Date.parse(date) - Date.parse(starts[starts.length - 1])) / 86_400_000 > 4) continue;
        index = starts.length - 1;
      }
      const entry = byBar.get(index) || { bullish: [], bearish: [], other: [] };
      entry[opinion.sentiment === "bullish" ? "bullish" : opinion.sentiment === "bearish" ? "bearish" : "other"].push(opinion);
      byBar.set(index, entry);
    }
    return byBar;
  }, [bars, events, params.interval]);

  function clampView(next: View): View {
    const minSpan = Math.min(MIN_BARS, count);
    const span = Math.min(Math.max(next.end - next.start, minSpan), count * 1.15 + 4);
    const start = Math.min(Math.max(next.start, -span * 0.1), count - Math.min(span * 0.3, count));
    return { start, end: start + span };
  }

  const zoomRef = useRef<(factor: number, anchorRatio: number) => void>(() => {});
  const panRef = useRef<(bars: number) => void>(() => {});
  zoomRef.current = (factor, anchorRatio) => {
    const span = current.end - current.start;
    const anchor = current.start + span * anchorRatio;
    const nextSpan = span * factor;
    setView(
      clampView({
        start: anchor - nextSpan * anchorRatio,
        end: anchor - nextSpan * anchorRatio + nextSpan,
      }),
    );
  };
  panRef.current = (shift) => setView(clampView({ start: current.start + shift, end: current.end + shift }));

  useEffect(() => {
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      const rect = box.getBoundingClientRect();
      const plotWidth = rect.width - AXIS_WIDTH;
      const ratio = Math.min(Math.max((event.clientX - rect.left) / plotWidth, 0), 1);
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (horizontal) {
        event.preventDefault();
        const span = current.end - current.start || 1;
        panRef.current((event.deltaX / plotWidth) * span);
        return;
      }
      if (!advanced && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomRef.current(Math.exp(event.deltaY * (event.ctrlKey ? 0.01 : 0.0015)), ratio);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  });

  const activeIndicators = new Set(indicators);
  const showVolume = activeIndicators.has("volume");
  const plotW = Math.max(size.width - AXIS_WIDTH, 1);
  const plotH = Math.max(size.height - TIME_AXIS, 1);
  const volumeH = showVolume ? plotH * 0.18 : 0;
  const priceTop = 18;
  const priceBottom = plotH - volumeH - 16;
  const span = current.end - current.start;
  const slot = plotW / span;
  const xOf = (index: number) => (index - current.start + 0.5) * slot;
  const firstVisible = Math.max(Math.floor(current.start), 0);
  const lastVisible = Math.min(Math.ceil(current.end), count) - 1;
  const vwapAnchor = intraday ? 0 : firstVisible;
  const vwapSeries = useMemo(() => vwap(bars || [], intraday, vwapAnchor), [bars, intraday, vwapAnchor]);
  const lines: Record<"vwap" | "ema5" | "ema20" | "ema50" | "ema200", Series> = { ...series, vwap: vwapSeries };

  useEffect(() => {
    setAi(savedAnalysis ? { status: "done", result: savedAnalysis } : { status: "idle" });
  }, [savedAnalysis]);
  useEffect(() => { setDrawingAi({ status: savedDrawings ? "done" : "idle" }); }, [savedDrawings]);
  useEffect(() => { onAnalysisBusy?.(ai.status === "loading" || drawingAi.status === "loading"); }, [ai.status, drawingAi.status, onAnalysisBusy]);
  useEffect(() => () => { aiRequest.current?.abort(); }, []);
  const handledGeneration = useRef(0);
  useEffect(() => {
    if (generationRequest <= handledGeneration.current || !count) return;
    handledGeneration.current = generationRequest;
    void runAi("analysis");
    // The request uses the current visible chart window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationRequest, count]);


  const handledDrawing = useRef(0);
  useEffect(() => {
    if (drawingRequest <= handledDrawing.current || !count) return;
    handledDrawing.current = drawingRequest;
    void runAi("drawings");
    // Uses the same visible window, independently of text analysis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingRequest, count]);

  const yRange = useMemo(() => {
    if (!bars?.length) return { lo: 0, hi: 1, maxVolume: 1 };
    const from = autoScale ? firstVisible : 0;
    const to = autoScale ? lastVisible : bars.length - 1;
    let lo = Infinity;
    let hi = -Infinity;
    let maxVolume = 1;
    for (let index = Math.max(from, 0); index <= Math.min(to, bars.length - 1); index++) {
      lo = Math.min(lo, bars[index].low);
      hi = Math.max(hi, bars[index].high);
      maxVolume = Math.max(maxVolume, bars[index].volume || 0);
    }
    if (!Number.isFinite(lo)) return { lo: 0, hi: 1, maxVolume };
    const pad = (hi - lo || hi * 0.01 || 1) * 0.06;
    return { lo: lo - pad, hi: hi + pad, maxVolume };
  }, [bars, autoScale, firstVisible, lastVisible]);

  if (error) {
    return (
      <div
        className={cn("flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground", HEIGHT_CLASS[mode])}
        role="alert"
      >
        <span>{t("youtubeOpinions.priceUnavailable")}</span>
        <Button size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const yOf = (price: number) => priceTop + ((yRange.hi - price) / (yRange.hi - yRange.lo)) * (priceBottom - priceTop);
  const priceAt = (py: number) => yRange.hi - ((py - priceTop) / (priceBottom - priceTop)) * (yRange.hi - yRange.lo);
  const msPerBar = count > 1 ? (times[count - 1] - times[0]) / (count - 1) : 86_400_000;
  const indexAt = (time: number) => {
    if (time <= times[0]) return (time - times[0]) / msPerBar;
    if (time >= times[count - 1]) return count - 1 + (time - times[count - 1]) / msPerBar;
    let low = 0;
    let high = count - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (times[middle] <= time) low = middle;
      else high = middle;
    }
    return low + (time - times[low]) / (times[high] - times[low]);
  };
  const timeAt = (index: number) => {
    if (index <= 0 || count < 2) return times[0] + index * msPerBar;
    if (index >= count - 1) return times[count - 1] + (index - count + 1) * msPerBar;
    const base = Math.floor(index);
    return times[base] + (index - base) * (times[base + 1] - times[base]);
  };
  const toPx = (anchor: Anchor) => ({
    x: xOf(indexAt(anchor.time)),
    y: yOf(anchor.price),
  });
  const barsBetween = (a: Anchor, b: Anchor) => Math.round(indexAt(b.time) - indexAt(a.time));
  const barLabel = (bar: PriceBar) => `${formatDate(bar.date.slice(0, 10))}${intraday ? ` ${bar.date.slice(11, 16)}` : ""}`;

  const drawing = tool !== "cursor";
  const selected = drawings.find((item) => item.id === selectedId) || null;
  const SyncIcon = syncIcons[syncStatus];
  const loaded = Boolean(bars && count && size.width);
  const last = bars?.[count - 1];
  const activeBar = active === null || !bars ? null : bars[active] || null;
  const shownBar = activeBar || (bars && lastVisible >= 0 ? bars[Math.min(lastVisible, count - 1)] : null);
  const shownIndex = activeBar ? active! : Math.min(lastVisible, count - 1);
  const firstShown = bars?.[Math.max(firstVisible, 0)];
  const rangeChange =
    firstShown && shownBar && firstShown.close ? ((shownBar.close - firstShown.close) / firstShown.close) * 100 : 0;
  const activeCalls = active === null || !showCalls ? null : calls.get(active) || null;
  const activeEvents = activeCalls ? [...activeCalls.bullish, ...activeCalls.bearish, ...activeCalls.other] : [];

  function locate(clientX: number, clientY: number, snap = magnet) {
    const rect = box!.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    let index = px / slot + current.start - 0.5;
    let price = priceAt(py);
    if (snap && bars) {
      index = Math.min(Math.max(Math.round(index), 0), count - 1);
      const bar = bars[index];
      const nearest = [bar.open, bar.high, bar.low, bar.close].reduce((best, value) =>
        Math.abs(yOf(value) - py) < Math.abs(yOf(best) - py) ? value : best,
      );
      if (Math.abs(yOf(nearest) - py) <= SNAP_PX) price = nearest;
    }
    return { anchor: { time: timeAt(index), price }, px, py };
  }

  function commit(item: Drawing) {
    setDrawings([...drawings, item]);
    setDraft(null);
    setSelectedId(item.id);
    setTool("cursor");
  }

  function removeSelected() {
    if (!selectedId) return;
    setDrawings(drawings.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  }

  function pickColor(value: string) {
    setColor(value);
    if (selected) setDrawings(drawings.map((item) => (item.id === selected.id ? { ...item, color: value } : item)));
  }

  function toggleIndicator(key: IndicatorKey) {
    const next = activeIndicators.has(key) ? indicators.filter((item) => item !== key) : [...indicators, key];
    setIndicators(next);
    try {
      window.localStorage.setItem(`kolvex:chart-indicators:${mode}`, JSON.stringify(next));
    } catch {
      // Preference only.
    }
  }

  function scrubTo(px: number) {
    if (!count) return;
    const index = Math.round(px / slot + current.start - 0.5);
    setActive(px > plotW || index < 0 || index >= count ? null : index);
  }

  function resetView() {
    setView(null);
    setAutoScale(true);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!loaded) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const rect = box!.getBoundingClientRect();
      gesture.current = {
        kind: "pinch",
        distance: Math.abs(a.x - b.x) || 1,
        mid: ((a.x + b.x) / 2 - rect.left) / plotW,
        view: current,
      };
      setDraft(null);
      return;
    }
    if (event.button !== 0) return;
    const { anchor, px, py } = locate(event.clientX, event.clientY);
    scrubTo(px);
    if (px > plotW) return;
    if (drawing) {
      event.currentTarget.setPointerCapture(event.pointerId);
      const type = tool as Drawing["type"];
      if (type === "hline") commit({ id: newDrawingId(), type, points: [anchor], color });
      else if (draft?.awaitingSecond) commit({ ...draft.drawing, points: [draft.drawing.points[0], anchor] });
      else
        setDraft({
          drawing: {
            id: newDrawingId(),
            type,
            points: [anchor, anchor],
            color,
          },
          start: { x: px, y: py },
          awaitingSecond: false,
        });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const target = (event.target as Element).closest<SVGElement>("[data-drawing]");
    if (target?.dataset.drawing) {
      const handle = target.dataset.handle;
      setSelectedId(target.dataset.drawing);
      gesture.current = {
        kind: "edit",
        id: target.dataset.drawing,
        handle: handle === undefined ? "body" : Number(handle),
        origin: locate(event.clientX, event.clientY, false).anchor,
        before: drawings,
        moved: false,
      };
      return;
    }
    setSelectedId(null);
    gesture.current = {
      kind: "pan",
      x: event.clientX,
      view: current,
      moved: false,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!loaded) return;
    if (pointers.current.has(event.pointerId))
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    const now = gesture.current;
    if (now?.kind === "pinch" && pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const ratio = now.distance / (Math.abs(a.x - b.x) || 1);
      const base = now.view.end - now.view.start;
      const anchor = now.view.start + base * now.mid;
      setView(
        clampView({
          start: anchor - base * ratio * now.mid,
          end: anchor + base * ratio * (1 - now.mid),
        }),
      );
      return;
    }
    const { anchor, px, py } = locate(event.clientX, event.clientY);
    scrubTo(px);
    setHoverY(px <= plotW && py <= priceBottom + 8 ? py : null);
    if (now?.kind === "pan") {
      const dx = event.clientX - now.x;
      if (Math.abs(dx) > 3) now.moved = true;
      if (now.moved)
        setView(
          clampView({
            start: now.view.start - dx / slot,
            end: now.view.end - dx / slot,
          }),
        );
      return;
    }
    if (now?.kind === "edit") {
      const free = locate(event.clientX, event.clientY, false).anchor;
      const shift = indexAt(free.time) - indexAt(now.origin.time);
      const lift = free.price - now.origin.price;
      const next = now.before.map((item) => {
        if (item.id !== now.id) return item;
        const points =
          now.handle === "body"
            ? item.points.map((point) => ({
                time: timeAt(indexAt(point.time) + shift),
                price: point.price + lift,
              }))
            : item.points.map((point, index) => (index === now.handle ? anchor : point));
        return { ...item, points };
      });
      now.moved = true;
      setDrawings(next, null);
      return;
    }
    if (draft)
      setDraft({
        ...draft,
        drawing: {
          ...draft.drawing,
          points: [draft.drawing.points[0], anchor],
        },
      });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    const now = gesture.current;
    if (now?.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    gesture.current = null;
    if (now?.kind === "edit" && now.moved) {
      setDrawings(drawings, now.before);
      return;
    }
    if (draft && !draft.awaitingSecond) {
      const { px, py } = locate(event.clientX, event.clientY);
      if (Math.hypot(px - draft.start.x, py - draft.start.y) > 5) commit(draft.drawing);
      else setDraft({ ...draft, awaitingSecond: true });
    }
  }

  function cancelOne() {
    if (draft) setDraft(null);
    else if (drawing) setTool("cursor");
    else if (selectedId) setSelectedId(null);
    else if (active !== null) setActive(null);
    else return false;
    return true;
  }
  if (escapeRef) escapeRef.current = cancelOne;

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") undo();
    else if ((event.key === "Delete" || event.key === "Backspace") && selectedId) removeSelected();
    else if (event.key === "Escape") {
      if (escapeRef) return;
      if (!cancelOne()) return;
    } else if (event.key === "ArrowLeft") setActive(Math.max((active ?? lastVisible) - 1, 0));
    else if (event.key === "ArrowRight") setActive(Math.min((active ?? lastVisible) + 1, count - 1));
    else if (event.key === "+" || event.key === "=") zoomRef.current(0.8, 0.5);
    else if (event.key === "-") zoomRef.current(1.25, 0.5);
    else if (event.key === "0") resetView();
    else return;
    event.preventDefault();
  }

  async function runAi(operation: "analysis" | "drawings" = "analysis") {
    if (!bars || !count || aiBusy || ai.status === "loading" || drawingAi.status === "loading") return;
    aiRequest.current?.abort();
    const controller = new AbortController();
    aiRequest.current = controller;
    if (operation === "analysis") setAi({ status: "loading" });
    else setDrawingAi({ status: "loading" });
    const from = bars[Math.max(firstVisible, 0)];
    const to = bars[Math.max(Math.min(lastVisible, count - 1), 0)];
    try {
      const result = await getAiTechnicalAnalysis(
        symbol,
        {
          ...params,
          ...(operation === "analysis" ? technicalFocus : { categories: ["levels", "structure"], custom_scenarios: [] }),
          operation,
          view_start: from.date,
          view_end: to.date,
          locale: t("common.intlLocale") === "zh-CN" ? "zh" : "en",
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (operation === "analysis") {
        setAi({ status: "done", result });
        onAnalysisChange?.(result);
      } else {
        setDrawingAi({ status: "done" });
        onDrawingsChange?.(result);
      }
    } catch (reason) {
      if (controller.signal.aborted) return;
      const status = reason instanceof AiAnalysisError ? reason.status : 0;
      const message = reason instanceof Error ? reason.message : "";
      const error = status === 401 ? t("youtubeOpinions.ai.signIn")
        : message === "ai_not_configured" ? t("youtubeOpinions.ai.notConfigured")
        : t(operation === "analysis" ? "youtubeOpinions.ai.failed" : "youtubeOpinions.ai.drawingsFailed");
      if (operation === "analysis") setAi({ status: "error", error });
      else setDrawingAi({ status: "error", error });
    }
  }

  function clearAi() {
    setAi({ status: "idle" });
    onAnalysisChange?.(null);
  }

  const iconButton = (isActive: boolean) =>
    cn(
      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40",
      isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );
  const stat = (label: string, value: string, tone?: string) => (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className={cn("font-medium", tone || "text-foreground")}>{value}</span>
    </span>
  );
  const pill = (isActive: boolean) =>
    cn(
      "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const path = (values: Series) => {
    let d = "";
    let pen = false;
    for (let index = Math.max(firstVisible - 1, 0); index <= Math.min(lastVisible + 1, count - 1); index++) {
      const value = values[index];
      if (value === null || value === undefined) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const band = () => {
    const upper: string[] = [];
    const lower: string[] = [];
    for (let index = Math.max(firstVisible - 1, 0); index <= Math.min(lastVisible + 1, count - 1); index++) {
      const top = series.bb.upper[index];
      const bottom = series.bb.lower[index];
      if (top === null || bottom === null) continue;
      upper.push(`${xOf(index).toFixed(1)},${yOf(top).toFixed(1)}`);
      lower.unshift(`${xOf(index).toFixed(1)},${yOf(bottom).toFixed(1)}`);
    }
    return upper.length ? `M${upper.join("L")}L${lower.join("L")}Z` : "";
  };

  const priceTicks = (() => {
    const step = niceStep((yRange.hi - yRange.lo) / Math.max((priceBottom - priceTop) / 46, 2));
    const ticks: number[] = [];
    for (let value = Math.ceil(yRange.lo / step) * step; value <= yRange.hi; value += step) ticks.push(value);
    return ticks;
  })();
  const timeTicks = (() => {
    if (!bars || !count) return [] as Array<{ index: number; label: string }>;
    const every = Math.max(Math.ceil(96 / slot), 1);
    const ticks: Array<{ index: number; label: string }> = [];
    const locale = t("common.intlLocale");
    let previousDay = "";
    let previousYear = "";
    for (let index = Math.ceil(Math.max(firstVisible, 0) / every) * every; index <= lastVisible; index += every) {
      const date = bars[index].date;
      const [year, month, day] = date.slice(0, 10).split("-").map(Number);
      const local = new Date(year, month - 1, day);
      let label: string;
      if (intraday) {
        label =
          date.slice(0, 10) === previousDay
            ? date.slice(11, 16)
            : new Intl.DateTimeFormat(locale, {
                month: "numeric",
                day: "numeric",
              }).format(local);
      } else if (params.interval === "1wk" || params.interval === "1mo") {
        label = new Intl.DateTimeFormat(locale, {
          year: "2-digit",
          month: "short",
        }).format(local);
      } else {
        label = new Intl.DateTimeFormat(
          locale,
          String(year) !== previousYear && previousYear
            ? { year: "numeric", month: "short" }
            : { month: "short", day: "numeric" },
        ).format(local);
      }
      previousDay = date.slice(0, 10);
      previousYear = String(year);
      if (xOf(index) > 24 && xOf(index) < plotW - 24) ticks.push({ index, label });
    }
    return ticks;
  })();
  const visibleExtremes = (() => {
    if (!bars || lastVisible < firstVisible) return null;
    let high = firstVisible;
    let low = firstVisible;
    for (let index = firstVisible; index <= lastVisible; index++) {
      if (bars[index].high > bars[high].high) high = index;
      if (bars[index].low < bars[low].low) low = index;
    }
    return { high, low };
  })();
  const edgeX = (index: number) => Math.min(Math.max(xOf(index), 36), plotW - 36);
  const legend = indicatorOrder.filter((key) => key !== "volume" && activeIndicators.has(key));
  const legendValue = (key: IndicatorKey) => {
    const value =
      key === "bb" ? series.bb.middle[shownIndex] : lines[key as keyof typeof lines][shownIndex];
    return value === null || value === undefined ? "—" : value.toFixed(2);
  };
  const lastTone = last && last.close >= (bars?.[count - 2]?.close ?? last.open) ? "positive" : "negative";

  return (
    <div className={cn("min-w-0", advanced && "flex h-full flex-col")}>
      {advanced && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pr-10">
          <h2 className="text-lg font-semibold">{symbol}</h2>
          {last && (
            <span className="flex items-baseline gap-2 text-sm tabular-nums">
              <span className="font-semibold">{formatPrice(last.close)}</span>
              <span className={rangeChange >= 0 ? "text-positive" : "text-negative"}>{formatChangePercent(rangeChange)}</span>
            </span>
          )}
        </div>
      )}

      <div className={cn("flex items-start gap-3", advanced && "mt-2")}>
        <div
          className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] tabular-nums"
          aria-live="polite"
        >
          {shownBar ? (
            activeBar || advanced ? (
              <>
                <span className="font-medium text-foreground">{barLabel(shownBar)}</span>
                {stat(t("youtubeOpinions.priceOpen"), formatPrice(shownBar.open))}
                {stat(t("youtubeOpinions.priceHigh"), formatPrice(shownBar.high))}
                {stat(t("youtubeOpinions.priceLow"), formatPrice(shownBar.low))}
                {stat(
                  t("youtubeOpinions.priceClose"),
                  formatPrice(shownBar.close),
                  shownBar.close >= shownBar.open ? "text-positive" : "text-negative",
                )}
                {shownBar.volume ? stat(t("youtubeOpinions.priceVolume"), formatVolume(shownBar.volume)) : null}
                {activeCalls &&
                  (["bullish", "bearish", "other"] as const).map((key) =>
                    activeCalls[key].length ? (
                      <span key={key} className={cn("whitespace-nowrap font-medium", toneText[callTone[key]])}>
                        {t(`youtubeOpinions.callCount.${key}`, {
                          count: String(activeCalls[key].length),
                        })}
                      </span>
                    ) : null,
                  )}
              </>
            ) : (
              <>
                <span className="text-base font-semibold text-foreground">{formatPrice(shownBar.close)}</span>
                <span className={cn("font-medium", rangeChange >= 0 ? "text-positive" : "text-negative")}>
                  {formatChangePercent(rangeChange)}
                </span>
                <span className="text-muted-foreground">{t("youtubeOpinions.priceRangeChange")}</span>
              </>
            )
          ) : (
            <Skeleton className="h-4 w-48" />
          )}
        </div>
        {onOpenAdvanced && (
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("youtubeOpinions.advancedChart")}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t("youtubeOpinions.ai.actions")}>
        <Button size="sm" variant="outline" className="min-w-[104px]" onClick={() => void runAi("analysis")}
          disabled={!loaded || aiBusy || ai.status === "loading" || drawingAi.status === "loading"}
          title={t("youtubeOpinions.ai.runAnalysis")}>
          {ai.status === "loading" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="mr-1.5 h-3.5 w-3.5" />}
          {t(ai.status === "loading" ? "youtubeOpinions.ai.analysisLoading" : "youtubeOpinions.ai.analysisButton")}
        </Button>
        <Button size="sm" variant="outline" className="min-w-[104px]" onClick={() => void runAi("drawings")}
          disabled={!loaded || aiBusy || ai.status === "loading" || drawingAi.status === "loading"}
          title={t("youtubeOpinions.ai.runDrawings")}>
          {drawingAi.status === "loading" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <GanttChart className="mr-1.5 h-3.5 w-3.5" />}
          {t(drawingAi.status === "loading" ? "youtubeOpinions.ai.drawingLoading" : "youtubeOpinions.ai.button")}
        </Button>
      </div>

      <div
        role="toolbar"
        aria-label={t("youtubeOpinions.drawTools")}
        className="mt-3 flex items-center gap-1 overflow-x-auto border-b border-border pb-2 scrollbar-hide"
      >
        {tools.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              type="button"
              title={t(`youtubeOpinions.${item.label}`)}
              aria-label={t(`youtubeOpinions.${item.label}`)}
              aria-pressed={tool === item.value}
              onClick={() => {
                setTool(item.value);
                setDraft(null);
                if (item.value !== "cursor") setSelectedId(null);
              }}
              className={iconButton(tool === item.value)}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        <div role="radiogroup" aria-label={t("youtubeOpinions.drawColor")} className="flex shrink-0 items-center gap-0.5">
          {drawingColors.map((value, index) => {
            const isCurrent = (selected?.color ?? color) === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isCurrent}
                aria-label={`${t("youtubeOpinions.drawColor")} ${index + 1}`}
                onClick={() => pickColor(value)}
                className="inline-flex h-8 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span
                  className={cn(
                    "h-3.5 w-3.5 rounded-full ring-offset-2 ring-offset-background",
                    isCurrent && "ring-2 ring-foreground/60",
                  )}
                  style={{ backgroundColor: value }}
                />
              </button>
            );
          })}
        </div>
        <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
        <button
          type="button"
          title={t("youtubeOpinions.magnet")}
          aria-label={t("youtubeOpinions.magnet")}
          aria-pressed={magnet}
          onClick={() => setMagnet((value) => !value)}
          className={iconButton(magnet)}
        >
          <Magnet className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t("youtubeOpinions.showCalls")}
          aria-label={t("youtubeOpinions.showCalls")}
          aria-pressed={showCalls}
          onClick={() => setShowCalls((value) => !value)}
          className={iconButton(showCalls)}
        >
          {showCalls ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={t("youtubeOpinions.indicators")}
              aria-label={t("youtubeOpinions.indicators")}
              className={iconButton(legend.length > 0)}
            >
              <Activity className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1.5">
            <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{t("youtubeOpinions.indicators")}</p>
            {indicatorOrder.map((key) => (
              <button
                key={key}
                type="button"
                role="menuitemcheckbox"
                aria-checked={activeIndicators.has(key)}
                onClick={() => toggleIndicator(key)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border border-border text-[10px]",
                    activeIndicators.has(key) && "border-foreground bg-foreground text-background",
                  )}
                  aria-hidden="true"
                >
                  {activeIndicators.has(key) ? "✓" : ""}
                </span>
                <span
                  className="h-0.5 w-3 rounded-full"
                  style={{ backgroundColor: indicatorMeta[key].color }}
                  aria-hidden="true"
                />
                {key === "volume" ? t("youtubeOpinions.priceVolumeFull") : indicatorMeta[key].label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            title={t("youtubeOpinions.zoomIn")}
            aria-label={t("youtubeOpinions.zoomIn")}
            disabled={!loaded}
            onClick={() => zoomRef.current(0.7, 0.85)}
            className={iconButton(false)}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t("youtubeOpinions.zoomOut")}
            aria-label={t("youtubeOpinions.zoomOut")}
            disabled={!loaded}
            onClick={() => zoomRef.current(1.4, 0.85)}
            className={iconButton(false)}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t("youtubeOpinions.resetZoom")}
            aria-label={t("youtubeOpinions.resetZoom")}
            disabled={!view}
            onClick={resetView}
            className={iconButton(false)}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
          <span
            role="status"
            title={t(`youtubeOpinions.sync.${syncStatus}`)}
            aria-label={t(`youtubeOpinions.sync.${syncStatus}`)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center",
              syncStatus === "offline" ? "text-negative" : "text-muted-foreground",
            )}
          >
            <SyncIcon className={cn("h-4 w-4", (syncStatus === "loading" || syncStatus === "syncing") && "animate-spin")} />
          </span>
          <button
            type="button"
            title={t("youtubeOpinions.undo")}
            aria-label={t("youtubeOpinions.undo")}
            disabled={!canUndo}
            onClick={undo}
            className={iconButton(false)}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t("youtubeOpinions.deleteDrawing")}
            aria-label={t("youtubeOpinions.deleteDrawing")}
            disabled={!selectedId}
            onClick={removeSelected}
            className={iconButton(false)}
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t("youtubeOpinions.clearDrawings")}
            aria-label={t("youtubeOpinions.clearDrawings")}
            disabled={!drawings.length}
            onClick={() => {
              setDrawings([]);
              setSelectedId(null);
            }}
            className={iconButton(false)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={cn(advanced && "flex min-h-0 flex-1 flex-col gap-4 lg:flex-row")}>
        <div className="min-w-0 flex-1">
          <div
            ref={setBox}
            role="slider"
            tabIndex={0}
            aria-label={t("youtubeOpinions.priceChartLabel")}
            aria-valuemin={0}
            aria-valuemax={Math.max(count - 1, 0)}
            aria-valuenow={active ?? Math.max(lastVisible, 0)}
            aria-valuetext={activeBar ? `${barLabel(activeBar)} ${formatPrice(activeBar.close)}` : undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={(event) => {
              pointers.current.delete(event.pointerId);
              gesture.current = null;
              setDraft(null);
            }}
            onPointerLeave={() => {
              if (gesture.current) return;
              setActive(null);
              setHoverY(null);
            }}
            onDoubleClick={(event) => {
              if (!drawing && !(event.target as Element).closest("[data-drawing]")) resetView();
            }}
            onKeyDown={handleKey}
            onBlur={() => setActive(null)}
            className={cn(
              "relative mt-3 select-none overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background",
              HEIGHT_CLASS[mode],
              drawing ? "cursor-crosshair" : gesture.current?.kind === "pan" ? "cursor-grabbing" : "cursor-crosshair",
              drawing || selectedId || advanced ? "touch-none" : "touch-pan-y",
            )}
          >
            {!loaded ? (
              <Skeleton className="absolute inset-0" />
            ) : (
              <>
                <svg width={size.width} height={size.height} className="pointer-events-none absolute inset-0" aria-hidden="true">
                  <defs>
                    <clipPath id={`plot-${mode}`}>
                      <rect x={0} y={0} width={plotW} height={plotH} />
                    </clipPath>
                  </defs>
                  {priceTicks.map((value) => (
                    <line key={value} x1={0} x2={plotW} y1={yOf(value)} y2={yOf(value)} stroke="rgb(var(--foreground) / 0.06)" />
                  ))}
                  <g clipPath={`url(#plot-${mode})`}>
                    {activeIndicators.has("bb") && (
                      <>
                        <path d={band()} fill={indicatorMeta.bb.color} fillOpacity={0.07} />
                        <path d={path(series.bb.upper)} fill="none" stroke={indicatorMeta.bb.color} strokeWidth={1} />
                        <path d={path(series.bb.lower)} fill="none" stroke={indicatorMeta.bb.color} strokeWidth={1} />
                        <path
                          d={path(series.bb.middle)}
                          fill="none"
                          stroke={indicatorMeta.bb.color}
                          strokeWidth={1}
                          strokeDasharray="3 3"
                        />
                      </>
                    )}
                    {bars!.slice(firstVisible, lastVisible + 1).map((bar, offset) => {
                      const index = firstVisible + offset;
                      const fill = bar.close >= bar.open ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))";
                      const top = yOf(Math.max(bar.open, bar.close));
                      const bottom = yOf(Math.min(bar.open, bar.close));
                      const cx = xOf(index);
                      const width = Math.max(slot * 0.62, 1);
                      const volume = showVolume ? ((bar.volume || 0) / yRange.maxVolume) * volumeH : 0;
                      return (
                        <g key={bar.date}>
                          {showVolume && (
                            <rect
                              x={cx - width / 2}
                              y={plotH - volume}
                              width={width}
                              height={volume}
                              fill={fill}
                              opacity={0.28}
                            />
                          )}
                          <line x1={cx} x2={cx} y1={yOf(bar.high)} y2={yOf(bar.low)} stroke={fill} strokeWidth={1} />
                          <rect x={cx - width / 2} y={top} width={width} height={Math.max(bottom - top, 1)} fill={fill} />
                        </g>
                      );
                    })}
                    {(["vwap", "ema5", "ema20", "ema50", "ema200"] as const).map((key) =>
                      activeIndicators.has(key) ? (
                        <path
                          key={key}
                          d={path(lines[key])}
                          fill="none"
                          stroke={indicatorMeta[key].color}
                          strokeWidth={1.5}
                          strokeLinejoin="round"
                        />
                      ) : null,
                    )}
                    {last && (
                      <line
                        x1={0}
                        x2={plotW}
                        y1={yOf(last.close)}
                        y2={yOf(last.close)}
                        stroke={lastTone === "positive" ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))"}
                        strokeOpacity={0.45}
                      />
                    )}
                    {visibleExtremes && (
                      <>
                        <text
                          x={edgeX(visibleExtremes.high)}
                          y={yOf(bars![visibleExtremes.high].high) - 6}
                          textAnchor="middle"
                          fontSize={11}
                          fill="rgb(var(--muted-foreground))"
                          className="tabular-nums"
                        >
                          {`H: ${bars![visibleExtremes.high].high.toFixed(2)}`}
                        </text>
                        <text
                          x={edgeX(visibleExtremes.low)}
                          y={yOf(bars![visibleExtremes.low].low) + 14}
                          textAnchor="middle"
                          fontSize={11}
                          fill="rgb(var(--muted-foreground))"
                          className="tabular-nums"
                        >
                          {`L: ${bars![visibleExtremes.low].low.toFixed(2)}`}
                        </text>
                      </>
                    )}
                  </g>
                  <line x1={plotW} x2={plotW} y1={0} y2={plotH} stroke="rgb(var(--border))" />
                  <line x1={0} x2={plotW} y1={plotH} y2={plotH} stroke="rgb(var(--border))" />
                  {priceTicks.map((value) => (
                    <text
                      key={value}
                      x={plotW + 8}
                      y={yOf(value) + 4}
                      fontSize={11}
                      fill="rgb(var(--muted-foreground))"
                      className="tabular-nums"
                    >
                      {value.toFixed(value >= 1000 ? 0 : 2)}
                    </text>
                  ))}
                  {timeTicks.map((tick) => (
                    <text
                      key={tick.index}
                      x={xOf(tick.index)}
                      y={plotH + 15}
                      textAnchor="middle"
                      fontSize={11}
                      fill="rgb(var(--muted-foreground))"
                      className="tabular-nums"
                    >
                      {tick.label}
                    </text>
                  ))}
                </svg>

                {showCalls &&
                  Array.from(calls.entries()).map(([index, entry]) => {
                    if (index < firstVisible || index > lastVisible) return null;
                    const bar = bars![index];
                    const left = xOf(index);
                    const below = yOf(bar.low) + 4;
                    return (
                      <span key={index}>
                        {entry.bearish.length > 0 && (
                          <CallMarker direction="down" count={entry.bearish.length} x={left} y={yOf(bar.high) - 4} />
                        )}
                        {entry.bullish.length > 0 && (
                          <CallMarker direction="up" count={entry.bullish.length} x={left} y={below} />
                        )}
                        {entry.other.length > 0 && (
                          <CallMarker
                            direction="dot"
                            count={entry.other.length}
                            x={left}
                            y={below + (entry.bullish.length ? (entry.bullish.length > 1 ? 20 : 10) : 0)}
                          />
                        )}
                      </span>
                    );
                  })}

                <div className="absolute left-0 top-0 overflow-hidden" style={{ width: plotW, height: plotH }}>
                  <ChartDrawingLayer
                    width={plotW}
                    height={plotH}
                    drawings={drawings}
                    draft={draft?.drawing ?? null}
                    selectedId={selectedId}
                    interactive={!drawing}
                    toPx={toPx}
                    barsBetween={barsBetween}
                    t={t}
                  />
                </div>

                {legend.length > 0 && (
                  <div
                    className="pointer-events-none absolute left-2 top-1 flex flex-wrap gap-x-3 gap-y-0.5 rounded-md bg-background/70 px-1.5 py-0.5 text-[11px] tabular-nums backdrop-blur-sm"
                    style={{ maxWidth: plotW - 16 }}
                  >
                    {legend.map((key) => (
                      <span key={key} className="whitespace-nowrap">
                        <span className="text-muted-foreground">{indicatorMeta[key].label}</span>{" "}
                        <span className="font-semibold" style={{ color: indicatorMeta[key].color }}>
                          {legendValue(key)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {last && yOf(last.close) >= 0 && yOf(last.close) <= plotH && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
                    style={{
                      left: plotW + 2,
                      top: yOf(last.close),
                      backgroundColor: lastTone === "positive" ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))",
                    }}
                  >
                    {last.close.toFixed(2)}
                  </span>
                )}
                {activeBar && (
                  <>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 w-px bg-foreground/25"
                      style={{ left: xOf(active!), height: plotH }}
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-background"
                      style={{
                        left: Math.min(Math.max(xOf(active!), 40), plotW - 40),
                        top: plotH + 2,
                      }}
                    >
                      {barLabel(activeBar)}
                    </span>
                  </>
                )}
                {hoverY !== null && (
                  <>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0 h-px border-t border-dashed border-foreground/25"
                      style={{ top: hoverY, width: plotW }}
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -translate-y-1/2 rounded bg-foreground px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-background"
                      style={{ left: plotW + 2, top: hoverY }}
                    >
                      {priceAt(hoverY).toFixed(2)}
                    </span>
                  </>
                )}

                {activeEvents.length > 0 && !drawing && !gesture.current && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-6 z-10 w-64 max-w-[calc(100%-1rem)] rounded-xl border border-border bg-background/95 p-2.5 text-xs shadow-lg backdrop-blur"
                    style={
                      xOf(active!) > plotW / 2
                        ? { right: Math.max(size.width - xOf(active!) + 12, 0) }
                        : {
                            left: Math.min(xOf(active!) + 12, Math.max(plotW - 256, 0)),
                          }
                    }
                  >
                    <ul className="space-y-2">
                      {activeEvents.slice(0, 4).map((opinion) => (
                        <li key={opinion.id} className="flex min-w-0 gap-2">
                          <CreatorAvatar
                            name={opinion.channel_title || opinion.channel_id}
                            avatarUrl={opinion.channel_avatar_url}
                            size="xs"
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="flex min-w-0 items-baseline gap-1.5">
                              <span className="truncate font-semibold text-foreground">
                                {opinion.channel_title || opinion.channel_id}
                              </span>
                              <span className={cn("shrink-0 font-semibold", toneText[sentimentTone(opinion.sentiment)])}>
                                {t(`youtubeOpinions.${opinion.sentiment}`)}
                              </span>
                            </span>
                            {(opinion.summary || opinion.thesis) && (
                              <span className="mt-0.5 line-clamp-2 leading-4 text-muted-foreground">
                                {opinion.summary || opinion.thesis}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {activeEvents.length > 4 && (
                      <p className="mt-2 text-muted-foreground">
                        {t("youtubeOpinions.moreCalls", {
                          count: String(activeEvents.length - 4),
                        })}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            {advanced ? (
              <>
                <div
                  role="radiogroup"
                  aria-label={t("common.timeRange")}
                  className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide"
                >
                  {advancedRanges.map((item) => (
                    <button
                      key={item}
                      type="button"
                      role="radio"
                      aria-checked={range === item}
                      disabled={!!snapshotBars}
                      onClick={() => {
                        setRange(item);
                        if (!rangeIntervals[item].includes(interval)) setChartInterval(defaultInterval[item]);
                        setView(null);
                      }}
                      className={pill(range === item)}
                    >
                      {t(`youtubeOpinions.advancedRange.${item}`)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-foreground">
                    {t("youtubeOpinions.interval")}
                    <Select disabled={!!snapshotBars} value={snapshotBars ? compactParams.interval : interval} onValueChange={(value) => setChartInterval(value as ChartInterval)}>
                      <SelectTrigger className="h-8 w-[88px] rounded-full text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(snapshotBars && compactParams.interval ? [compactParams.interval] : rangeIntervals[range]).map((item) => (
                          <SelectItem key={item} value={item}>
                            {t(`youtubeOpinions.intervals.${item}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <button
                    type="button"
                    aria-pressed={autoScale}
                    onClick={() => setAutoScale((value) => !value)}
                    className={cn(pill(false), "gap-1.5", autoScale && "text-foreground")}
                  >
                    {autoScale ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                    {t("youtubeOpinions.autoScale")}
                  </button>
                </div>
              </>
            ) : drawing ? (
              <span className="hidden sm:inline">
                {t(tool === "hline" ? "youtubeOpinions.drawHintSingle" : "youtubeOpinions.drawHint")}
              </span>
            ) : (
              <span className="hidden items-center gap-2 sm:inline-flex">
                {showCalls && calls.size > 0 && (
                  <>
                    <span className="text-positive" aria-hidden="true">
                      ▲
                    </span>
                    {t("youtubeOpinions.bullish")}
                    <span className="text-negative" aria-hidden="true">
                      ▼
                    </span>
                    {t("youtubeOpinions.bearish")}
                    <span>{t("youtubeOpinions.opinionMarkers")}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                {t("youtubeOpinions.zoomHint")}
              </span>
            )}
          </div>
        {drawingAi.status !== "idle" && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role={drawingAi.status === "error" ? "alert" : "status"}>
          <span>{drawingAi.status === "loading" ? t("youtubeOpinions.ai.drawingLoading") : drawingAi.status === "error" ? drawingAi.error : t("youtubeOpinions.ai.drawingsReady")}</span>
          {drawingAi.status === "error" && <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => void runAi("drawings")}>{t("youtubeOpinions.ai.retryDrawings")}</Button>}
          {drawingAi.status === "done" && <Button size="sm" variant="ghost" disabled={aiBusy} onClick={() => { setDrawingAi({ status: "idle" }); onDrawingsChange?.(null); }}>{t("youtubeOpinions.ai.clear")}</Button>}
        </div>}

        </div>

        {ai.status !== "idle" && (
          <AiAnalysisPanel
            state={ai}
            busy={aiBusy}
            interval={params.interval || "1d"}
            onRetry={() => void runAi("analysis")}
            onClear={clearAi}
            formatDate={formatDate}
            t={t}
            className={advanced ? "pt-6 lg:w-[340px] lg:shrink-0 lg:overflow-y-auto lg:pt-0" : "mt-6"}
          />
        )}
      </div>
    </div>
  );
}
