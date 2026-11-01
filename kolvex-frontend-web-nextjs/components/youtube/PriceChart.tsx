"use client";
import { useCachedResource } from "@/hooks/useCachedResource";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { getYouTubeStockDetail, type YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import type { AiTechnicalAnalysis } from "@/lib/stockApi";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import {
  defaultRangeForWindow,
  historyParamsFor,
  priceRanges,
  rangeLabelFor,
  type PriceRange,
} from "@/lib/chart/range";
import { useSyncedDrawings, type Drawing } from "./chartDrawings";
import SavedAnalysisData from "@/components/decision/SavedAnalysisData";
import AnalysisHistory, { DrawingVersionSelector, useStockHistory } from "@/components/decision/AnalysisHistory";
import { analysisDrawings } from "./aiDrawings";
import ChartView from "./chart/ChartView";
import TechnicalFocusSelector from "./chart/TechnicalFocusSelector";
import { DEFAULT_TECHNICAL_FOCUS, DEFAULT_DRAWING_FOCUS, type TechnicalFocus } from "@/lib/technicalFocus";
import { useChartAiJobs } from "@/hooks/useChartAiJobs";
import type { StrengthPoint } from "./StrengthChart";

type Translate = (key: string, params?: Record<string, string>) => string;
export type { PriceRange } from "@/lib/chart/range";

const isoDay = (date: Date) => format(date, "yyyy-MM-dd");

/**
 * Price chart for the opinion window, plus a full-screen advanced chart. Both share the
 * creator calls, the drawings synced per user and ticker, and one undo history.
 */
export default function PriceChart({
  symbol,
  range: requestedRange,
  from,
  to,
  opinions,
  formatDate,
  t,
  onAnalysisChange,
  onRangeChange,
  generationRequest = 0,
  drawingRequest = 0,
  onAnalysisBusy,
  layout = "compact",
  resultsContainer,
}: {
  symbol: string;
  /**
   * Time span the graph shows. Optional: without it the chart opens on a window sized to the
   * opinion window it is given (`defaultRangeForWindow`), which is "3M" for an empty page.
   * Selector changes are reported back through `onRangeChange` so a page can mirror them.
   */
  range?: PriceRange;
  from: string;
  to: string;
  opinions: StrengthPoint[];
  formatDate: (date: string) => string;
  t: Translate;
  onAnalysisChange?: (result: AiTechnicalAnalysis | null) => void;
  onRangeChange?: (range: PriceRange) => void;
  generationRequest?: number;
  drawingRequest?: number;
  onAnalysisBusy?: (busy: boolean) => void;
  layout?: "compact" | "workspace";
  resultsContainer?: HTMLElement | null;
}) {
  const { drawings, setDrawings: storeDrawings, status: syncStatus } = useSyncedDrawings(symbol);
  const versions = useStockHistory<AiTechnicalAnalysis>(symbol, "technical");
  const drawingVersions = useStockHistory<AiTechnicalAnalysis>(symbol, "drawings");
  const [hiddenAnalysis, setHiddenAnalysis] = useState(false);
  const [hiddenDrawings, setHiddenDrawings] = useState(false);
  const [viewingHistory, setViewingHistory] = useState<"analysis" | "drawings">("analysis");
  const [aiOverrides, setAiOverrides] = useState<Drawing[] | null>(null);
  const [drawingFocus, setDrawingFocus] = useState<TechnicalFocus>(DEFAULT_DRAWING_FOCUS);
  const [technicalFocus, setTechnicalFocus] = useState<TechnicalFocus>(DEFAULT_TECHNICAL_FOCUS);
  const [selectedModel, setSelectedModel] = useState("");
  const selectedId = versions.selected?.id;
  useEffect(() => { setHiddenAnalysis(false); }, [selectedId]);
  const selectedDrawingId = drawingVersions.selected?.id;
  useEffect(() => { setHiddenDrawings(false); setAiOverrides(null); }, [selectedDrawingId]);
  const savedFocus = versions.selected?.payload;
  useEffect(() => {
    if (!savedFocus) return;
    setTechnicalFocus({
      categories: savedFocus.categories ?? DEFAULT_TECHNICAL_FOCUS.categories,
      custom_scenarios: savedFocus.custom_scenarios ?? [],
    });
  }, [savedFocus]);
  const selectedAnalysis = useMemo(() => versions.selected && !hiddenAnalysis
    ? { ...versions.selected.payload, version_id: versions.selected.id } : null, [versions.selected, hiddenAnalysis]);
  useEffect(() => { onAnalysisChange?.(selectedAnalysis); }, [selectedAnalysis, onAnalysisChange]);
  const selectedDrawings = useMemo(() => drawingVersions.selected
    ? { ...drawingVersions.selected.payload, version_id: drawingVersions.selected.id } : null, [drawingVersions.selected]);
  const aiDrawings = useMemo(() => selectedDrawings ? analysisDrawings(selectedDrawings, t) : [], [selectedDrawings, t]);
  const manualDrawings = drawings.filter(item => item.source !== "ai");
  const loadVersions = versions.load;
  const analysisChanged = useCallback((result: AiTechnicalAnalysis | null) => {
    if (!result) { setHiddenAnalysis(true); return; }
    setHiddenAnalysis(false);
    setViewingHistory("analysis");
    // The endpoint returns only after the immutable snapshot has committed.

    void loadVersions(0, result.version_id);
  }, [loadVersions]);
  const loadDrawingVersions = drawingVersions.load;
  const drawingsChanged = useCallback((result: AiTechnicalAnalysis | null) => {
    if (!result) { setHiddenDrawings(true); return; }
    setHiddenDrawings(false); setViewingHistory("drawings");
    void loadDrawingVersions(0, result.version_id);
  }, [loadDrawingVersions]);
  const jobCompleted = useCallback((operation: "analysis" | "drawings", result: AiTechnicalAnalysis) => {
    if (operation === "analysis") analysisChanged(result);
    else drawingsChanged(result);
  }, [analysisChanged, drawingsChanged]);
  const aiJobs = useChartAiJobs(symbol, jobCompleted);
  const analysisBusy = aiJobs.busy;
  const analysisPending = analysisBusy || versions.busy;
  useEffect(() => { onAnalysisBusy?.(analysisPending); }, [analysisPending, onAnalysisBusy]);
  useEffect(() => {
    if (aiJobs.analysis.status === "done" && aiJobs.analysis.result?.version_id === selectedId) aiJobs.clear("analysis");
    if (aiJobs.drawings.status === "done" && aiJobs.drawings.result?.version_id === selectedDrawingId) aiJobs.clear("drawings");
    // Once history owns the saved result, its version selector owns rendering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedDrawingId, aiJobs.analysis.result?.version_id, aiJobs.drawings.result?.version_id]);
  const selectedHistory = viewingHistory === "drawings" ? drawingVersions : versions;
  const historicalSnapshot = selectedHistory.selected?.id !== selectedHistory.current?.id ? selectedHistory.selected : null;
  const selectAnalysis = versions.select;
  const selectDrawings = drawingVersions.select;
  const analysisHistory = { ...versions, select: async (item: typeof versions.selected) => { await selectAnalysis(item); setViewingHistory("analysis"); } };
  const drawingHistory = { ...drawingVersions, select: async (item: typeof drawingVersions.selected) => {
    await selectDrawings(item);
    setHiddenDrawings(false);
    setAiOverrides(null);
    setViewingHistory("drawings");
  } };
  const [history, setHistory] = useState<Drawing[][]>([]);
  const opinionQuery = new URLSearchParams();
  if (from) opinionQuery.set("date_from", from);
  if (to) opinionQuery.set("date_to", to);
  const opinionResource = useCachedResource(`/api/youtube-opinions/stocks/${encodeURIComponent(symbol)}${opinionQuery.size ? `?${opinionQuery}` : ""}`, signal => getYouTubeStockDetail(symbol, { date_from: from || undefined, date_to: to || undefined }, signal), { ttl: 60_000 });
  const events = opinionResource.data?.opinions ?? [];
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const escapeRef = useRef<(() => boolean) | null>(null);
  const advancedTriggerRef = useRef<HTMLElement | null>(null);

  /**
   * The graph's time span is owned here rather than inside the chart, so the whole card
   * (compact preview and full-screen advanced view) shares one window and the fetched
   * history always matches it. `historyParamsFor` turns the choice into yfinance params.
   *
   * A caller-supplied `range` wins; otherwise the chart opens on a window sized to the
   * opinion window it is given (`defaultRangeForWindow`), which is "3M" on an empty page.
   * The window default is applied only until the user picks a range themselves.
   */
  const [rangeState, setRangeState] = useState<{ value: PriceRange; custom: DateRange }>(
    () => ({ value: requestedRange ?? "3M", custom: {} }),
  );
  const [rangeOpen, setRangeOpen] = useState(false);
  const userPickedRange = useRef(false);
  const earliestOpinion = opinions.reduce<string | undefined>(
    (earliest, point) => (point.date && (!earliest || point.date < earliest) ? point.date : earliest),
    undefined,
  );
  useEffect(() => {
    if (requestedRange) setRangeState(previous => (previous.value === requestedRange ? previous : { ...previous, value: requestedRange }));
  }, [requestedRange]);
  useEffect(() => {
    // Opinions arrive after mount; seed the window-sized default only while untouched.
    if (requestedRange || userPickedRange.current || earliestOpinion === undefined) return;
    const seeded = defaultRangeForWindow(earliestOpinion);
    setRangeState(previous => (previous.value === seeded ? previous : { ...previous, value: seeded }));
  }, [requestedRange, earliestOpinion]);

  const range = rangeState.value;
  const customFrom = rangeState.custom.from;
  const customTo = rangeState.custom.to;
  const params = useMemo(
    () => historyParamsFor(range, {
      customFrom: customFrom ? isoDay(customFrom) : undefined,
      customTo: customTo ? isoDay(customTo) : undefined,
    }),
    [range, customFrom, customTo],
  );

  const selectRange = useCallback((next: PriceRange) => {
    userPickedRange.current = true;
    setRangeState(previous => ({ ...previous, value: next }));
    // Choosing 自定义 opens the date pickers; a fixed range closes them.
    setRangeOpen(next === "CUSTOM");
    onRangeChange?.(next);
  }, [onRangeChange]);
  const rangeOptions = useMemo<{ value: PriceRange; label: string }[]>(() => [
    ...priceRanges.map(value => ({ value, label: t(`youtubeOpinions.advancedRange.${value}`) })),
    { value: "CUSTOM", label: t("youtubeOpinions.customRange") },
  ], [t]);
  // Custom windows label themselves with their dates; an unpicked one keeps the 自定义 name.
  const rangeLabel = rangeLabelFor(range, {
    customFrom,
    customTo,
    fallback: t(range === "CUSTOM" ? "youtubeOpinions.customRange" : `youtubeOpinions.advancedRange.${range}`),
  });
  /** Pickers stay open until both ends are chosen, so the graph never loads a half window. */
  const showCustomPicker = range === "CUSTOM" && (rangeOpen || !customFrom || !customTo);
  const commitCustomRange = useCallback((next: DateRange | undefined) => {
    const from = next?.from;
    // A cleared picker falls back to the previous window instead of an empty chart.
    if (!from) return;
    userPickedRange.current = true;
    setRangeState(previous => ({ ...previous, value: "CUSTOM", custom: { from, ...(next?.to ? { to: next.to } : {}) } }));
    onRangeChange?.("CUSTOM");
    if (next?.to) setRangeOpen(false);
  }, [onRangeChange]);
  useEffect(() => {
    setHistory([]);
    setTechnicalFocus(DEFAULT_TECHNICAL_FOCUS);
    setAdvancedOpen(false);
  }, [symbol]);


  function setDrawings(next: Drawing[], recordFrom: Drawing[] | null = drawings) {
    if (recordFrom) setHistory((previous) => [...previous.slice(-49), recordFrom]);
    storeDrawings(next);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(history.slice(0, -1));
    storeDrawings(previous);
  }

  const shared = {
    symbol,
    params: historicalSnapshot ? { ...params, interval: historicalSnapshot.payload.interval } : params,
    events,
    drawings: [...manualDrawings, ...(hiddenDrawings ? [] : aiOverrides || aiDrawings)],
    setDrawings: (next: Drawing[], recordFrom?: Drawing[] | null) => {
      // Local edits to AI overlays never mutate the saved analysis snapshot.
      setAiOverrides(next.filter(item => item.source === "ai"));
      setDrawings(next.filter(item => item.source !== "ai"), recordFrom?.filter(item => item.source !== "ai"));
    },
    undo,
    canUndo: history.length > 0,
    syncStatus,
    formatDate,
    t,
    onAnalysisChange: analysisChanged,
    onDrawingsChange: drawingsChanged,
    savedDrawings: selectedDrawings,
    drawingsHidden: hiddenDrawings,
    onDrawingVisibilityChange: setHiddenDrawings,
    aiBusy: analysisBusy,
    aiJobs,
    selectedModel,
    onModelChange: setSelectedModel,
    savedAnalysis: selectedAnalysis,
    snapshotBars: historicalSnapshot?.bars,
    /**
     * The graph's own range bar. These live here (not inside ChartView) so the fetched
     * history always matches what the bar shows; ChartView renders the bar and calls back.
     */
    range,
    onRangeChange: selectRange,
    rangeOpen: showCustomPicker,
    onRangeOpenChange: (open: boolean) => (open ? selectRange("CUSTOM") : setRangeOpen(false)),
    rangeOptions,
    rangeLabel,
    technicalFocus,
    drawingFocus,
    focusControls: <Tabs defaultValue="analysis" className="mt-4">
      <TabsList>
        <TabsTrigger value="analysis">{t("youtubeOpinions.ai.focus.title")}</TabsTrigger>
        <TabsTrigger value="drawings">{t("youtubeOpinions.ai.focus.drawingTitle")}</TabsTrigger>
      </TabsList>
      <TabsContent value="analysis" className="mt-4">
        <TechnicalFocusSelector inline value={technicalFocus} onChange={setTechnicalFocus} disabled={analysisBusy} t={t} />
      </TabsContent>
      <TabsContent value="drawings" className="mt-4">
        <TechnicalFocusSelector inline drawings value={drawingFocus} onChange={setDrawingFocus} disabled={analysisBusy} t={t} />
        <DrawingVersionSelector history={drawingHistory} hidden={hiddenDrawings} disabled={analysisBusy} />
      </TabsContent>
    </Tabs>,
  };

  return (
    <>
      <ChartView mode="compact" compactLayout={layout} resultsContainer={resultsContainer} generationRequest={generationRequest} drawingRequest={drawingRequest} {...shared} onOpenAdvanced={() => {
        advancedTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setAdvancedOpen(true);
      }} />
      {/* 自定义 renders here, beside the graph's range bar, rather than in a nested dialog:
          the full-screen advanced view already uses one dialog and stacking them traps focus. */}
      {showCustomPicker && (
        <div className="mt-3 rounded-2xl border border-border bg-muted/20 p-3 sm:p-4" role="group" aria-label={t("youtubeOpinions.customRange")}>
          <DateRangePicker dateRange={rangeState.custom} onDateRangeChange={commitCustomRange} />
        </div>
      )}
      {layout === "workspace" ? (
        resultsContainer && createPortal(<div className="order-last mt-6 min-w-0 border-t border-border pt-1 [&>details]:mt-0 [&>details]:min-w-0 [&>details]:border-0 [&>details]:py-3">
          <AnalysisHistory history={analysisHistory} />
          {selectedHistory.selected && <SavedAnalysisData key={selectedHistory.selected.id} version={selectedHistory.selected} />}
        </div>, resultsContainer)
      ) : resultsContainer ? createPortal(<div className="order-last mt-6 min-w-0 border-t border-border pt-4 [&>details:first-child]:mt-0 [&>details:first-child]:border-0">
        <AnalysisHistory history={analysisHistory} />
        {selectedHistory.selected && <SavedAnalysisData key={selectedHistory.selected.id} version={selectedHistory.selected} />}
      </div>, resultsContainer) : (<>
        <AnalysisHistory history={analysisHistory} />
        {selectedHistory.selected && <SavedAnalysisData key={selectedHistory.selected.id} version={selectedHistory.selected} />}
      </>)}
      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <DialogContent
          layout="fullscreen"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            advancedTriggerRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (escapeRef.current?.()) event.preventDefault();
          }}
          className="flex flex-col"
        >
          <DialogTitle className="sr-only">{t("youtubeOpinions.advancedChartTitle", { symbol })}</DialogTitle>
          <DialogDescription className="sr-only">{t("youtubeOpinions.zoomHint")}</DialogDescription>
          {advancedOpen && <div className="min-h-0 flex-1 overflow-hidden p-3 sm:px-4">
            <ChartView mode="advanced" {...shared} escapeRef={escapeRef} headerActions={
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={t("common.close")} title={t("common.close")}>
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </DialogClose>
            } />
          </div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
