"use client";
import { peekClientCache } from "@/lib/clientCache";
import { stockHistoryKey } from "@/lib/stockApi";
import { useStockQuote } from "@/hooks/useStockData";
import { useCachedResource } from "@/hooks/useCachedResource";
import { forecastExtent, getKlineForecast, klineForecastKey, type KlineForecast } from "@/lib/klineForecast";

import Link from "next/link";
import { createPortal } from "react-dom";
import { MODEL_CONFIGS, PROVIDER_NAME_TO_ID } from "@/lib/aiModels";
import { useAvailableProviders } from "@/hooks/useAvailableProviders";
import type { useChartAiJobs } from "@/hooks/useChartAiJobs";
import type { AnalysisVersion } from "@/lib/stockAnalysisHistory";
import { DEFAULT_TECHNICAL_FOCUS, DEFAULT_DRAWING_FOCUS, type TechnicalFocus } from "@/lib/technicalFocus";

import {
  useCallback,
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
  ChevronLeft,
  CloudOff,
  Eye,
  EyeOff,
  Layers,
  GanttChart,
  Loader2,
  Lock,
  LockOpen,
  Magnet,
  Minus,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
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
  Sparkles,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/info-tip";
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
import ChartSection from "./ChartSection";
import OscillatorPane, { oscillatorLabels, type Oscillator } from "./OscillatorPane";
import { drawingColors, drawingGroups, newDrawingId, type Anchor, type Drawing, type DrawingGroup, type DrawingTool, type SyncStatus } from "../chartDrawings";
import { toneText, type StrengthTone } from "../strength";
import AiAnalysisPanel from "./AiAnalysisPanel";
import AiJobProgress, { AiJobStatusChip } from "./AiJobProgress";
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
import PriceGraph, { defaultGraphView, type GraphGeometry } from "./PriceGraph";
import { ExtremeTag } from "./ChartMarkers";
import {
  GRAPH_AXIS_WIDTH,
  GRAPH_MIN_BARS,
  clampGraphView,
  priceDomain,
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
type DrawingEdit = {
  id: string;
  handle: number | "body";
  origin: Anchor;
  before: Drawing[];
  moved: boolean;
};
type Calls = {
  bullish: YouTubeOpinion[];
  bearish: YouTubeOpinion[];
  other: YouTubeOpinion[];
};

const SNAP_PX = 12;
const MIN_BARS = GRAPH_MIN_BARS;
/** Indicators named on the collapsed phone legend line before "+N". */
const LEGEND_PREVIEW = 2;

const HEIGHT_CLASS: Record<Mode, string> = {
  compact: "h-[18rem] sm:h-[20rem]",
  // Phones scroll the dialog: the plot keeps a floor but also takes any spare height, so collapsing
  // the oscillator never leaves a gap above the controls.
  advanced: "min-h-[clamp(16rem,50svh,28rem)] flex-1 shrink-0 sm:min-h-0 sm:shrink",
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
  showAi?: boolean;
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
  savedAnalysisVersion?: AnalysisVersion<AiTechnicalAnalysis> | null;
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
  showAi = true,
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
  savedAnalysisVersion,
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
    ? "h-[20rem] sm:h-[26.25rem]"
    : HEIGHT_CLASS[mode];
  const drawingToolbarId = useId();
  const aiPanelId = useId();
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
  const quoteResource = useStockQuote(symbol, 15_000, !snapshotBars);
  const intraday = isIntraday(params.interval || "1d");

  const [size, setSize] = useState({ width: 0, height: 0 });
  const receiveGraphGeometry = useCallback((next: GraphGeometry) => {
    setSize(previous => previous.width === next.width && previous.height === next.height
      ? previous : { width: next.width, height: next.height });
  }, []);
  const [bars, setBars] = useState<PriceBar[] | null>(() => snapshotBars ?? peekClientCache<PriceBar[]>(chartCacheKey) ?? null);
  const [error, setError] = useState(false);
  const [historyStale, setHistoryStale] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View | null>(null);
  const [priceDomainOverride, setPriceDomainOverride] = useState<ReturnType<typeof priceDomain> | null>(null);
  const autoScale = priceDomainOverride === null;
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
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  /** Phones put the settings one step inside the AI sheet; the sheet never stacks a second one. */
  const [aiSheetView, setAiSheetView] = useState<"actions" | "settings">("actions");
  const aiSheetStep = aiSheetView === "settings";
  /** A run the reader asked for before choosing a model; the settings sheet offers to start it. */
  const [pendingRun, setPendingRun] = useState<"analysis" | "drawings" | null>(null);
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
  /** Experimental Kronos forecast band past the last bar (advanced daily/weekly charts only). */
  const [showForecast, setShowForecast] = useState(false);
  const forecastInterval = params.interval || "1d";
  // A saved analysis keeps the forecast it was written with, so the band matches its text and needs no new inference.
  const analysisResult = ai.status === "done" ? ai.result : savedAnalysis;
  const analysisForecast = analysisResult?.forecast?.interval === forecastInterval ? analysisResult.forecast : null;
  const forecastable = advanced && (forecastInterval === "1d" || forecastInterval === "1wk") && (!snapshotBars || !!analysisForecast);
  const forecastOn = forecastable && showForecast;
  const forecastResource = useCachedResource<KlineForecast>(
    klineForecastKey(symbol, forecastInterval),
    signal => getKlineForecast(symbol, forecastInterval, signal),
    { ttl: 10 * 60_000, timeout: 130_000, enabled: forecastOn && !analysisForecast },
  );
  const forecast = forecastOn ? analysisForecast ?? forecastResource.data ?? null : null;
  const priceExtent = useMemo(() => forecastExtent(forecast), [forecast]);
  const forecastErrorCode = forecastOn && !analysisForecast && forecastResource.error ? ((forecastResource.error as { code?: string }).code || "unavailable") : null;
  const pct = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
  const drawingEdit = useRef<DrawingEdit | null>(null);

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

  const [legendOpen, setLegendOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  /** Explicit per-layer choices; unset layers follow the width default (phones hide trend + pattern). */
  const [layerPrefs, setLayerPrefs] = useState<Partial<Record<DrawingGroup, boolean>>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("kolvex:chart-layers") || "null");
      if (saved && typeof saved === "object") setLayerPrefs(saved);
    } catch { /* Keep width defaults when storage is unavailable. */ }
  }, []);
  const narrowChart = size.width > 0 && size.width - GRAPH_AXIS_WIDTH < 480;
  const layerOn = (group: DrawingGroup) => layerPrefs[group] ?? !(narrowChart && (group === "trend" || group === "pattern"));
  const hiddenGroups = useMemo(
    () => new Set(drawingGroups.filter(group => !layerOn(group))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layerPrefs, narrowChart],
  );
  function toggleLayer(group: DrawingGroup) {
    const next = { ...layerPrefs, [group]: !layerOn(group) };
    setLayerPrefs(next);
    try { window.localStorage.setItem("kolvex:chart-layers", JSON.stringify(next)); } catch { /* Session-only preference. */ }
  }

  const lastHistoryAttempt = useRef(attempt);
  useEffect(() => {
    const force = lastHistoryAttempt.current !== attempt;
    lastHistoryAttempt.current = attempt;
    const controller = new AbortController();
    setBars(snapshotBars ?? peekClientCache<PriceBar[]>(chartCacheKey) ?? null);
    setError(false);
    setHistoryStale(false);
    setActive(null);
    setView(null);
    setPriceDomainOverride(null);
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
    if (snapshotBars) return;
    const controller = new AbortController();
    let pending = false;
    const refreshHistory = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const data = await getStockHistory(symbol, JSON.parse(paramsKey), controller.signal, true);
        if (!controller.signal.aborted) {
          setBars(data);
          setError(false);
          setHistoryStale(false);
        }
      } catch {
        if (!controller.signal.aborted) setHistoryStale(true);
      } finally { pending = false; }
    };
    const timer = window.setInterval(refreshHistory, 60_000);
    document.addEventListener("visibilitychange", refreshHistory);
    window.addEventListener("focus", refreshHistory);
    window.addEventListener("online", refreshHistory);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshHistory);
      window.removeEventListener("focus", refreshHistory);
      window.removeEventListener("online", refreshHistory);
    };
  }, [symbol, paramsKey, snapshotBars]);

  useEffect(() => {
    setSelectedId(null);
    setDraft(null);
    setAi({ status: "idle" });
    setDrawingAi({ status: "idle" });
  }, [symbol]);

  const count = bars?.length ?? 0;
  const times = useMemo(() => (bars || []).map((bar) => Date.parse(bar.date)), [bars]);
  const series = useMemo(() => computeIndicators(bars || [], intraday), [bars, intraday]);
  /**
   * Bar index of the model's last input bar. Forecast point i sits at `forecastBase + 1 + i`;
   * when the chart has newer bars than the (cached) forecast, the band starts inside them.
   */
  const forecastBase = useMemo(() => {
    if (!forecast || !bars?.length) return -1;
    const index = bars.findLastIndex(bar => bar.date.slice(0, 10) <= forecast.context_end);
    return index;
  }, [forecast, bars]);

  const defaultView = useMemo<View>(() => {
    if (!count) return { start: 0, end: 1 };
    if (!advanced) return { start: 0, end: count };
    if (count < 3) return { start: 0, end: Math.max(count, 1) };
    // Shared default: the selected window with enough context to warm up the indicators.
    return defaultGraphView({ count, times, range, rangeStart: rangeStart(range, times[count - 1]) }) || { start: 0, end: count };
  }, [advanced, count, range, times]);
  const current = view || defaultView;
  /** Once per loaded forecast, widen the window so the band past the last bar is in view; turning it off gives the room back. */
  const revealedForecast = useRef<string | null>(null);
  useEffect(() => {
    if (!forecast || forecastBase < 0) {
      if (!forecastOn && revealedForecast.current) {
        revealedForecast.current = null;
        setView(previous => previous && previous.end > count ? clampGraphView({ start: previous.start, end: count }, count) : previous);
      }
      return;
    }
    const id = `${forecast.symbol}:${forecast.interval}:${forecast.context_end}`;
    if (revealedForecast.current === id) return;
    revealedForecast.current = id;
    const end = forecastBase + forecast.points.length + 2;
    setView(previous => {
      const base = previous || defaultView;
      if (base.end >= end) return previous;
      return clampGraphView({ start: base.start, end }, count + forecast.points.length + 2);
    });
  }, [forecast, forecastBase, forecastOn, defaultView, count]);

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

  function zoom(factor: number, anchorRatio: number) {
    setView(zoomGraphView(current, factor, anchorRatio, count, MIN_BARS));
  }

  const activeIndicators = new Set(advanced ? indicators : []);
  const showVolume = activeIndicators.has("volume");
  const plotW = Math.max(size.width - GRAPH_AXIS_WIDTH, 1);
  const span = current.end - current.start;
  const slot = plotW / Math.max(span, 1e-6);
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

  function locate(event: PointerEvent<HTMLDivElement>, plot: GraphGeometry, snap = magnet) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const slot = plot.plotWidth / Math.max(plot.view.end - plot.view.start, 1e-6);
    let index = px / slot + plot.view.start - 0.5;
    let price = plot.priceAt(py);
    if (snap && bars?.length) {
      index = Math.min(Math.max(Math.round(index), 0), count - 1);
      const bar = bars[index];
      const nearest = [bar.open, bar.high, bar.low, bar.close].reduce((best, value) =>
        Math.abs(plot.yOf(value) - py) < Math.abs(plot.yOf(best) - py) ? value : best,
      );
      if (Math.abs(plot.yOf(nearest) - py) <= SNAP_PX) price = nearest;
    }
    return { anchor: { time: plot.timeAt(index), price }, px, py };
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

  function resetView() {
    setView(null);
    setPriceDomainOverride(null);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>, plot: GraphGeometry) {
    const { anchor, px, py } = locate(event, plot);
    if (px < 0 || px > plot.plotWidth || py < 0 || py > plot.axisBlock.h) return false;
    if (drawing) {
      const type = tool as Drawing["type"];
      if (type === "hline" || type === "vline") commit({ id: newDrawingId(), type, points: [anchor], color });
      else if (draft?.awaitingSecond) commit({ ...draft.drawing, points: [draft.drawing.points[0], anchor] });
      else setDraft({
        drawing: { id: newDrawingId(), type, points: [anchor, anchor], color },
        start: { x: px, y: py },
        awaitingSecond: false,
      });
      return true;
    }
    const target = (event.target as Element).closest<SVGElement>("[data-drawing]");
    if (!target?.dataset.drawing) {
      setSelectedId(null);
      return false;
    }
    const handle = target.dataset.handle;
    setSelectedId(target.dataset.drawing);
    drawingEdit.current = {
      id: target.dataset.drawing,
      handle: handle === undefined ? "body" : Number(handle),
      origin: locate(event, plot, false).anchor,
      before: drawings,
      moved: false,
    };
    return true;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>, plot: GraphGeometry) {
    const edit = drawingEdit.current;
    if (!edit && !draft) return;
    const { anchor } = locate(event, plot);
    if (edit) {
      const free = locate(event, plot, false).anchor;
      const shift = plot.indexAt(free.time) - plot.indexAt(edit.origin.time);
      const lift = free.price - edit.origin.price;
      const next = edit.before.map((item) => {
        if (item.id !== edit.id) return item;
        const points =
          edit.handle === "body"
            ? item.points.map((point) => ({
                time: plot.timeAt(plot.indexAt(point.time) + shift),
                price: point.price + lift,
              }))
            : item.points.map((point, index) => (index === edit.handle ? anchor : point));
        return { ...item, points };
      });
      edit.moved = true;
      setDrawings(next, null);
      return;
    }
    if (draft) setDraft({
      ...draft,
      drawing: { ...draft.drawing, points: [draft.drawing.points[0], anchor] },
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>, plot: GraphGeometry) {
    const edit = drawingEdit.current;
    drawingEdit.current = null;
    if (event.type === "pointercancel") {
      if (edit?.moved) setDrawings(edit.before, null);
      setDraft(null);
      return;
    }
    if (edit?.moved) setDrawings(drawings, edit.before);
    if (draft && !draft.awaitingSecond) {
      const { anchor, px, py } = locate(event, plot);
      if (Math.hypot(px - draft.start.x, py - draft.start.y) > 5) {
        commit({ ...draft.drawing, points: [draft.drawing.points[0], anchor] });
      } else setDraft({ ...draft, awaitingSecond: true });
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

  function handleDrawingKey(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") undo();
    else if ((event.key === "Delete" || event.key === "Backspace") && selectedId) removeSelected();
    else if (event.key !== "Escape" || escapeRef || !cancelOne()) return;
    event.preventDefault();
  }

  async function runAi(operation: "analysis" | "drawings" = "analysis") {
    if (!bars || !count || aiBusy || ai.status === "loading" || drawingAi.status === "loading") return;
    if (!modelReady) {
      // Keep whatever is on screen; ask for a model and offer to start right after. The phone
      // sheet swaps to its settings step instead of opening a second sheet over itself.
      setPendingRun(operation);
      if (aiSheetOpen) setAiSheetView("settings");
      else setSettingsOpen(true);
      void refreshProviders();
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


  const stat = (label: string, value: string, tone?: string) => (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className={cn("font-medium", tone || "text-foreground")}>{value}</span>
    </span>
  );
  /** Outline for chips that are off, so "off" reads as a control rather than plain text. */
  const offChip = "border border-foreground/20";
  const pill = (isActive: boolean) =>
    cn(
      "inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.8125rem] font-semibold transition-colors duration-150 focus-visible:outline-none",
      isActive ? "glass-thumb text-foreground" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]",
    );

  const hideDrawingsControl = (fill = false, chip = false) => (
            <Dialog open={hideDrawingsOpen} onOpenChange={setHideDrawingsOpen}>
              {drawingAi.status === "done" && (drawingsHidden ? <Button ref={hideDrawingTriggerRef} type="button" size="sm" variant="outline" aria-label={t("youtubeOpinions.ai.showDrawings")} title={t("youtubeOpinions.ai.showDrawings")} aria-pressed={false} className={chip ? cn(pill(false), "h-9 gap-1.5 bg-transparent sm:h-8", offChip) : cn("min-h-11 w-full min-w-0 gap-2 px-2 sm:min-h-9 sm:w-auto sm:px-3", fill && "sm:min-h-11 sm:w-full")} disabled={aiBusy} onClick={() => onDrawingVisibilityChange?.(false)}>
                <Eye className="h-4 w-4" aria-hidden="true" /><span className={cn(!chip && "sm:hidden")}>{t("youtubeOpinions.ai.showDrawingsShort")}</span><span className={chip ? "hidden" : "hidden sm:inline"}>{t(fill ? "youtubeOpinions.ai.showDrawingsShort" : "youtubeOpinions.ai.showDrawings")}</span>
              </Button> : <DialogTrigger asChild>
                <Button ref={hideDrawingTriggerRef} type="button" size="sm" variant="outline" aria-label={t("youtubeOpinions.ai.clear")} title={t("youtubeOpinions.ai.clear")} aria-pressed={true} className={chip ? cn(pill(false), "h-9 gap-1.5 bg-transparent sm:h-8", offChip) : cn("min-h-11 w-full min-w-0 gap-2 px-2 sm:min-h-9 sm:w-auto sm:px-3", fill && "sm:min-h-11 sm:w-full")} disabled={aiBusy}>
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                  <span className={cn(!chip && "sm:hidden")}>{t("youtubeOpinions.ai.hideDrawingsShort")}</span><span className={chip ? "hidden" : "hidden sm:inline"}>{t(fill ? "youtubeOpinions.ai.hideDrawingsShort" : "youtubeOpinions.ai.clear")}</span>
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
  const aiActionClass = cn(
    "min-h-11 min-w-0 gap-2 px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    advanced ? "w-full" : "sm:min-h-9 sm:min-w-[7rem]",
  );
  const aiSettingsDescription = t(pendingRun ? "youtubeOpinions.ai.pendingRunHint" : "youtubeOpinions.ai.chartSettingsHint");
  /** Model, focus and drawing-version controls, shared by the desktop dialog and the phone sheet. */
  const aiSettings = (
    <>
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
    </>
  );
  /** `back` is the previous step, `close` dismisses the surface, `start` launches `pendingRun`. */
  const aiSettingsFooter = (actions: { back: () => void; close: () => void; start: () => void }) => (
    <DialogFooter className="shrink-0 gap-2 border-t border-border sm:space-x-0">
      {pendingRun ? <>
        <Button type="button" variant="outline" onClick={actions.back}>{t("common.cancel")}</Button>
        <Button type="button" disabled={!modelReady || providersLoading} onClick={actions.start}>
          {pendingRun === "analysis" ? <ScanSearch className="h-4 w-4" aria-hidden="true" /> : <GanttChart className="h-4 w-4" aria-hidden="true" />}
          {t(pendingRun === "analysis" ? "youtubeOpinions.ai.empty.start" : "youtubeOpinions.ai.startDrawings")}
        </Button>
      </> : <Button type="button" onClick={actions.close}>{t("common.close")}</Button>}
    </DialogFooter>
  );
  const aiRunButtons = (
    <div className={advanced ? "contents" : "contents sm:flex sm:items-center sm:gap-2"}>
      <Button size="sm" variant="outline" className={aiActionClass} onClick={() => void runAi("analysis")} aria-busy={ai.status === "loading"}
        disabled={!loaded || providersLoading || aiBusy || ai.status === "loading" || drawingAi.status === "loading"}
        title={t("youtubeOpinions.ai.runAnalysis")}>
        {ai.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ScanSearch className="h-4 w-4" aria-hidden="true" />}
        {t("youtubeOpinions.ai.analysisButton")}
      </Button>
      <Button ref={drawingButtonRef} size="sm" variant="outline" className={aiActionClass} onClick={() => void runAi("drawings")} aria-busy={drawingAi.status === "loading"}
        disabled={!loaded || providersLoading || aiBusy || ai.status === "loading" || drawingAi.status === "loading"}
        title={t("youtubeOpinions.ai.runDrawings")}>
        {drawingAi.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GanttChart className="h-4 w-4" aria-hidden="true" />}
        {t("youtubeOpinions.ai.button")}
      </Button>
    </div>
  );
  /** One row of actions plus a settings control, so every surface keeps the same action order. */
  const aiActionsRow = (settingsTrigger: ReactNode) => (
    <div className={advanced ? "grid grid-cols-[1fr_1fr_auto] gap-2" : "grid grid-cols-[1fr_1fr_auto] gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3"}>
      {aiRunButtons}
      <div className={advanced ? "contents" : "contents sm:ml-auto sm:flex sm:flex-wrap sm:items-center sm:gap-2"}>
        {settingsTrigger}
        {advanced && drawingAi.status === "done" && <div className="col-span-3 min-w-0 max-lg:hidden [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_button]:focus-visible:ring-offset-2 [&_button]:focus-visible:ring-offset-background">{hideDrawingsControl(true)}</div>}
      </div>
    </div>
  );
  const aiSettingsButtonClass = cn(aiActionClass, advanced ? "!w-11 px-0" : "!w-11 px-0 sm:!w-auto sm:px-3");
  const onAiSettingsOpenChange = (open: boolean) => {
    setSettingsOpen(open);
    if (open) void refreshProviders();
    else setPendingRun(null);
  };
  /** Mounted by the advanced controls and by the standard layout, whose "choose a model" button needs it too. */
  const aiSettingsDialogContent = (
    <DialogContent layout="sheet" showCloseButton={false} className="flex flex-col" onEscapeKeyDown={(event) => event.stopPropagation()}>
      <DialogHeader>
        <DialogTitle>{t("youtubeOpinions.ai.chartSettings")}</DialogTitle>
        <DialogDescription>{aiSettingsDescription}</DialogDescription>
      </DialogHeader>
      <DialogClose asChild>
        <Button type="button" variant="icon" size="icon" className="absolute right-2 top-2 min-h-11 min-w-11" aria-label={t("common.close")}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogClose>
      <div className="mt-2 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pb-2">
        {aiSettings}
      </div>
      {aiSettingsFooter({
        back: () => setSettingsOpen(false),
        close: () => setSettingsOpen(false),
        start: () => {
          const operation = pendingRun;
          setSettingsOpen(false);
          setPendingRun(null);
          if (operation) void runAi(operation);
        },
      })}
    </DialogContent>
  );
  const aiControls = (
    <div className="min-w-0" role="group" aria-label={t("youtubeOpinions.ai.actions")}>
      {aiActionsRow(
        <Dialog open={settingsOpen} onOpenChange={onAiSettingsOpenChange}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" variant="outline" aria-label={t("youtubeOpinions.ai.chartSettings")} title={t("youtubeOpinions.ai.chartSettings")} className={aiSettingsButtonClass}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className={cn(advanced ? "sr-only" : "sr-only sm:not-sr-only")}>{t("youtubeOpinions.ai.chartSettings")}</span>
            </Button>
          </DialogTrigger>
          {aiSettingsDialogContent}
        </Dialog>,
      )}
    </div>
  );
  /** The phone sheet uses the same action row, but its settings trigger swaps the sheet's step. */
  const mobileAiControls = (
    <div className="min-w-0" role="group" aria-label={t("youtubeOpinions.ai.actions")}>
      {aiActionsRow(
        <Button type="button" size="sm" variant="outline" aria-label={t("youtubeOpinions.ai.chartSettings")} title={t("youtubeOpinions.ai.chartSettings")} className={cn(aiActionClass, "!w-11 px-0")}
          onClick={() => { setAiSheetView("settings"); void refreshProviders(); }}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>,
      )}
    </div>
  );
  const activeOperation = aiJobs.analysis.status === "loading" ? "analysis" as const : aiJobs.drawings.status === "loading" ? "drawings" as const : null;
  const activeJob = activeOperation ? aiJobs[activeOperation] : null;
  const failedOperation = ai.status === "error" ? "analysis" : drawingAi.status === "error" ? "drawings" : null;
  const aiFailure = failedOperation ? (
    <div role="alert" className={cn("flex flex-wrap items-start gap-x-2 gap-y-2 text-sm leading-6 text-negative", !advanced && "rounded-2xl bg-negative/10 px-3 py-2.5")}>
      <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{failedOperation === "analysis" ? ai.error : drawingAi.error}</p>
      <Button size="sm" variant="outline" disabled={aiBusy} onClick={() => void runAi(failedOperation)}>
        {t(modelReady ? "common.retry" : "youtubeOpinions.ai.chartSettings")}
      </Button>
    </div>
  ) : null;
  const aiStatus = aiJobs.monitorError ? (
    <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm leading-6 text-warning">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{t("youtubeOpinions.ai.statusUnavailable")}</span>
      <Button size="sm" variant="ghost" onClick={aiJobs.refresh}>{t("youtubeOpinions.ai.checkStatus")}</Button>
    </div>
  ) : activeJob && activeOperation ? (
    <AiJobStatusChip operation={activeOperation} phase={activeJob.phase} startedAt={activeJob.startedAt} t={t} />
  ) : advanced && aiFailure ? <div>{aiFailure}</div> : null;
  const stackedResults = !advanced && (compactLayout === "workspace" || Boolean(resultsContainer));
  const aiResults = (<>
    {activeJob && activeOperation && <AiJobProgress
      operation={activeOperation}
      phase={activeJob.phase}
      startedAt={activeJob.startedAt}
      t={t}
      className={stackedResults ? "order-first" : "mt-4"}
    />}
    {ai.status === "idle" && drawingAi.status === "idle" && !aiBusy && !aiJobs.monitorError && <AiAnalysisEmptyState
      symbol={symbol}
      interval={params.interval || "1d"}
      disabled={!loaded || providersLoading || aiJobs.checking}
      modelReady={modelReady}
      onAnalyze={() => void runAi("analysis")}
      t={t}
    />}
    {!advanced && aiFailure && <div className={stackedResults ? "order-first mb-4" : "mt-4"}>{aiFailure}</div>}
    {(ai.status === "done" || (ai.status === "error" && savedAnalysis)) && (
          <AiAnalysisPanel
            state={ai.status === "done" ? ai : { status: "done", result: savedAnalysis! }}
            busy={aiBusy}
            version={savedAnalysisVersion}
            onRetry={() => void runAi("analysis")}
            forecastVisible={forecastOn}
            onToggleForecast={analysisForecast && forecastable ? () => setShowForecast(value => !value) : undefined}
            showRetry={advanced}
            formatDate={formatDate}
            t={t}
            className={stackedResults ? "order-first" : "mt-5"}
          />
        )}
  </>);

  /**
   * Advanced mode's candles / indicators painted on the shared `PriceGraph` geometry. The graph
   * owns the SVG, the axes and every pointer/keyboard gesture; this callback only draws the
   * marks, so both modes keep one price scale and one interaction model.
   */
  /** P10–P90 closing band, dashed median and faint median candles, starting at the model's last bar. */
  function renderForecast(data: KlineForecast, base: number, x: (index: number) => number, y: (price: number) => number, slot: number, height: number): ReactNode {
    if (!bars?.[base]) return null;
    const anchor = { index: base, price: bars[base].close };
    const at = (offset: number) => base + 1 + offset;
    const upper = [`${x(anchor.index).toFixed(1)},${y(anchor.price).toFixed(1)}`];
    const lower = [`${x(anchor.index).toFixed(1)},${y(anchor.price).toFixed(1)}`];
    let median = `M${x(anchor.index).toFixed(1)},${y(anchor.price).toFixed(1)}`;
    data.points.forEach((point, offset) => {
      upper.push(`${x(at(offset)).toFixed(1)},${y(point.close_p90).toFixed(1)}`);
      lower.unshift(`${x(at(offset)).toFixed(1)},${y(point.close_p10).toFixed(1)}`);
      median += `L${x(at(offset)).toFixed(1)},${y(point.close).toFixed(1)}`;
    });
    const up = data.summary.median_return >= 0;
    const tone = up ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))";
    const width = Math.max(slot * 0.5, 1);
    return (
      <g aria-hidden="true" pointerEvents="none">
        <line x1={x(base + 0.5)} x2={x(base + 0.5)} y1={0} y2={height} stroke="rgb(var(--foreground) / 0.25)" strokeDasharray="2 4" />
        <path d={`M${upper.join("L")}L${lower.join("L")}Z`} fill={tone} fillOpacity={0.12} />
        {data.points.map((point, offset) => {
          const cx = x(at(offset));
          const top = y(Math.max(point.open, point.close));
          const bottom = y(Math.min(point.open, point.close));
          const fill = point.close >= point.open ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))";
          return (
            <g key={point.date} opacity={0.35}>
              <line x1={cx} x2={cx} y1={y(point.high)} y2={y(point.low)} stroke={fill} strokeWidth={1} />
              <rect x={cx - width / 2} y={top} width={width} height={Math.max(bottom - top, 1)} fill="none" stroke={fill} strokeWidth={1} />
            </g>
          );
        })}
        <path d={median} fill="none" stroke={tone} strokeWidth={1.5} strokeDasharray="5 4" strokeLinejoin="round" />
      </g>
    );
  }

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
    const visibleBars = bars.slice(firstVisible, lastVisible + 1);
    const maxVolume = visibleBars.reduce((maximum, bar) => Math.max(maximum, bar.volume || 0), 1);
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
        {visibleBars.map((bar, offset) => {
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
        {forecast && forecastBase >= 0 && renderForecast(forecast, forecastBase, x, y, slot, priceBottom)}
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
      {forecastOn && (forecast || forecastErrorCode) && (
        <div
          role="note"
          className="absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full border border-border bg-background/85 py-0.5 pl-2.5 pr-1 text-[0.6875rem] leading-4 text-muted-foreground backdrop-blur-sm"
        >
          {forecast ? (
            <>
              <span className="min-w-0 truncate tabular-nums">
                <span className="font-semibold text-foreground">{t("youtubeOpinions.forecast.title", { days: String(forecast.horizon) })}</span>{" · "}
                {t("youtubeOpinions.forecast.summary", {
                  median: pct(forecast.summary.median_return),
                  up: `${Math.round(forecast.summary.prob_up * 100)}%`,
                })}
              </span>
              <InfoTip label={t("youtubeOpinions.forecast.hint")}>
                <span className="block tabular-nums">{t("youtubeOpinions.forecast.range", { low: pct(forecast.summary.p10_return), high: pct(forecast.summary.p90_return) })}</span>
                <span className="block tabular-nums">{t("youtubeOpinions.forecast.asOf", { date: forecast.context_end })}</span>
                <span className="mt-1 block">{t("youtubeOpinions.forecast.disclaimer")}</span>
              </InfoTip>
            </>
          ) : (
            <span className="py-0.5 pr-1.5">{t(`youtubeOpinions.forecast.errors.${forecastErrorCode === "not_configured" || forecastErrorCode === "unauthorized" ? forecastErrorCode : "unavailable"}`)}</span>
          )}
        </div>
      )}
      {legend.length > 0 && (
        <div
          className="pointer-events-none absolute left-2 top-1 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md bg-background/70 px-1.5 py-0.5 text-[0.6875rem] tabular-nums backdrop-blur-sm"
          style={{ maxWidth: Math.max(size.width - GRAPH_AXIS_WIDTH - 16, 120) }}
        >
          {/* Phones show one line ("EMA 20, EMA 50, +2"), expanding on tap. */}
          {(narrowChart && !legendOpen ? legend.slice(0, LEGEND_PREVIEW) : legend).map((key) => (
            <span key={key} className="whitespace-nowrap">
              <span className="text-muted-foreground">{indicatorMeta[key].label}</span>{" "}
              <span className="font-semibold" style={{ color: indicatorMeta[key].color }}>
                {legendValue(key)}
              </span>
            </span>
          ))}
          {narrowChart && legend.length > LEGEND_PREVIEW && (
            <button
              type="button"
              aria-expanded={legendOpen}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setLegendOpen(open => !open)}
              className="pointer-events-auto -my-2 inline-flex min-h-8 items-center gap-0.5 font-semibold text-muted-foreground"
            >
              {legendOpen ? t("youtubeOpinions.legendLess") : t("youtubeOpinions.legendMore", { count: String(legend.length - LEGEND_PREVIEW) })}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", legendOpen && "rotate-180")} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {activeEvents.length > 0 && !drawing && !drawingEdit.current && active !== null && (
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
  const drawingLayerNode = (plot: GraphGeometry) => (
    <ChartDrawingLayer
      width={plot.plotWidth}
      height={plot.axisBlock.h}
      axisWidth={plot.axisWidth}
      hiddenGroups={hiddenGroups}
      lastPrice={bars?.[count - 1]?.close}
      drawings={drawings}
      draft={draft?.drawing ?? null}
      selectedId={advanced ? selectedId : null}
      interactive={advanced && !drawing}
      toPx={plot.toPx}
      barsBetween={plot.barsBetween}
      t={t}
    />
  );

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
      <SelectTrigger className="!h-8 !w-auto shrink-0 gap-1 rounded-full px-2.5 text-[0.8125rem] font-semibold sm:!w-[5.75rem] sm:px-3" aria-label={t("youtubeOpinions.interval")}>
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
      disabled={!loaded}
      onClick={() => setPriceDomainOverride(autoScale ? priceDomain(bars ?? [], current, priceExtent) : null)}
      className={cn(pill(autoScale), "gap-1.5")}
    >
      {autoScale ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />}
      {t("youtubeOpinions.autoScale")}
    </button>
  );
  const hideDrawingsSlot = showAi && drawingAi.status === "done" ? hideDrawingsControl() : null;
  /** ▲/▼ key for the creator-call markers; lives in the drawing-layers section when there is one. */
  const callsLegend = showCalls && calls.size > 0 ? (
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
  const presentGroups = drawingGroups.filter(group => drawings.some(item => item.group === group));
  const shownGroups = presentGroups.filter(layerOn);
  /**
   * AI layers as one summary line under the plot ("AI 画线 · 交易计划、支撑阻力 ⌄"), Robinhood's
   * collapsed-legend pattern: the line always says what is on, and taps open the toggles.
   */
  const layersRow = presentGroups.length > 0 || (drawingsHidden && hideDrawingsSlot) ? (
    <ChartSection
      className="mt-1"
      icon={<Layers />}
      label={t("youtubeOpinions.ai.layers.label")}
      summary={shownGroups.length && !drawingsHidden ? shownGroups.map(group => t(`youtubeOpinions.ai.layers.${group}`)).join("、") : t("youtubeOpinions.ai.layers.allOff")}
      summaryClassName={shownGroups.length && !drawingsHidden ? undefined : "text-negative"}
      open={layersOpen}
      onOpenChange={setLayersOpen}
      closeLabel={t("common.close")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("youtubeOpinions.ai.layers.label")} className="contents">
          {presentGroups.map(group => (
            <button
              key={group}
              type="button"
              aria-pressed={layerOn(group)}
              onClick={() => toggleLayer(group)}
              className={cn(pill(layerOn(group)), "h-9 sm:h-8", !layerOn(group) && offChip)}
            >
              {t(`youtubeOpinions.ai.layers.${group}`)}
            </button>
          ))}
        </div>
        {showAi && drawingAi.status === "done" && <div className="contents sm:hidden">{hideDrawingsControl(false, true)}</div>}
      </div>
      {callsLegend && <div className="mt-3">{callsLegend}</div>}
    </ChartSection>
  ) : null;
  const forecastControl = forecastable ? (
    <button
      type="button"
      aria-pressed={showForecast}
      onClick={() => setShowForecast(value => !value)}
      className={cn(pill(showForecast), "gap-1.5")}
      title={t("youtubeOpinions.forecast.hint")}
    >
      {forecastOn && !forecast && !forecastErrorCode
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
      {t("youtubeOpinions.forecast.toggle")}
    </button>
  ) : null;

  /** Compact draw hint / legend lives under the graph, where the reference keeps its notes. */
  const compactFooter = drawing ? (
    <span className="text-xs text-muted-foreground">
      {t((tool === "hline" || tool === "vline") ? "youtubeOpinions.drawHintSingle" : "youtubeOpinions.drawHint")}
    </span>
  ) : layersRow ? null : callsLegend;

  const graph = (
    <PriceGraph
      mode={mode}
      heightClass={heightClass}
      bars={bars}
      quote={quoteResource.data}
      quoteEnabled={!snapshotBars}
      quoteLoading={quoteResource.loading}
      quoteError={!!quoteResource.error}
      onQuoteRetry={quoteResource.refresh}
      historyStale={historyStale}
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
      onGeometry={receiveGraphGeometry}
      priceExtent={priceExtent}
      priceDomainOverride={priceDomainOverride}
      onPriceDomainChange={advanced ? setPriceDomainOverride : undefined}
      drawingLayer={drawingLayerNode}
      drawingInteraction={advanced ? {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onKeyDown: handleDrawingKey,
      } : undefined}
      overlay={advanced ? advancedOverlay : null}
      subPane={<>{layersRow}{oscillatorPane}</>}
      rangeTrailing={advanced ? intervalControl : null}
      trailingControls={advanced ? (
        <>
          {autoScaleControl}
          {forecastControl}
          {hideDrawingsSlot && <div className="hidden sm:contents">{hideDrawingsSlot}</div>}
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
    <div className={cn("min-w-0", advanced && "flex min-h-full gap-4 sm:h-full sm:min-h-0")}>
      <div className={cn("min-w-0", advanced && "flex min-h-0 flex-1 flex-col")}>
        {advanced && (
          <div className="flex shrink-0 items-center gap-3">
            <h2 className="text-lg font-semibold">{symbol}</h2>
            {last && snapshotBars && (
              <span className="flex items-baseline gap-2 text-sm tabular-nums">
                <span className="font-semibold">{formatPrice(last.close)}</span>
                <span className={rangeChange >= 0 ? "text-positive" : "text-negative"}>{formatChangePercent(rangeChange)}</span>
              </span>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {showAi && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="hidden lg:inline-flex"
                  aria-expanded={aiPanelOpen}
                  aria-controls={aiPanelId}
                  onClick={() => setAiPanelOpen(open => !open)}
                >
                  {aiPanelOpen
                    ? <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                    : <PanelRightOpen className="h-4 w-4" aria-hidden="true" />}
                  {t(aiPanelOpen ? "youtubeOpinions.ai.collapsePanel" : "youtubeOpinions.ai.expandPanel")}
                </Button>
              )}
              {showAi && <div className="lg:hidden">
                {/* Phones: one sheet over the chart. Settings are a step inside this sheet, never a second stacked sheet. */}
                <Dialog open={aiSheetOpen} onOpenChange={(open) => {
                  setAiSheetOpen(open);
                  if (!open) setPendingRun(null);
                  // Every open starts on the actions step.
                  setAiSheetView("actions");
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("youtubeOpinions.ai.actions")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent layout="sheet" showCloseButton={false} className="flex flex-col px-4 pt-2" onEscapeKeyDown={(event) => {
                    event.stopPropagation();
                    if (!aiSheetStep) return;
                    // Escape walks back to the actions step instead of dismissing the whole sheet.
                    event.preventDefault();
                    setAiSheetView("actions");
                    setPendingRun(null);
                  }}>
                    <div className="mx-auto mb-2 h-1 w-9 shrink-0 rounded-full bg-foreground/20 sm:hidden" aria-hidden="true" />
                    <div className="flex shrink-0 items-start gap-1 pb-3">
                      {aiSheetStep && (
                        <Button type="button" variant="ghost" size="icon" className="-ml-2 min-h-11 min-w-11" aria-label={t("common.back")}
                          onClick={() => { setAiSheetView("actions"); setPendingRun(null); }}>
                          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </Button>
                      )}
                      <div className="min-w-0 flex-1">
                        <DialogTitle className="text-base font-semibold">{t(aiSheetStep ? "youtubeOpinions.ai.chartSettings" : "youtubeOpinions.ai.actions")}</DialogTitle>
                        <DialogDescription className={cn("mt-0.5 text-xs leading-5 text-muted-foreground", !aiSheetStep && "sr-only")}>
                          {aiSheetStep ? aiSettingsDescription : symbol}
                        </DialogDescription>
                      </div>
                      <DialogClose asChild>
                        <Button type="button" variant="icon" size="icon" className="-mr-2 min-h-11 min-w-11" aria-label={t("common.close")}>
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DialogClose>
                    </div>
                    {aiSheetStep ? <>
                      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pb-2">{aiSettings}</div>
                      {aiSettingsFooter({
                        back: () => { setAiSheetView("actions"); setPendingRun(null); },
                        close: () => setAiSheetOpen(false),
                        start: () => {
                          const operation = pendingRun;
                          setAiSheetView("actions");
                          setPendingRun(null);
                          if (operation) void runAi(operation);
                        },
                      })}
                    </> : <>
                      <div className="shrink-0">{mobileAiControls}{aiStatus}</div>
                      <div className="-mx-4 mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-2">
                        {aiResults}
                      </div>
                    </>}
                  </DialogContent>
                </Dialog>
              </div>}
              {headerActions}
            </div>
          </div>
        )}

        {showAi && advanced && <div className="lg:hidden">{aiStatus}</div>}

        {/* active-bar numbers: the graph prints the header line, advanced mode adds OHLC + calls */}
        {advanced && (
          <div
            className="mt-1 flex min-h-8 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] tabular-nums"
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

        {showAi && !advanced && aiStatus}

        <div
          id={drawingToolbarId}
          role="toolbar"
          aria-label={t("youtubeOpinions.drawTools")}
          className={cn("shrink-0 flex-nowrap items-center gap-0.5 overflow-x-auto overscroll-x-contain border-b border-border scrollbar-hide sm:gap-1", advanced ? "flex my-1 pb-1" : "hidden")}
        >
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" aria-label={t("youtubeOpinions.drawTools")} title={t("youtubeOpinions.drawTools")} variant="toolbar" size="toolbar" selected={drawing} className={"sm:hidden"}>
                {(() => { const Icon = tools.find(item => item.value === tool)?.icon || MousePointer2; return <Icon className="h-4 w-4" />; })()}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="grid w-64 max-w-[calc(100vw-2rem)] grid-cols-2 gap-1 p-2">
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
              <Button
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
                variant="toolbar" size="toolbar" selected={tool === item.value}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}</div>
          <span className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden="true" />
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" aria-label={t("youtubeOpinions.drawColor")} title={t("youtubeOpinions.drawColor")} variant="toolbar" size="toolbar" selected={false}>
                <span className="h-4 w-4 rounded-full " style={{ backgroundColor: selected?.color ?? color }} />
              </Button>
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
          <Button
            type="button"
            title={t("youtubeOpinions.magnet")}
            aria-label={t("youtubeOpinions.magnet")}
            aria-pressed={magnet}
            onClick={() => setMagnet((value) => !value)}
            variant="toolbar" size="toolbar" selected={magnet}
          >
            <Magnet className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            title={t("youtubeOpinions.showCalls")}
            aria-label={t("youtubeOpinions.showCalls")}
            aria-pressed={showCalls}
            onClick={() => setShowCalls((value) => !value)}
            variant="toolbar" size="toolbar" selected={showCalls}
          >
            {showCalls ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                title={t("youtubeOpinions.indicators")}
                aria-label={t("youtubeOpinions.indicators")}
                variant="toolbar" size="toolbar" selected={legend.length > 0}
              >
                <Activity className="h-4 w-4" />
              </Button>
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
                      "flex h-4 w-4 items-center justify-center rounded border border-border text-[0.625rem]",
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
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            <Button
              type="button"
              title={t("youtubeOpinions.zoomIn")}
              aria-label={t("youtubeOpinions.zoomIn")}
              disabled={!loaded}
              onClick={() => zoom(0.7, 0.85)}
              variant="toolbar" size="toolbar" selected={false} className={"max-sm:hidden"}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title={t("youtubeOpinions.zoomOut")}
              aria-label={t("youtubeOpinions.zoomOut")}
              disabled={!loaded}
              onClick={() => zoom(1.4, 0.85)}
              variant="toolbar" size="toolbar" selected={false} className={"max-sm:hidden"}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title={t("youtubeOpinions.resetZoom")}
              aria-label={t("youtubeOpinions.resetZoom")}
              disabled={!view && autoScale}
              onClick={resetView}
              variant="toolbar" size="toolbar" selected={false} className={"max-sm:hidden"}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <span className="mx-1 h-5 w-px shrink-0 bg-border max-sm:hidden" aria-hidden="true" />
            <span
              role="status"
              title={t(`youtubeOpinions.sync.${syncStatus}`)}
              aria-label={t(`youtubeOpinions.sync.${syncStatus}`)}
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center",
                syncStatus === "offline" ? "text-negative" : "text-muted-foreground",
                // a settled sync is not news on a phone; keep the row to one line
                (syncStatus === "synced" || syncStatus === "local") && "max-sm:hidden",
              )}
            >
              <SyncIcon className={cn("h-4 w-4", (syncStatus === "loading" || syncStatus === "syncing") && "animate-spin")} />
            </span>
            <Button
              type="button"
              title={t("youtubeOpinions.undo")}
              aria-label={t("youtubeOpinions.undo")}
              disabled={!canUndo}
              onClick={undo}
              variant="toolbar" size="toolbar" selected={false}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title={t("youtubeOpinions.deleteDrawing")}
              aria-label={t("youtubeOpinions.deleteDrawing")}
              disabled={!selectedId}
              onClick={removeSelected}
              variant="toolbar" size="toolbar" selected={false}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title={t("youtubeOpinions.clearDrawings")}
              aria-label={t("youtubeOpinions.clearDrawings")}
              disabled={!drawings.length}
              onClick={() => {
                setDrawings([]);
                setSelectedId(null);
              }}
              variant="toolbar" size="toolbar" selected={false}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {graph}

        {!advanced && compactFooter && <div className="mt-3 mb-6 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">{compactFooter}</div>}

        {showAi && !advanced && <Dialog open={settingsOpen} onOpenChange={onAiSettingsOpenChange}>{aiSettingsDialogContent}</Dialog>}
        {showAi && !advanced &&
          compactLayout !== "workspace" &&
          (resultsContainer ? createPortal(aiResults, resultsContainer) : aiResults)}
        {showAi && !advanced && compactLayout === "workspace" && resultsContainer && createPortal(aiResults, resultsContainer)}
      </div>
      {showAi && advanced && <aside
        id={aiPanelId}
        aria-label={t("youtubeOpinions.ai.actions")}
        className={cn("hidden min-h-0 w-[clamp(22rem,28vw,30rem)] shrink-0 overflow-y-auto overscroll-contain border-l border-border pl-4", aiPanelOpen && "lg:block")}
      >
        {aiControls}{!activeJob && aiStatus}{aiResults}
      </aside>}
    </div>
  );
}
