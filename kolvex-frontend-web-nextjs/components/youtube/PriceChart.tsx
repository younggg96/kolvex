"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, subMonths } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getYouTubeStockDetail, type YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import type { PriceHistoryParams } from "@/lib/stockApi";
import { useSyncedDrawings, type Drawing } from "./chartDrawings";
import ChartView from "./chart/ChartView";
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
}: {
  symbol: string;
  range: PriceRange;
  from: string;
  to: string;
  opinions: StrengthPoint[];
  formatDate: (date: string) => string;
  t: Translate;
}) {
  const { drawings, setDrawings: storeDrawings, status: syncStatus } = useSyncedDrawings(symbol);
  const [history, setHistory] = useState<Drawing[][]>([]);
  const [events, setEvents] = useState<YouTubeOpinion[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const escapeRef = useRef<(() => boolean) | null>(null);
  const params = historyParams(range, from, to, opinions[0]?.date);

  useEffect(() => {
    setHistory([]);
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
    params,
    events,
    drawings,
    setDrawings,
    undo,
    canUndo: history.length > 0,
    syncStatus,
    formatDate,
    t,
  };

  return (
    <>
      <ChartView mode="compact" {...shared} onOpenAdvanced={() => setAdvancedOpen(true)} />
      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (escapeRef.current?.()) event.preventDefault();
          }}
          className="left-0 top-0 flex h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-y-auto rounded-none px-3 pb-3 pt-4 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:px-6"
        >
          <DialogTitle className="sr-only">{t("youtubeOpinions.advancedChartTitle", { symbol })}</DialogTitle>
          <DialogDescription className="sr-only">{t("youtubeOpinions.zoomHint")}</DialogDescription>
          {advancedOpen && <ChartView mode="advanced" {...shared} escapeRef={escapeRef} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
