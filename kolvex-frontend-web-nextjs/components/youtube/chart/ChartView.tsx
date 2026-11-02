"use client";
import { peekClientCache } from "@/lib/clientCache";
import { stockHistoryKey } from "@/lib/stockApi";

import Link from "next/link";
import { createPortal } from "react-dom";
import { MODEL_CONFIGS, PROVIDER_NAME_TO_ID } from "@/lib/aiModels";
import { useAvailableProviders } from "@/hooks/useAvailableProviders";
import type { useChartAiJobs } from "@/hooks/useChartAiJobs";
import { DEFAULT_TECHNICAL_FOCUS, DEFAULT_DRAWING_FOCUS, type TechnicalFocus } from "@/lib/technicalFocus";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent,
} from "react";
import {
  Activity,
  AlertCircle,
  Cloud,
  ChevronDown,
  CloudOff,
  Eye,
  EyeOff,
  GanttChart,
  Loader2,
  Lock,
  LockOpen,
  Magnet,
  Minus,
  MousePointer2,
  MoveUpRight,
  MoveVertical,
  MoveHorizontal,
  TrendingUp,
  RectangleHorizontal,
  RotateCcw,
  Ruler,
  ScanSearch,
  SlidersHorizontal,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import CreatorAvatar from "../CreatorAvatar";
import type { YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import {
  formatChangePercent,
  formatPrice,
  formatVolume,
  getStockHistory,
  type AiTechnicalAnalysis,
  type PriceBar,
  type PriceHistoryParams,
} from "@/lib/stockApi";
import ChartDrawingLayer from "../ChartDrawingLayer";
import OscillatorPane, { oscillatorLabels, type Oscillator } from "./OscillatorPane";
import { drawingColors, newDrawingId, type Anchor, type Drawing, type DrawingTool, type SyncStatus } from "../chartDrawings";
import { toneText, type StrengthTone } from "../strength";
import AiPriceActionSignals from "./AiPriceActionSignals";
import AiDrawingSetup from "./AiDrawingSetup";
import AiAnalysisPanel from "./AiAnalysisPanel";
import AiAnalysisEmptyState from "./AiAnalysisEmptyState";
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
import PriceGraph, { defaultGraphView, graphGeometry, type GraphGeometry } from "./PriceGraph";
import { ExtremeTag } from "./ChartMarkers";
import {
  GRAPH_AXIS_WIDTH,
  GRAPH_MIN_BARS,
  GRAPH_TIME_AXIS,
  GRAPH_TOP_PAD,
  clampGraphView,
  zoomGraphView,
  type GraphView,
  type PriceRangeKey,
} from "@/lib/chart/graph";

type Translate = (key: string, params?: Record<string, string>) => string;
type Mode = "compact" | "advanced";
/** Visible window in bar indices — the same shape `lib/chart/graph.ts` and `PriceGraph` use. */
type View = GraphView;
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

const SNAP_PX = 12;
const MIN_BARS = GRAPH_MIN_BARS;
const HEIGHT_CLASS: Record<Mode, string> = {
  compact: "h-[260px] sm:h-[320px]",
  advanced: "min-h-0 flex-1",
};
const defaultIndicators: Record<Mode, IndicatorKey[]> = {
  compact: [],
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
  { value: "extended", icon: MoveHorizontal, label: "toolExtended" },
  { value: "vline", icon: MoveVertical, label: "toolVline" },
  { value: "fibext", icon: TrendingUp, label: "toolFibext" },
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

function readIndicators(mode: Mode): IndicatorKey[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(`kolvex:chart-indicators:${mode}`) || "null");
    if (Array.isArray(saved)) return saved.filter((key) => key in indicatorMeta);
  } catch {
    // Fall back to the defaults.
  }
  return defaultIndicators[mode];
}

export interface ChartViewProps {
  resultsContainer?: HTMLElement | null;
  mode: Mode;
  compactLayout?: "compact" | "workspace";
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
  /**
   * Compact-mode time range, owned by the host (`PriceChart`) so the loaded history matches
   * the window that is drawn. Advanced mode keeps its own `AdvancedRange` + interval state.
   * When `onRangeChange` is missing the chart falls back to its internal range state.
   */
  range?: PriceRangeKey;
  onRangeChange?: (range: PriceRangeKey) => void;
  rangeOpen?: boolean;
  onRangeOpenChange?: (open: boolean) => void;
  rangeOptions?: { value: PriceRangeKey; label: string }[];
  /** Text for the custom chip, e.g. "Sep 26 – Oct 30". */
  rangeLabel?: string;
  headerActions?: ReactNode;
  onAnalysisChange?: (result: AiTechnicalAnalysis | null) => void;
  onDrawingsChange?: (result: AiTechnicalAnalysis | null) => void;
  savedDrawings?: AiTechnicalAnalysis | null;
  drawingsHidden?: boolean;
  onDrawingVisibilityChange?: (hidden: boolean) => void;
  drawingRequest?: number;
  aiBusy?: boolean;
  aiJobs: ReturnType<typeof useChartAiJobs>;
  selectedModel: string;
  onModelChange: (model: string) => void;
  savedAnalysis?: AiTechnicalAnalysis | null;
  snapshotBars?: PriceBar[];
  generationRequest?: number;
  technicalFocus?: TechnicalFocus;
  drawingFocus?: TechnicalFocus;
  focusControls?: ReactNode;
  drawingVersionControls?: ReactNode;
  onAnalysisBusy?: (busy: boolean) => void;
  /** Advanced mode runs inside a dialog that owns Escape; this lets the chart consume it first. */
  escapeRef?: MutableRefObject<(() => boolean) | null>;
}

/**
 * Closing-price preview and advanced candlestick chart with price/time axes, indicators, creator calls,
 * drawing tools and AI-drawn levels. Compact mode sits in the page; advanced mode fills a dialog.
 */
export default function ChartView({
  resultsContainer,
  mode,
  compactLayout = "compact",
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
  range: rangeProp,
  onRangeChange: onRangeChangeProp,
  rangeOpen = false,
  onRangeOpenChange,
  rangeOptions,
  rangeLabel,
  headerActions,
  onAnalysisChange,
  onDrawingsChange,
  savedDrawings,
  drawingsHidden = false,
  onDrawingVisibilityChange,
  drawingRequest = 0,
  aiBusy = false,
  aiJobs,
  selectedModel,
  onModelChange,
  savedAnalysis,
  snapshotBars,
  generationRequest = 0,
  technicalFocus = DEFAULT_TECHNICAL_FOCUS,
  drawingFocus = DEFAULT_DRAWING_FOCUS,
  onAnalysisBusy,
  focusControls,
  drawingVersionControls,
  escapeRef,
}: ChartViewProps) {
  const advanced = mode === "advanced";
  const heightClass = !advanced && compactLayout === "workspace"
    ? "h-[320px] sm:h-[420px]"
    : HEIGHT_CLASS[mode];
  const drawingToolbarId = useId();
  const [oscillator, setOscillator] = useState<Oscillator | null>("kdj");
  /**
   * Compact: the host owns the range (it decides which history to load), so the local state is
   * only a fallback for standalone use — `rangeProp` wins whenever it is supplied.
   * Advanced: this component owns its `AdvancedRange` + interval.
   */
  const [rangeState, setRangeState] = useState<AdvancedRange>("3M");
  const [interval, setChartInterval] = useState<ChartInterval>(defaultInterval["3M"]);
  const compactRange: AdvancedRange = (rangeProp && advancedRanges.includes(rangeProp as AdvancedRange)
    ? rangeProp
    : rangeState) as AdvancedRange;
  const range: AdvancedRange = advanced ? rangeState : compactRange;
  /** Changing the compact range reloads history, so the interval must stay one the range supports. */
  const effectiveInterval: ChartInterval = advanced
    ? interval
    : rangeIntervals[range].includes(interval as ChartInterval)
      ? interval
      : defaultInterval[range];
  const params = advanced && !snapshotBars ? advancedHistoryParams(range, effectiveInterval) : compactParams;
  const paramsKey = JSON.stringify(params);
  const chartCacheKey = stockHistoryKey(symbol, params);
  const intraday = isIntraday(params.interval || "1d");

  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bars, setBars] = useState<PriceBar[] | null>(() => snapshotBars ?? peekClientCache<PriceBar[]>(chartCacheKey) ?? null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View | null>(null);
  const [autoScale, setAutoScale] = useState(true);
  const [active, setActive] = useState<number | null>(null);
  const [tool, setTool] = useState<DrawingTool>("cursor");
  const [color, setColor] = useState(drawingColors[0]);
  const [magnet, setMagnet] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showCalls, setShowCalls] = useState(true);
  const [indicators, setIndicators] = useState<IndicatorKey[]>(defaultIndicators[mode]);
  const [localAi, setAi] = useState<{
    status: "idle" | "loading" | "done" | "error";
    result?: AiTechnicalAnalysis;
    error?: string;
  }>({
    status: "idle",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hideDrawingsOpen, setHideDrawingsOpen] = useState(false);
  const hideDrawingTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelHideRef = useRef<HTMLButtonElement>(null);
  const drawingButtonRef = useRef<HTMLButtonElement>(null);
  const { availableProviders, loading: providersLoading, refresh: refreshProviders } = useAvailableProviders();
  const eligibleModels = MODEL_CONFIGS.filter((model) => availableProviders?.includes(PROVIDER_NAME_TO_ID[model.provider]));
  const modelReady = eligibleModels.some((model) => model.id === selectedModel);
  const [localDrawingAi, setDrawingAi] = useState<{ status: "idle" | "loading" | "done" | "error"; error?: string; result?: AiTechnicalAnalysis }>({ status: "idle" });
  const jobError = (code?: string, operation: "analysis" | "drawings" = "analysis") => {
    const keys: Record<string, string> = {
      Unauthorized: "signIn", ai_not_configured: "notConfigured",
      ai_analysis_timeout: "timeout", ai_job_expired: "jobExpired",
      ai_job_interrupted: "jobInterrupted", ai_insufficient_bars: "insufficientBars",
      ai_job_limit: "jobLimit", ai_jobs_unavailable: "jobsUnavailable",
      ai_submission_unknown: "submissionUnknown",
    };
    return t(`youtubeOpinions.ai.${keys[code || ""] || (operation === "analysis" ? "failed" : "drawingsFailed")}`);
  };
  const ai = aiJobs.analysis.status === "idle" ? localAi : { ...aiJobs.analysis, error: jobError(aiJobs.analysis.errorCode) };
  const drawingAi = aiJobs.drawings.status === "idle" ? localDrawingAi : { ...aiJobs.drawings, error: jobError(aiJobs.drawings.errorCode, "drawings") };
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => setIndicators(advanced ? readIndicators(mode) : []), [mode, advanced]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("kolvex:chart-oscillator");
      if (saved === "none") setOscillator(null);
      else if (saved === "kdj" || saved === "macd" || saved === "rsi") setOscillator(saved);
    } catch { /* Keep the session default when storage is unavailable. */ }
  }, []);
  function changeOscillator(next: Oscillator | null) {
    setOscillator(next);
    try { window.localStorage.setItem("kolvex:chart-oscillator", next ?? "none"); } catch { /* Session-only preference. */ }
  }

  const lastHistoryAttempt = useRef(attempt);
  useEffect(() => {
    const force = lastHistoryAttempt.current !== attempt;
    lastHistoryAttempt.current = attempt;
    const controller = new AbortController();
    setBars(snapshotBars ?? peekClientCache<PriceBar[]>(chartCacheKey) ?? null);
    setError(false);
    setActive(null);
    setView(null);
    if (snapshotBars) { setBars(snapshotBars); return () => controller.abort(); }
    getStockHistory(symbol, JSON.parse(paramsKey), controller.signal, force)
      .then(data => { if (!controller.signal.aborted) setBars(data); })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          console.error("Failed to load price history:", reason);
          setError(true);
        }
      });
    return () => controller.abort();
  }, [symbol, paramsKey, chartCacheKey, attempt, snapshotBars]);

  useEffect(() => {
    setSelectedId(null);
    setDraft(null);
    setAi({ status: "idle" });
    setDrawingAi({ status: "idle" });
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
    if (count < 3) return { start: 0, end: Math.max(count, 1) };
    // Shared default: the selected window with enough context to warm up the indicators.
    return defaultGraphView({ count, times, range, rangeStart: rangeStart(range, times[count - 1]) }) || { start: 0, end: count };
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

  /** `PriceGraph` wants per-bar counts; the advanced header still reads the opinion lists. */
  const callCounts = useMemo(() => {
    const counts = new Map<number, { bullish: number; bearish: number; other: number }>();
    for (const [index, entry] of calls) {
      counts.set(index, { bullish: entry.bullish.length, bearish: entry.bearish.length, other: entry.other.length });
    }
    return counts;
  }, [calls]);

  /** Selecting a compact range asks the host to load that window; standalone use keeps it local. */
  function selectRange(next: PriceRangeKey) {
    if (onRangeChangeProp) {
      onRangeChangeProp(next);
      return;
    }
    if (!advancedRanges.includes(next as AdvancedRange)) return;
    const nextRange = next as AdvancedRange;
    setRangeState(nextRange);
    if (!rangeIntervals[nextRange].includes(interval)) setChartInterval(defaultInterval[nextRange]);
    setView(null);
  }

  /** Option list for the graph's range bar; labels come from i18n unless the host supplies them. */
  const graphRangeOptions = useMemo<{ value: PriceRangeKey; label: string }[]>(
    () => rangeOptions ?? advancedRanges.map((item) => ({ value: item as PriceRangeKey, label: t(`youtubeOpinions.advancedRange.${item}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangeOptions, t],
  );

  function clampView(next: View): View {
    return clampGraphView(next, count, MIN_BARS);
  }

  const zoomRef = useRef<(factor: number, anchorRatio: number) => void>(() => {});
  const panRef = useRef<(bars: number) => void>(() => {});
  zoomRef.current = (factor, anchorRatio) => {
    setView(zoomGraphView(current, factor, anchorRatio, count, MIN_BARS));
  };
  panRef.current = (shift) => setView(clampView({ start: current.start + shift, end: current.end + shift }));

  useEffect(() => {
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      const rect = box.getBoundingClientRect();
      const plotWidth = Math.max(rect.width - GRAPH_AXIS_WIDTH, 1);
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

  const activeIndicators = new Set(advanced ? indicators : []);
  const showVolume = activeIndicators.has("volume");
  const plotW = Math.max(size.width - GRAPH_AXIS_WIDTH, 1);
  const plotH = Math.max(size.height - GRAPH_TIME_AXIS, 1);
  const volumeH = showVolume ? plotH * 0.18 : 0;
  /** Price scale rows: the candle body stops above the volume strip. */
  const priceTop = GRAPH_TOP_PAD;
  const priceBottom = Math.max(plotH - volumeH - 16, priceTop + 1);
  const span = current.end - current.start;
  const slot = plotW / Math.max(span, 1e-6);
  /** Shared geometry: candles, drawings and the oscillator all read positions from it. */
  const geometry = graphGeometry({
    bars,
    times,
    view: current,
    width: size.width,
    height: size.height,
    intraday,
    interval: params.interval || "1d",
  });
  const xOf = (index: number) => (index - current.start + 0.5) * slot;
  const firstVisible = Math.max(Math.floor(current.start), 0);
  const lastVisible = Math.min(Math.ceil(current.end), count) - 1;
  const vwapAnchor = intraday ? 0 : firstVisible;
  const vwapSeries = useMemo(() => vwap(bars || [], intraday, vwapAnchor), [bars, intraday, vwapAnchor]);
  const lines: Record<"vwap" | "ema5" | "ema20" | "ema50" | "ema200", Series> = { ...series, vwap: vwapSeries };

  useEffect(() => {
    setAi(savedAnalysis ? { status: "done", result: savedAnalysis } : { status: "idle" });
  }, [savedAnalysis]);
  useEffect(() => { setDrawingAi(savedDrawings ? { status: "done", result: savedDrawings } : { status: "idle" }); }, [savedDrawings]);
  useEffect(() => { onAnalysisBusy?.(ai.status === "loading" || drawingAi.status === "loading"); }, [ai.status, drawingAi.status, onAnalysisBusy]);
  const handledGeneration = useRef(0);
  useEffect(() => {
    if (generationRequest <= handledGeneration.current || !count || aiBusy) return;
    handledGeneration.current = generationRequest;
    void runAi("analysis");
    // The request uses the current visible chart window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationRequest, count, aiBusy]);


  const handledDrawing = useRef(0);
  useEffect(() => {
    if (drawingRequest <= handledDrawing.current || !count || aiBusy) return;
    handledDrawing.current = drawingRequest;
    void runAi("drawings");
    // Uses the same visible window, independently of text analysis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingRequest, count, aiBusy]);

  const yRange = useMemo(() => {
    if (!bars?.length) return { lo: 0, hi: 1, maxVolume: 1 };
    const from = autoScale ? firstVisible : 0;
    const to = autoScale ? lastVisible : bars.length - 1;
    let lo = Infinity;
    let hi = -Infinity;
    let maxVolume = 1;
    for (let index = Math.max(from, 0); index <= Math.min(to, bars.length - 1); index++) {
      lo = Math.min(lo, advanced ? bars[index].low : bars[index].close);
      hi = Math.max(hi, advanced ? bars[index].high : bars[index].close);
      maxVolume = Math.max(maxVolume, bars[index].volume || 0);
    }
    if (!Number.isFinite(lo)) return { lo: 0, hi: 1, maxVolume };
    const pad = (hi - lo || hi * 0.01 || 1) * 0.06;
    return { lo: lo - pad, hi: hi + pad, maxVolume };
  }, [bars, autoScale, firstVisible, lastVisible, advanced]);

  if (error) {
    return (
      <div
        className={cn("flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground", heightClass)}
        role="alert"
      >
        <span>{t("youtubeOpinions.priceUnavailable")}</span>
        <Button size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  /**
   * The price scale comes from the shared geometry (optionally auto-scaled to the visible
   * highs/lows), so drawings, call markers and the axis all agree on one mapping.
   */
  const yOf = (price: number) =>
    autoScale
      ? geometry.yOf(price)
      : priceTop + ((yRange.hi - price) / (yRange.hi - yRange.lo)) * (priceBottom - priceTop);
  const priceAt = (py: number) =>
    autoScale
      ? geometry.priceAt(py)
      : yRange.hi - ((py - priceTop) / (priceBottom - priceTop)) * (yRange.hi - yRange.lo);
  const indexAt = (time: number) => geometry.indexAt(time);
  const timeAt = (index: number) => geometry.timeAt(index);
  const toPx = (anchor: Anchor) => ({ x: xOf(indexAt(anchor.time)), y: yOf(anchor.price) });
  const barsBetween = (a: Anchor, b: Anchor) => geometry.barsBetween(a, b);
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
      if (type === "hline" || type === "vline") commit({ id: newDrawingId(), type, points: [anchor], color });
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
    if (!modelReady) {
      const error = t(eligibleModels.length ? "youtubeOpinions.ai.selectModel" : "youtubeOpinions.ai.notConfigured");
      if (operation === "analysis") setAi({ status: "error", error });
      else setDrawingAi({ status: "error", error });
      return;
    }
    const from = bars[Math.max(firstVisible, 0)];
    const to = bars[Math.max(Math.min(lastVisible, count - 1), 0)];
    if (operation === "analysis") setAi({ status: "idle" });
    else setDrawingAi({ status: "idle" });
    await aiJobs.submit(
        {
          ...params,
          ...(operation === "analysis" ? technicalFocus : drawingFocus),
          operation,
          model: selectedModel,
          view_start: from.date,
          view_end: to.date,
          locale: t("common.intlLocale") === "zh-CN" ? "zh" : "en",
        },
      );
  }


  const iconButton = (isActive: boolean) =>
    cn(
      "inline-flex h-11 w-11 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
      isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]",
    );
  const stat = (label: string, value: string, tone?: string) => (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className={cn("font-medium", tone || "text-foreground")}>{value}</span>
    </span>
  );
  const pill = (isActive: boolean) =>
    cn(
      "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none ",
      isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]",
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

  const hideDrawingsControl = (
            <Dialog open={hideDrawingsOpen} onOpenChange={setHideDrawingsOpen}>
              {drawingAi.status === "done" && (drawingsHidden ? <Button ref={hideDrawingTriggerRef} type="button" size="sm" variant="outline" aria-label={t("youtubeOpinions.ai.showDrawings")} title={t("youtubeOpinions.ai.showDrawings")} aria-pressed={false} className="min-h-11 w-full min-w-0 gap-2 px-2 sm:min-h-9 sm:w-auto sm:px-3" disabled={aiBusy} onClick={() => onDrawingVisibilityChange?.(false)}>
                <Eye className="h-4 w-4" aria-hidden="true" /><span className="sm:hidden">{t("youtubeOpinions.ai.showDrawingsShort")}</span><span className="hidden sm:inline">{t("youtubeOpinions.ai.showDrawings")}</span>
              </Button> : <DialogTrigger asChild>
                <Button ref={hideDrawingTriggerRef} type="button" size="sm" variant="outline" aria-label={t("youtubeOpinions.ai.clear")} title={t("youtubeOpinions.ai.clear")} aria-pressed={true} className="min-h-11 w-full min-w-0 gap-2 px-2 sm:min-h-9 sm:w-auto sm:px-3" disabled={aiBusy}>
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                  <span className="sm:hidden">{t("youtubeOpinions.ai.hideDrawingsShort")}</span><span className="hidden sm:inline">{t("youtubeOpinions.ai.clear")}</span>
                </Button>
              </DialogTrigger>)}
              <DialogContent showCloseButton={false}
                onEscapeKeyDown={(event) => event.stopPropagation()}
                onOpenAutoFocus={(event) => { event.preventDefault(); cancelHideRef.current?.focus(); }}
                onCloseAutoFocus={(event) => { event.preventDefault(); (hideDrawingTriggerRef.current || drawingButtonRef.current)?.focus({ preventScroll: true }); }}>
                <DialogHeader>
                  <DialogTitle>{t("youtubeOpinions.ai.hideDrawingsTitle")}</DialogTitle>
                  <DialogDescription>{t("youtubeOpinions.ai.hideDrawingsDescription")}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:space-x-0">
                  <DialogClose asChild><Button ref={cancelHideRef} type="button" variant="outline">{t("common.cancel")}</Button></DialogClose>
                  <Button type="button" variant="outline" disabled={aiBusy || drawingAi.status !== "done"} onClick={() => {
                    onDrawingVisibilityChange?.(true);
                    setHideDrawingsOpen(false);
                  }}>{t("youtubeOpinions.ai.confirmHideDrawings")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
  );
  const aiControls = (
    <div className={advanced ? "min-w-0" : "mt-3 border-t border-border pt-3"} role="group" aria-label={t("youtubeOpinions.ai.actions")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button size="sm" variant="outline" className="min-h-11 min-w-0 gap-1.5 px-2 sm:min-h-9 sm:min-w-[112px] sm:gap-2 sm:px-3" onClick={() => modelReady ? void runAi("analysis") : setSettingsOpen(true)} aria-busy={ai.status === "loading"}
              disabled={!loaded || providersLoading || aiBusy || ai.status === "loading" || drawingAi.status === "loading"}
              title={t("youtubeOpinions.ai.runAnalysis")}>
              {ai.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ScanSearch className="h-4 w-4" aria-hidden="true" />}
              {t("youtubeOpinions.ai.analysisButton")}
            </Button>
            <Button ref={drawingButtonRef} size="sm" variant="outline" className="min-h-11 min-w-0 gap-1.5 px-2 sm:min-h-9 sm:min-w-[112px] sm:gap-2 sm:px-3" onClick={() => modelReady ? void runAi("drawings") : setSettingsOpen(true)} aria-busy={drawingAi.status === "loading"}
              disabled={!loaded || providersLoading || aiBusy || ai.status === "loading" || drawingAi.status === "loading"}
              title={t("youtubeOpinions.ai.runDrawings")}>
              {drawingAi.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GanttChart className="h-4 w-4" aria-hidden="true" />}
              {t("youtubeOpinions.ai.button")}
            </Button>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:ml-auto sm:flex sm:flex-wrap sm:items-center">
          <Dialog open={settingsOpen} onOpenChange={(open) => { setSettingsOpen(open); if (open) void refreshProviders(); }}>
            <DialogTrigger asChild>
              <Button type="button" size="sm" variant="outline" aria-label={t("youtubeOpinions.ai.chartSettings")} title={t("youtubeOpinions.ai.chartSettings")} className="min-h-11 w-full min-w-0 gap-2 px-2 sm:min-h-9 sm:w-auto sm:px-3">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span>{t("youtubeOpinions.ai.chartSettings")}</span>
              </Button>
            </DialogTrigger>
            <DialogContent layout="sheet" showCloseButton={false} className="flex flex-col" onEscapeKeyDown={(event) => event.stopPropagation()}>
              <DialogHeader>
                <DialogTitle>{t("youtubeOpinions.ai.chartSettings")}</DialogTitle>
                <DialogDescription>{t("youtubeOpinions.ai.chartSettingsHint")}</DialogDescription>
              </DialogHeader>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 min-h-11 min-w-11" aria-label={t("common.close")}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DialogClose>
              <div className="mt-2 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pb-2">
                <label className="flex min-w-0 w-full flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{t("youtubeOpinions.ai.modelLabel")}</span>
                  <Select value={modelReady ? selectedModel : ""} onValueChange={onModelChange}
                    onOpenChange={(open) => { if (open) void refreshProviders(); }}
                    disabled={providersLoading || aiBusy || ai.status === "loading" || drawingAi.status === "loading"}>
                    <SelectTrigger aria-label={t("youtubeOpinions.ai.selectModel")}>
                      <SelectValue placeholder={t("youtubeOpinions.ai.selectModel")} />
                    </SelectTrigger>
                    <SelectContent style={{ width: "var(--radix-select-trigger-width)", maxHeight: "min(20rem, var(--radix-select-content-available-height))" }}>
                      {MODEL_CONFIGS.map((model) => (
                        <SelectItem key={model.id} value={model.id} disabled={!availableProviders?.includes(PROVIDER_NAME_TO_ID[model.provider])}>
                          <span className="block break-words">{model.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {!providersLoading && !modelReady && !eligibleModels.length && <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {t("youtubeOpinions.ai.notConfigured")}{" "}
                  <Link href="/dashboard/settings?tab=api-keys" className="underline underline-offset-2 focus-visible:outline-none ">{t("youtubeOpinions.ai.openSettings")}</Link>
                </p>}
                {focusControls}
                {drawingVersionControls}
              </div>
              <DialogFooter className="shrink-0 border-t border-border">
                <DialogClose asChild><Button type="button">{t("common.close")}</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            {advanced && drawingAi.status === "done" && <div className="min-w-0 sm:w-auto">{hideDrawingsControl}</div>}

          </div>
        </div>

      </div>
  );
  const activeJob = aiJobs.analysis.status === "loading" ? aiJobs.analysis : aiJobs.drawings.status === "loading" ? aiJobs.drawings : null;
  const failedOperation = ai.status === "error" ? "analysis" : drawingAi.status === "error" ? "drawings" : null;
  const aiStatus = aiJobs.monitorError ? (
    <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm leading-6 text-warning">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{t("youtubeOpinions.ai.statusUnavailable")}</span>
      <Button size="sm" variant="ghost" onClick={aiJobs.refresh}>{t("youtubeOpinions.ai.checkStatus")}</Button>
    </div>
  ) : activeJob ? (
    <div role="status" className="mt-3 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
      <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      <p>{t(`youtubeOpinions.ai.${activeJob.phase === "submitting" ? "submitting" : activeJob.phase === "queued" ? "queued" : "backgroundRunning"}`)}</p>
    </div>
  ) : failedOperation ? (
    <div role="alert" className="mt-3 flex flex-wrap items-start gap-2 text-sm leading-6 text-negative">
      <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{failedOperation === "analysis" ? ai.error : drawingAi.error}</p>
      <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => modelReady ? void runAi(failedOperation) : setSettingsOpen(true)}>
        {t(modelReady ? "common.retry" : "youtubeOpinions.ai.chartSettings")}
      </Button>
    </div>
  ) : null;
  const stackedResults = !advanced && (compactLayout === "workspace" || Boolean(resultsContainer));
  const aiResults = (<>
    {ai.status === "idle" && drawingAi.status === "idle" && !aiBusy && !aiJobs.monitorError && <AiAnalysisEmptyState
      symbol={symbol}
      interval={params.interval || "1d"}
      disabled={!loaded || providersLoading || aiJobs.checking}
      modelReady={modelReady}
      onAnalyze={() => modelReady ? void runAi("analysis") : setSettingsOpen(true)}
      t={t}
    />}
    {drawingAi.status === "done" && drawingAi.result && (drawingAi.result.model || drawingAi.result.setup || drawingAi.result.findings?.some(item => item.status === "unavailable") || drawingAi.result.overlays?.some(item => ["breakouts", "retests", "false_breakouts"].includes(item.category) && item.detected_at && typeof item.level === "number")) && <details className={cn("group/drawings min-w-0 border-t border-border pt-3", stackedResults ? "order-2 mt-6" : "mt-5")}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded text-sm font-medium hover:text-muted-foreground focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            {t("youtubeOpinions.ai.button")}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground group-open/drawings:rotate-180" aria-hidden="true" />
          </summary>
          {drawingAi.result?.model && <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{t("youtubeOpinions.ai.generatedBy", { model: `${drawingAi.result.provider || ""} / ${drawingAi.result.model}` })}</p>}
          {drawingAi.status === "done" && drawingAi.result?.setup && <AiDrawingSetup setup={drawingAi.result.setup} t={t} />}
          {drawingAi.status === "done" && drawingAi.result && <AiPriceActionSignals result={drawingAi.result} formatDate={formatDate} t={t} />}
          {drawingAi.status === "done" && drawingAi.result?.findings?.some(item => item.status === "unavailable") && <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {t("youtubeOpinions.ai.focus.unavailable")}：{drawingAi.result.findings.filter(item => item.status === "unavailable").map(item => t(`youtubeOpinions.ai.focus.categories.${item.id}`)).join(" / ")}
          </p>}
        </details>}
    {ai.status === "done" && (
          <AiAnalysisPanel
            state={ai}
            busy={aiBusy}
            interval={params.interval || "1d"}
            onRetry={() => void runAi("analysis")}
            formatDate={formatDate}
            t={t}
            className={stackedResults ? "order-first mt-6" : "mt-6 border-t border-border pt-4"}
          />
        )}
  </>);

  /**
   * Advanced mode's candles / indicators painted on the shared `PriceGraph` geometry. The graph
   * owns the SVG, the axes and every pointer/keyboard gesture; this callback only draws the
   * marks, so both modes keep one price scale and one interaction model.
   */
  function renderAdvancedPlot(current: GraphGeometry): ReactNode {
    if (!bars || !count) return null;
    const firstVisible = current.firstIndex;
    const lastVisible = current.lastIndex;
    const plotW = current.plotWidth;
    const plotH = current.plotHeight;
    const slot = plotW / Math.max(current.view.end - current.view.start, 1e-6);
    const priceBottom = current.priceBottom;
    const volumeH = showVolume ? Math.max(priceBottom - current.priceTop, 1) * 0.18 : 0;
    /** Candle bodies, indicator paths and volume all key off the graph's own scale. */
    const y = (price: number) => current.yOf(price);
    const x = (index: number) => current.xOf(index);
    const path = (values: Series) => {
      let d = "";
      let pen = false;
      for (let index = Math.max(firstVisible - 1, 0); index <= Math.min(lastVisible + 1, count - 1); index++) {
        const value = values[index];
        if (value === null || value === undefined) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`;
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
        upper.push(`${x(index).toFixed(1)},${y(top).toFixed(1)}`);
        lower.unshift(`${x(index).toFixed(1)},${y(bottom).toFixed(1)}`);
      }
      return upper.length ? `M${upper.join("L")}L${lower.join("L")}Z` : "";
    };
    const visibleExtremes = (() => {
      if (lastVisible < firstVisible) return null;
      let high = firstVisible;
      let low = firstVisible;
      for (let index = firstVisible; index <= lastVisible; index++) {
        if (bars[index].high > bars[high].high) high = index;
        if (bars[index].low < bars[low].low) low = index;
      }
      return { high, low };
    })();
    const lastTone = last && last.close >= (bars[count - 2]?.close ?? last.open) ? "positive" : "negative";
    const maxVolume = yRange.maxVolume || 1;
    return (
      <>
        {activeIndicators.has("bb") && (
          <>
            <path d={band()} fill={indicatorMeta.bb.color} fillOpacity={0.07} />
            <path d={path(series.bb.upper)} fill="none" stroke={indicatorMeta.bb.color} strokeWidth={1} />
            <path d={path(series.bb.lower)} fill="none" stroke={indicatorMeta.bb.color} strokeWidth={1} />
            <path d={path(series.bb.middle)} fill="none" stroke={indicatorMeta.bb.color} strokeWidth={1} strokeDasharray="3 3" />
          </>
        )}
        {bars.slice(firstVisible, lastVisible + 1).map((bar, offset) => {
          const index = firstVisible + offset;
          const fill = bar.close >= bar.open ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))";
          const top = y(Math.max(bar.open, bar.close));
          const bottom = y(Math.min(bar.open, bar.close));
          const cx = x(index);
          const width = Math.max(slot * 0.62, 1);
          const volume = showVolume ? ((bar.volume || 0) / maxVolume) * volumeH : 0;
          return (
            <g key={bar.date}>
              {showVolume && (
                <rect x={cx - width / 2} y={plotH - volume} width={width} height={volume} fill={fill} opacity={0.28} />
              )}
              <line x1={cx} x2={cx} y1={y(bar.high)} y2={y(bar.low)} stroke={fill} strokeWidth={1} />
              <rect x={cx - width / 2} y={top} width={width} height={Math.max(bottom - top, 1)} fill={fill} />
            </g>
          );
        })}
        {(["vwap", "ema5", "ema20", "ema50", "ema200"] as const).map((key) =>
          activeIndicators.has(key) ? (
            <path key={key} d={path(lines[key])} fill="none" stroke={indicatorMeta[key].color} strokeWidth={1.5} strokeLinejoin="round" />
          ) : null,
        )}
        {last && (
          <line
            x1={0}
            x2={plotW}
            y1={y(last.close)}
            y2={y(last.close)}
            stroke={lastTone === "positive" ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))"}
            strokeOpacity={0.45}
          />
        )}
        {/* the window's high / low as quiet floating numerals, as in the reference */}
        {visibleExtremes && (
          <>
            <ExtremeTag side="high" value={bars[visibleExtremes.high].high} x={x(visibleExtremes.high)} y={Math.max(y(bars[visibleExtremes.high].high) - 6, 1)} clamp={plotW} />
            <ExtremeTag side="low" value={bars[visibleExtremes.low].low} x={x(visibleExtremes.low)} y={Math.min(y(bars[visibleExtremes.low].low) + 6, plotH - 16)} clamp={plotW} />
          </>
        )}
      </>
    );
  }

  /** Indicator swatches for the toolbar state and the values printed over the plot. */
  const legend = indicatorOrder.filter((key) => key !== "volume" && activeIndicators.has(key));
  const legendValue = (key: IndicatorKey) => {
    const value = key === "bb" ? series.bb.middle[shownIndex] : lines[key as keyof typeof lines][shownIndex];
    return value === null || value === undefined ? "—" : value.toFixed(2);
  };

  /** Backgrounded nodes over the advanced plot: indicator values and the creator-call popover. */
  const advancedOverlay = (
    <>
      {legend.length > 0 && (
        <div
          className="pointer-events-none absolute left-2 top-1 flex flex-wrap gap-x-3 gap-y-0.5 rounded-md bg-background/70 px-1.5 py-0.5 text-[11px] tabular-nums backdrop-blur-sm"
          style={{ maxWidth: Math.max(size.width - GRAPH_AXIS_WIDTH - 16, 120) }}
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
      {activeEvents.length > 0 && !drawing && !gesture.current && active !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-6 z-10 w-64 max-w-[calc(100%-1rem)] rounded-3xl border border-border bg-background/95 p-2.5 text-xs shadow-lg backdrop-blur"
          style={
            xOf(active) > plotW / 2
              ? { right: Math.max(size.width - xOf(active) + 12, 0) }
              : { left: Math.min(xOf(active) + 12, Math.max(plotW - 256, 0)) }
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
  );

  /**
   * The drawing overlay, clipped to the plot box by `PriceGraph`. It is mounted for BOTH modes so
   * a saved/AI drawing is visible in the preview too, but only advanced mode makes it editable.
   */
  const drawingLayerNode = loaded ? (
    <ChartDrawingLayer
      width={plotW}
      height={Math.max(priceBottom, 1)}
      drawings={drawings}
      draft={draft?.drawing ?? null}
      selectedId={advanced ? selectedId : null}
      interactive={advanced && !drawing}
      toPx={toPx}
      barsBetween={barsBetween}
      t={t}
    />
  ) : null;

  /** Oscillator strip under the time axis, sharing the graph's visible window. */
  const oscillatorPane = advanced && loaded && oscillator && bars ? (
    <OscillatorPane
      bars={bars}
      kind={oscillator}
      onChange={changeOscillator}
      width={size.width}
      axisWidth={GRAPH_AXIS_WIDTH}
      start={current.start}
      end={current.end}
      active={active}
      onActive={setActive}
      t={t}
    />
  ) : null;

  /** Advanced-only toggles that sit in the graph's control row after the range bar. */
  const intervalControl = (
    <Select
      disabled={Boolean(snapshotBars)}
      value={snapshotBars ? compactParams.interval : interval}
      onValueChange={(value) => setChartInterval(value as ChartInterval)}
    >
      <SelectTrigger className="h-11 w-[92px] rounded-full text-[13px] sm:h-8" aria-label={t("youtubeOpinions.interval")}>
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
  );
  const autoScaleControl = (
    <button
      type="button"
      aria-pressed={autoScale}
      onClick={() => setAutoScale((value) => !value)}
      className={cn(pill(autoScale), "gap-1.5")}
    >
      {autoScale ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />}
      {t("youtubeOpinions.autoScale")}
    </button>
  );
  const hideDrawingsSlot = drawingAi.status === "done" ? hideDrawingsControl : null;

  /** Compact draw hint / legend lives under the graph, where the reference keeps its notes. */
  const compactFooter = drawing ? (
    <span className="text-xs text-muted-foreground">
      {t((tool === "hline" || tool === "vline") ? "youtubeOpinions.drawHintSingle" : "youtubeOpinions.drawHint")}
    </span>
  ) : showCalls && calls.size > 0 ? (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="text-positive" aria-hidden="true">
          ▲
        </span>
        {t("youtubeOpinions.bullish")}
        <span className="text-negative" aria-hidden="true">
          ▼
        </span>
        {t("youtubeOpinions.bearish")}
      </span>
      <span>{t("youtubeOpinions.opinionMarkers")}</span>
    </span>
  ) : null;

  const graph = (
    <PriceGraph
      mode={mode}
      heightClass={heightClass}
      bars={bars}
      loading={!bars && !error}
      error={error}
      onRetry={() => setAttempt((value) => value + 1)}
      view={view}
      onViewChange={setView}
      range={(advanced ? range : (rangeProp ?? rangeState)) as PriceRangeKey}
      onRangeChange={(next) => {
        if (advanced) {
          if (!advancedRanges.includes(next as AdvancedRange) || snapshotBars) return;
          const nextRange = next as AdvancedRange;
          setRangeState(nextRange);
          if (!rangeIntervals[nextRange].includes(interval)) setChartInterval(defaultInterval[nextRange]);
          setView(null);
          return;
        }
        selectRange(next);
      }}
      rangeOpen={rangeOpen}
      onRangeOpenChange={onRangeOpenChange}
      rangeOptions={graphRangeOptions}
      rangeLabel={advanced && snapshotBars ? undefined : rangeLabel}
      rangeStart={advanced ? rangeStart(range, times[count - 1] ?? Date.now()) : undefined}
      calls={callCounts}
      showCalls={showCalls}
      activeIndex={active}
      onActiveChange={setActive}
      onOpenAdvanced={advanced ? undefined : onOpenAdvanced}
      renderPlot={advanced ? renderAdvancedPlot : undefined}
      drawingLayer={drawingLayerNode}
      overlay={advanced ? advancedOverlay : null}
      subPane={oscillatorPane}
      trailingControls={advanced ? (
        <>
          {intervalControl}
          {autoScaleControl}
          {hideDrawingsSlot}
        </>
      ) : null}
      formatDate={formatDate}
      t={t}
      symbol={symbol}
      interval={params.interval || "1d"}
      intraday={intraday}
      rangeChangeLabel={t("youtubeOpinions.priceRangeChange")}
      plotAriaLabel={advanced ? t("youtubeOpinions.priceChartLabel") : t("youtubeOpinions.advancedChartTitle", { symbol })}
    />
  );

  return (
    <div className={cn("min-w-0", advanced && "flex h-full min-h-0 gap-4")}>
      <div className={cn("min-w-0", advanced && "flex min-h-0 flex-1 flex-col")}>
        {advanced && (
          <div className="flex shrink-0 items-center gap-3">
            <h2 className="text-lg font-semibold">{symbol}</h2>
            {last && (
              <span className="flex items-baseline gap-2 text-sm tabular-nums">
                <span className="font-semibold">{formatPrice(last.close)}</span>
                <span className={rangeChange >= 0 ? "text-positive" : "text-negative"}>{formatChangePercent(rangeChange)}</span>
              </span>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className="lg:hidden">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline">
                      {t("youtubeOpinions.ai.actions")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="max-h-[70dvh] w-80 max-w-[calc(100vw-32px)] overflow-y-auto overscroll-contain p-4">
                    {aiControls}
                    {aiResults}
                  </PopoverContent>
                </Popover>
              </div>
              {headerActions}
            </div>
          </div>
        )}

        {advanced && <div className="lg:hidden">{aiStatus}</div>}

        {/* active-bar numbers: the graph prints the header line, advanced mode adds OHLC + calls */}
        {advanced && (
          <div
            className="mt-1 flex min-h-8 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] tabular-nums"
            aria-live="polite"
          >
            {shownBar ? (
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
              <Skeleton className="h-4 w-48" />
            )}
          </div>
        )}

        {!advanced && aiStatus}

        <div
          id={drawingToolbarId}
          role="toolbar"
          aria-label={t("youtubeOpinions.drawTools")}
          className={cn("shrink-0 flex-wrap items-center gap-1 border-b border-border sm:flex-nowrap sm:overflow-x-auto", advanced ? "flex mt-1 pb-1" : "hidden")}
        >
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label={t("youtubeOpinions.drawTools")} title={t("youtubeOpinions.drawTools")} className={cn(iconButton(drawing), "sm:hidden")}>
                {(() => { const Icon = tools.find(item => item.value === tool)?.icon || MousePointer2; return <Icon className="h-4 w-4" />; })()}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="grid w-64 max-w-[calc(100vw-32px)] grid-cols-2 gap-1 p-2">
              {tools.map(item => {
                const Icon = item.icon;
                return <button key={item.value} type="button" aria-pressed={tool === item.value}
                  className={cn("flex min-h-11 items-center gap-2 rounded-full px-2 text-left text-sm focus-visible:outline-none ", tool === item.value ? "bg-secondary font-semibold text-foreground" : "hover:bg-foreground/[0.06] hover:text-foreground")}
                  onClick={() => { setTool(item.value); setDraft(null); if (item.value !== "cursor") setSelectedId(null); }}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{t(`youtubeOpinions.${item.label}`)}
                </button>;
              })}
            </PopoverContent>
          </Popover>
          <div className="hidden items-center gap-1 sm:flex">{tools.map((item) => {
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
          })}</div>
          <span className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden="true" />
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label={t("youtubeOpinions.drawColor")} title={t("youtubeOpinions.drawColor")} className={iconButton(false)}>
                <span className="h-4 w-4 rounded-full " style={{ backgroundColor: selected?.color ?? color }} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <div role="radiogroup" aria-label={t("youtubeOpinions.drawColor")} className="flex shrink-0 items-center gap-1">
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
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none "
                    >
                      <span className={cn("h-3.5 w-3.5 rounded-full ")} style={{ backgroundColor: value }} />
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <span className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden="true" />
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
                  aria-pressed={activeIndicators.has(key)}
                  onClick={() => toggleIndicator(key)}
                  className="flex w-full items-center gap-2.5 rounded-full px-2 py-1.5 text-sm transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border border-border text-[10px]",
                      activeIndicators.has(key) && "border-primary bg-primary text-primary-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {activeIndicators.has(key) ? "✓" : ""}
                  </span>
                  <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: indicatorMeta[key].color }} aria-hidden="true" />
                  {key === "volume" ? t("youtubeOpinions.priceVolumeFull") : indicatorMeta[key].label}
                </button>
              ))}
              <div className="mt-1 border-t border-border pt-1" role="group" aria-label={t("youtubeOpinions.oscillators")}>
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{t("youtubeOpinions.oscillators")}</p>
                {(["kdj", "macd", "rsi"] as const).map(value => <button key={value} type="button" aria-pressed={oscillator === value} onClick={() => changeOscillator(oscillator === value ? null : value)} className={cn("flex min-h-11 w-full items-center rounded-full px-2 text-left text-sm transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none", oscillator === value && "bg-secondary font-semibold text-foreground")}>
                  {oscillatorLabels[value]}
                </button>)}
              </div>
            </PopoverContent>
          </Popover>
          <div className="ml-auto flex w-full shrink-0 flex-wrap items-center justify-end gap-1 sm:w-auto sm:flex-nowrap">
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

        {graph}

        {!advanced && compactFooter && <div className="mt-1.5 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">{compactFooter}</div>}

        {!advanced && <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 border-t border-border pt-2">
          <details className="group/tools min-w-0 flex-1">
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-full px-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {t("youtubeOpinions.ai.actions")}
              <ChevronDown className="h-4 w-4 group-open/tools:rotate-180" aria-hidden="true" />
            </summary>
            {aiControls}
          </details>
        </div>}

        {!advanced &&
          compactLayout !== "workspace" &&
          (resultsContainer ? createPortal(aiResults, resultsContainer) : aiResults)}
        {!advanced && compactLayout === "workspace" && resultsContainer && createPortal(aiResults, resultsContainer)}
      </div>
      {advanced && <aside aria-label={t("youtubeOpinions.ai.actions")} className="hidden min-h-0 w-72 shrink-0 overflow-y-auto overscroll-contain border-l border-border pl-4 lg:block">
        {aiControls}{aiStatus}{aiResults}
      </aside>}
    </div>
  );
}
