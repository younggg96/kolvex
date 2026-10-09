"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, subMonths } from "date-fns";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { getYouTubeStockDetail, type YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import type { PriceHistoryParams, AiTechnicalAnalysis } from "@/lib/stockApi";
import { useSyncedDrawings, type Drawing } from "./chartDrawings";
import SavedAnalysisData from "@/components/decision/SavedAnalysisData";
import AnalysisHistory, { useStockHistory } from "@/components/decision/AnalysisHistory";
import { analysisDrawings } from "./aiDrawings";
import ChartView from "./chart/ChartView";
import TechnicalFocusSelector from "./chart/TechnicalFocusSelector";
import { DEFAULT_TECHNICAL_FOCUS, DEFAULT_DRAWING_FOCUS, type TechnicalFocus } from "@/lib/technicalFocus";
import type { StrengthPoint } from "./StrengthChart";

type Translate = (key: string, params?: Record<string, string>) => string;
export type PriceRange = "1m" | "3m" | "6m" | "1y" | "all" | "custom";

function day(value: string) {
  const [year, month, date] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, (month || 1) - 1, date || 1);
}

function iso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

/** yfinance treats `end` as exclusive, so custom windows add a day. */
function historyParams(range: PriceRange, from: string, to: string, earliest?: string): PriceHistoryParams {
  const today = new Date();
  const preset: Record<string, string> = { "1m": "1mo", "3m": "3mo", "6m": "6mo", "1y": "1y" };
  if (preset[range]) return { period: preset[range], interval: "1d" };
  if (range === "custom") {
    const end = to ? day(to) : today;
    const start = from ? day(from) : subMonths(end, 3);
    const weekly = differenceInCalendarDays(end, start) > 400;
    return { start: iso(start), end: iso(addDays(end, 1)), interval: weekly ? "1wk" : "1d" };
  }
  if (!earliest) return { period: "6mo", interval: "1d" };
  const span = differenceInCalendarDays(today, day(earliest));
  if (span <= 150) return { period: "6mo", interval: "1d" };
  if (span <= 330) return { period: "1y", interval: "1d" };
  return {
    start: iso(subMonths(day(earliest), 1)),
    end: iso(addDays(today, 1)),
    interval: span > 400 ? "1wk" : "1d",
  };
}

/**
 * Price chart for the opinion window, plus a full-screen advanced chart. Both share the
 * creator calls, the drawings synced per user and ticker, and one undo history.
 */
export default function PriceChart({
  symbol,
  range,
  from,
  to,
  opinions,
  formatDate,
  t,
  onAnalysisChange,
  generationRequest = 0,
  drawingRequest = 0,
  onAnalysisBusy,
}: {
  symbol: string;
  range: PriceRange;
  from: string;
  to: string;
  opinions: StrengthPoint[];
  formatDate: (date: string) => string;
  t: Translate;
  onAnalysisChange?: (result: AiTechnicalAnalysis | null) => void;
  generationRequest?: number;
  drawingRequest?: number;
  onAnalysisBusy?: (busy: boolean) => void;
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
  const [compactBusy, setCompactBusy] = useState(false);
  const [advancedBusy, setAdvancedBusy] = useState(false);
  const analysisBusy = compactBusy || advancedBusy;
  useEffect(() => { onAnalysisBusy?.(analysisBusy); }, [analysisBusy, onAnalysisBusy]);
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
  const selectedDrawings = useMemo(() => drawingVersions.selected && !hiddenDrawings
    ? { ...drawingVersions.selected.payload, version_id: drawingVersions.selected.id } : null, [drawingVersions.selected, hiddenDrawings]);
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
  const selectedHistory = viewingHistory === "drawings" ? drawingVersions : versions;
  const historicalSnapshot = selectedHistory.selected?.id !== selectedHistory.current?.id ? selectedHistory.selected : null;
  const selectAnalysis = versions.select;
  const selectDrawings = drawingVersions.select;
  const analysisHistory = { ...versions, select: async (item: typeof versions.selected) => { await selectAnalysis(item); setViewingHistory("analysis"); } };
  const drawingHistory = { ...drawingVersions, select: async (item: typeof drawingVersions.selected) => { await selectDrawings(item); setViewingHistory("drawings"); } };
  const [history, setHistory] = useState<Drawing[][]>([]);
  const [events, setEvents] = useState<YouTubeOpinion[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  useEffect(() => { if (!advancedOpen) setAdvancedBusy(false); }, [advancedOpen]);
  const escapeRef = useRef<(() => boolean) | null>(null);
  const advancedTriggerRef = useRef<HTMLElement | null>(null);
  const params = historyParams(range, from, to, opinions[0]?.date);

  useEffect(() => {
    setHistory([]);
    setTechnicalFocus(DEFAULT_TECHNICAL_FOCUS);
    setAdvancedOpen(false);
  }, [symbol]);

  useEffect(() => {
    const controller = new AbortController();
    setEvents([]);
    getYouTubeStockDetail(symbol, { date_from: from || undefined, date_to: to || undefined }, controller.signal)
      .then((detail) => setEvents(detail.opinions || []))
      .catch((reason) => {
        if (!controller.signal.aborted) console.error("Failed to load opinion markers:", reason);
      });
    return () => controller.abort();
  }, [symbol, from, to]);

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
    aiBusy: analysisBusy,
    savedAnalysis: selectedAnalysis,
    snapshotBars: historicalSnapshot?.bars,
    technicalFocus,
    drawingFocus,
    focusControls: <>
      <TechnicalFocusSelector value={technicalFocus} onChange={setTechnicalFocus} disabled={analysisBusy} t={t} />
      <TechnicalFocusSelector drawings value={drawingFocus} onChange={setDrawingFocus} disabled={analysisBusy} t={t} />
    </>,
  };

  return (
    <>
      <ChartView mode="compact" onAnalysisBusy={setCompactBusy} generationRequest={generationRequest} drawingRequest={drawingRequest} {...shared} onOpenAdvanced={() => {
        advancedTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setAdvancedOpen(true);
      }} />
      <AnalysisHistory history={analysisHistory} />
      <AnalysisHistory history={drawingHistory} drawings />
      {selectedHistory.selected && <SavedAnalysisData key={selectedHistory.selected.id} version={selectedHistory.selected} />}
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
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-1.5">
            <DialogTitle>{t("youtubeOpinions.advancedChartTitle", { symbol })}</DialogTitle>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={t("common.close")}>
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DialogClose>
          </header>
          <DialogDescription className="sr-only">{t("youtubeOpinions.zoomHint")}</DialogDescription>
          {advancedOpen && <div className="min-h-0 flex-1 overflow-hidden p-3 sm:px-4">
            <ChartView mode="advanced" onAnalysisBusy={setAdvancedBusy} {...shared} escapeRef={escapeRef} />
          </div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
