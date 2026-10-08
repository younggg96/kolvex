"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { addDays, differenceInCalendarDays, format, subMonths } from "date-fns";
import {
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  GanttChart,
  Loader2,
  Magnet,
  Minus,
  MousePointer2,
  MoveUpRight,
  RectangleHorizontal,
  Ruler,
  Slash,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, proxyImageUrl } from "@/lib/utils";
import { getYouTubeStockDetail, type YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import {
  formatChangePercent,
  formatPrice,
  formatVolume,
  getStockHistory,
  type PriceBar,
  type PriceHistoryParams,
} from "@/lib/stockApi";
import ChartDrawingLayer from "./ChartDrawingLayer";
import {
  drawingColors,
  newDrawingId,
  useSyncedDrawings,
  type Anchor,
  type Drawing,
  type DrawingTool,
  type SyncStatus,
} from "./chartDrawings";
import { toneStroke, toneText, type StrengthTone } from "./strength";
import type { StrengthPoint } from "./StrengthChart";

type Translate = (key: string, params?: Record<string, string>) => string;
export type PriceRange = "1m" | "3m" | "6m" | "1y" | "all" | "custom";

const WIDTH = 1000;
const HEIGHT = 200;
const PAD = 10;
const PRICE_BOTTOM = HEIGHT * 0.78;
const VOLUME_TOP = HEIGHT * 0.84;
const SNAP_PX = 12;
const CHART_HEIGHT = "h-[220px] sm:h-[280px]";

const tools: Array<{ value: DrawingTool; icon: ComponentType<{ className?: string }>; label: string }> = [
  { value: "cursor", icon: MousePointer2, label: "toolCursor" },
  { value: "trend", icon: Slash, label: "toolTrend" },
  { value: "ray", icon: MoveUpRight, label: "toolRay" },
  { value: "hline", icon: Minus, label: "toolHline" },
  { value: "rect", icon: RectangleHorizontal, label: "toolRect" },
  { value: "fib", icon: GanttChart, label: "toolFib" },
  { value: "measure", icon: Ruler, label: "toolMeasure" },
];

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

type Draft = { drawing: Drawing; start: { x: number; y: number }; awaitingSecond: boolean };
type Drag = { id: string; handle: number | "body"; origin: Anchor; before: Drawing[]; moved: boolean };
type Calls = { bullish: YouTubeOpinion[]; bearish: YouTubeOpinion[]; other: YouTubeOpinion[] };

const callTone: Record<keyof Calls, StrengthTone> = { bullish: "positive", bearish: "negative", other: "neutral" };
const sentimentTone = (sentiment: YouTubeOpinion["sentiment"]): StrengthTone =>
  sentiment === "bullish" ? "positive" : sentiment === "bearish" ? "negative" : "neutral";
const syncIcons: Record<SyncStatus, ComponentType<{ className?: string }>> = {
  loading: Loader2,
  syncing: Loader2,
  synced: Cloud,
  local: CloudOff,
  offline: CloudOff,
};

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

/**
 * Candlestick price chart for the opinion window: volume, each creator's bullish (▲) or
 * bearish (▼) call on its trading day, and drawing tools synced per user and ticker.
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
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bars, setBars] = useState<PriceBar[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);
  const [tool, setTool] = useState<DrawingTool>("cursor");
  const [color, setColor] = useState(drawingColors[0]);
  const [magnet, setMagnet] = useState(true);
  const { drawings, setDrawings: storeDrawings, status: syncStatus } = useSyncedDrawings(symbol);
  const [history, setHistory] = useState<Drawing[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [events, setEvents] = useState<YouTubeOpinion[]>([]);
  const [showCalls, setShowCalls] = useState(true);
  const drag = useRef<Drag | null>(null);
  const earliest = opinions[0]?.date;
  const params = historyParams(range, from, to, earliest);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    const controller = new AbortController();
    setBars(null);
    setError(false);
    setActive(null);
    getStockHistory(symbol, JSON.parse(paramsKey), controller.signal)
      .then(setBars)
      .catch((reason) => {
        if (!controller.signal.aborted) {
          console.error("Failed to load price history:", reason);
          setError(true);
        }
      });
    return () => controller.abort();
  }, [symbol, paramsKey, attempt]);

  useEffect(() => {
    setHistory([]);
    setSelectedId(null);
    setDraft(null);
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

  useEffect(() => {
    if (!box) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);

  const count = bars?.length ?? 0;
  const scale = useMemo(() => {
    if (!bars?.length) return null;
    const low = Math.min(...bars.map((bar) => bar.low));
    const high = Math.max(...bars.map((bar) => bar.high));
    const spread = high - low || Math.abs(high) * 0.01 || 1;
    const maxVolume = Math.max(...bars.map((bar) => bar.volume || 0), 1);
    return {
      high,
      spread,
      y: (value: number) => PAD + ((high - value) / spread) * (PRICE_BOTTOM - PAD),
      volume: (value: number | null) => ((value || 0) / maxVolume) * (HEIGHT - VOLUME_TOP),
    };
  }, [bars]);

  const times = useMemo(() => (bars || []).map((bar) => Date.parse(bar.date)), [bars]);

  /**
   * Daily bars: a call made on a weekend or holiday lands on the next session.
   * Weekly bars: it lands on the week that contains it.
   */
  const calls = useMemo(() => {
    const byBar = new Map<number, Calls>();
    if (!bars?.length) return byBar;
    const weekly = params.interval === "1wk";
    const starts = bars.map((bar) => bar.date.slice(0, 10));
    for (const opinion of events) {
      const date = opinion.opinion_date?.slice(0, 10);
      if (!date || date < starts[0]) {
        if (!date || differenceInCalendarDays(day(starts[0]), day(date)) > (weekly ? 0 : 4)) continue;
      }
      let index = weekly
        ? starts.findLastIndex((start) => start <= date)
        : starts.findIndex((start) => start >= date);
      if (index === -1) index = weekly ? 0 : starts.length - 1;
      if (!weekly && index === starts.length - 1 && date > starts[index] && differenceInCalendarDays(day(date), day(starts[index])) > 4) continue;
      const entry = byBar.get(index) || { bullish: [], bearish: [], other: [] };
      const key = opinion.sentiment === "bullish" ? "bullish" : opinion.sentiment === "bearish" ? "bearish" : "other";
      entry[key].push(opinion);
      byBar.set(index, entry);
    }
    return byBar;
  }, [bars, events, params.interval]);

  if (error) {
    return (
      <div className={cn("flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground", CHART_HEIGHT)} role="alert">
        <span>{t("youtubeOpinions.priceUnavailable")}</span>
        <Button size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }
  if (!bars) {
    return (
      <div role="status" aria-label={t("common.loadingStatus")}>
        <Skeleton className="h-4 w-48" />
        <Skeleton className={cn("mt-3 w-full", CHART_HEIGHT)} />
      </div>
    );
  }
  if (!count || !scale) {
    return (
      <p className={cn("flex items-center justify-center text-sm text-muted-foreground", CHART_HEIGHT)}>
        {t("youtubeOpinions.priceEmpty")}
      </p>
    );
  }

  const slot = WIDTH / count;
  const x = (index: number) => slot * index + slot / 2;
  const bodyWidth = Math.max(slot * 0.62, 1);
  const first = bars[0];
  const last = bars[count - 1];
  const activeBar = active === null ? null : bars[active];
  const rangeChange = first.close ? ((last.close - first.close) / first.close) * 100 : 0;
  const barTone = (bar: PriceBar) => (bar.close >= bar.open ? "positive" : "negative");
  const activeCalls = active === null || !showCalls ? null : calls.get(active) || null;
  const activeEvents = activeCalls ? [...activeCalls.bullish, ...activeCalls.bearish, ...activeCalls.other] : [];
  const SyncIcon = syncIcons[syncStatus];
  const drawing = tool !== "cursor";
  const selected = drawings.find((item) => item.id === selectedId) || null;

  const msPerBar = count > 1 ? (times[count - 1] - times[0]) / (count - 1) : 86_400_000;
  const indexAt = (time: number) => {
    if (time <= times[0]) return (time - times[0]) / msPerBar;
    if (time >= times[count - 1]) return count - 1 + (time - times[count - 1]) / msPerBar;
    let index = 0;
    while (times[index + 1] <= time) index++;
    return index + (time - times[index]) / (times[index + 1] - times[index]);
  };
  const timeAt = (index: number) => {
    if (index <= 0 || count < 2) return times[0] + index * msPerBar;
    if (index >= count - 1) return times[count - 1] + (index - count + 1) * msPerBar;
    const base = Math.floor(index);
    return times[base] + (index - base) * (times[base + 1] - times[base]);
  };
  const pxX = (index: number) => (x(index) / WIDTH) * size.width;
  const pxY = (price: number) => (scale.y(price) / HEIGHT) * size.height;
  const priceAtPx = (y: number) =>
    scale.high - (((y / size.height) * HEIGHT - PAD) / (PRICE_BOTTOM - PAD)) * scale.spread;
  const toPx = (anchor: Anchor) => ({ x: pxX(indexAt(anchor.time)), y: pxY(anchor.price) });
  const barsBetween = (a: Anchor, b: Anchor) => Math.round(indexAt(b.time) - indexAt(a.time));

  function locate(event: PointerEvent<HTMLDivElement>, snap = magnet) {
    const rect = box!.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let index = ((px / rect.width) * WIDTH - slot / 2) / slot;
    let price = priceAtPx(py);
    if (snap) {
      index = Math.min(Math.max(Math.round(index), 0), count - 1);
      const bar = bars![index];
      const nearest = [bar.open, bar.high, bar.low, bar.close].reduce((best, value) =>
        Math.abs(pxY(value) - py) < Math.abs(pxY(best) - py) ? value : best,
      );
      if (Math.abs(pxY(nearest) - py) <= SNAP_PX) price = nearest;
    }
    return { anchor: { time: timeAt(index), price }, px, py };
  }

  function setDrawings(next: Drawing[], recordFrom: Drawing[] | null = drawings) {
    if (recordFrom) setHistory((previous) => [...previous.slice(-49), recordFrom]);
    storeDrawings(next);
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

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory(history.slice(0, -1));
    storeDrawings(previous);
    setSelectedId(null);
  }

  function pickColor(value: string) {
    setColor(value);
    if (selected) setDrawings(drawings.map((item) => (item.id === selected.id ? { ...item, color: value } : item)));
  }

  function scrubTo(px: number) {
    const ratio = Math.min(Math.max(px / size.width, 0), 0.9999);
    setActive(Math.floor(ratio * count));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const { anchor, px, py } = locate(event);
    scrubTo(px);
    if (drawing) {
      event.currentTarget.setPointerCapture(event.pointerId);
      const type = tool as Drawing["type"];
      if (type === "hline") {
        commit({ id: newDrawingId(), type, points: [anchor], color });
      } else if (draft?.awaitingSecond) {
        commit({ ...draft.drawing, points: [draft.drawing.points[0], anchor] });
      } else {
        setDraft({
          drawing: { id: newDrawingId(), type, points: [anchor, anchor], color },
          start: { x: px, y: py },
          awaitingSecond: false,
        });
      }
      return;
    }
    const target = (event.target as Element).closest<SVGElement>("[data-drawing]");
    if (target?.dataset.drawing) {
      event.currentTarget.setPointerCapture(event.pointerId);
      const handle = target.dataset.handle;
      setSelectedId(target.dataset.drawing);
      drag.current = {
        id: target.dataset.drawing,
        handle: handle === undefined ? "body" : Number(handle),
        origin: locate(event, false).anchor,
        before: drawings,
        moved: false,
      };
      return;
    }
    setSelectedId(null);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const { anchor, px, py } = locate(event);
    scrubTo(px);
    setHoverY(py);
    const current = drag.current;
    if (current) {
      const free = locate(event, false).anchor;
      const shift = indexAt(free.time) - indexAt(current.origin.time);
      const lift = free.price - current.origin.price;
      const next = current.before.map((item) => {
        if (item.id !== current.id) return item;
        const points =
          current.handle === "body"
            ? item.points.map((point) => ({ time: timeAt(indexAt(point.time) + shift), price: point.price + lift }))
            : item.points.map((point, index) => (index === current.handle ? anchor : point));
        return { ...item, points };
      });
      current.moved = true;
      storeDrawings(next);
      return;
    }
    if (draft) {
      setDraft({ ...draft, drawing: { ...draft.drawing, points: [draft.drawing.points[0], anchor] } });
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (current) {
      if (current.moved) setHistory((previous) => [...previous.slice(-49), current.before]);
      drag.current = null;
      return;
    }
    if (draft && !draft.awaitingSecond) {
      const { px, py } = locate(event);
      if (Math.hypot(px - draft.start.x, py - draft.start.y) > 5) commit(draft.drawing);
      else setDraft({ ...draft, awaitingSecond: true });
    }
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") undo();
    else if ((event.key === "Delete" || event.key === "Backspace") && selectedId) removeSelected();
    else if (event.key === "Escape") {
      if (draft) setDraft(null);
      else if (drawing) setTool("cursor");
      else if (selectedId) setSelectedId(null);
      else setActive(null);
    } else if (event.key === "ArrowLeft") setActive(Math.max((active ?? count - 1) - 1, 0));
    else if (event.key === "ArrowRight") setActive(Math.min((active ?? count - 1) + 1, count - 1));
    else return;
    event.preventDefault();
  }

  const stat = (label: string, value: string) => (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span> <span className="font-medium text-foreground">{value}</span>
    </span>
  );
  const iconButton = (isActive: boolean) =>
    cn(
      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40",
      isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );
  const showCrosshair = hoverY !== null && hoverY <= (PRICE_BOTTOM / HEIGHT) * size.height;

  return (
    <div className="min-w-0">
      <div className="flex min-h-5 flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] tabular-nums" aria-live="polite">
        {activeBar ? (
          <>
            <span className="font-medium text-foreground">{formatDate(activeBar.date.slice(0, 10))}</span>
            {stat(t("youtubeOpinions.priceOpen"), formatPrice(activeBar.open))}
            {stat(t("youtubeOpinions.priceHigh"), formatPrice(activeBar.high))}
            {stat(t("youtubeOpinions.priceLow"), formatPrice(activeBar.low))}
            {stat(t("youtubeOpinions.priceClose"), formatPrice(activeBar.close))}
            {activeBar.volume ? stat(t("youtubeOpinions.priceVolume"), formatVolume(activeBar.volume)) : null}
            {activeCalls &&
              (["bullish", "bearish", "other"] as const).map((key) =>
                activeCalls[key].length ? (
                  <span key={key} className={cn("whitespace-nowrap font-medium", toneText[callTone[key]])}>
                    {t(`youtubeOpinions.callCount.${key}`, { count: String(activeCalls[key].length) })}
                  </span>
                ) : null,
              )}
          </>
        ) : (
          <>
            <span className="text-base font-semibold text-foreground">{formatPrice(last.close)}</span>
            <span className={cn("font-medium", rangeChange >= 0 ? "text-positive" : "text-negative")}>
              {formatChangePercent(rangeChange)}
            </span>
            <span className="text-muted-foreground">{t("youtubeOpinions.priceRangeChange")}</span>
          </>
        )}
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
          {drawingColors.map((value) => {
            const current = (selected?.color ?? color) === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={current}
                aria-label={`${t("youtubeOpinions.drawColor")} ${drawingColors.indexOf(value) + 1}`}
                onClick={() => pickColor(value)}
                className="inline-flex h-8 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span
                  className={cn("h-3.5 w-3.5 rounded-full ring-offset-2 ring-offset-background", current && "ring-2 ring-foreground/60")}
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
        <div className="ml-auto flex shrink-0 items-center gap-1">
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
            disabled={!history.length}
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

      <div
        ref={setBox}
        role="slider"
        tabIndex={0}
        aria-label={t("youtubeOpinions.priceChartLabel")}
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={active ?? count - 1}
        aria-valuetext={activeBar ? `${formatDate(activeBar.date.slice(0, 10))} ${formatPrice(activeBar.close)}` : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDraft(null);
        }}
        onPointerLeave={() => {
          if (drag.current) return;
          setActive(null);
          setHoverY(null);
        }}
        onKeyDown={handleKey}
        onBlur={() => setActive(null)}
        className={cn(
          "relative mt-3 cursor-crosshair select-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background",
          CHART_HEIGHT,
          drawing || selectedId ? "touch-none" : "touch-pan-y",
        )}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <line
            x1={0}
            x2={WIDTH}
            y1={scale.y(first.close)}
            y2={scale.y(first.close)}
            stroke="rgb(var(--foreground) / 0.18)"
            strokeDasharray="2 5"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          {bars.map((bar, index) => {
            const fill = toneStroke[barTone(bar)];
            const top = scale.y(Math.max(bar.open, bar.close));
            const bottom = scale.y(Math.min(bar.open, bar.close));
            const volume = scale.volume(bar.volume);
            return (
              <g key={bar.date}>
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1={scale.y(bar.high)}
                  y2={scale.y(bar.low)}
                  stroke={fill}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x={x(index) - bodyWidth / 2}
                  y={top}
                  width={bodyWidth}
                  height={Math.max(bottom - top, 0.8)}
                  fill={fill}
                />
                <rect
                  x={x(index) - bodyWidth / 2}
                  y={HEIGHT - volume}
                  width={bodyWidth}
                  height={volume}
                  fill={fill}
                  opacity={0.28}
                />
              </g>
            );
          })}
        </svg>
        {showCalls &&
          size.width > 0 &&
          Array.from(calls.entries()).map(([index, entry]) => {
            const bar = bars[index];
            const left = pxX(index);
            const below = pxY(bar.low) + 4;
            return (
              <span key={index}>
                {entry.bearish.length > 0 && (
                  <CallMarker direction="down" count={entry.bearish.length} x={left} y={pxY(bar.high) - 4} />
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
        <ChartDrawingLayer
          width={size.width}
          height={size.height}
          drawings={drawings}
          draft={draft?.drawing ?? null}
          selectedId={selectedId}
          interactive={!drawing}
          toPx={toPx}
          barsBetween={barsBetween}
          t={t}
        />
        {activeBar && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-foreground/25"
            style={{ left: `${(x(active!) / WIDTH) * 100}%` }}
          />
        )}
        {showCrosshair && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 h-px border-t border-dashed border-foreground/25"
              style={{ top: hoverY! }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 -translate-y-1/2 rounded bg-foreground px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-background"
              style={{ top: hoverY! }}
            >
              {formatPrice(priceAtPx(hoverY!))}
            </span>
          </>
        )}
        {activeEvents.length > 0 && !drawing && !drag.current && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1 z-10 w-64 max-w-[calc(100%-1rem)] rounded-xl border border-border bg-background/95 p-2.5 text-xs shadow-lg backdrop-blur"
            style={
              pxX(active!) > size.width / 2
                ? { right: Math.max(size.width - pxX(active!) + 12, 0) }
                : { left: Math.min(pxX(active!) + 12, Math.max(size.width - 256, 0)) }
            }
          >
            <ul className="space-y-2">
              {activeEvents.slice(0, 4).map((opinion) => (
                <li key={opinion.id} className="flex min-w-0 gap-2">
                  <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground">
                    {(opinion.channel_title || opinion.channel_id).slice(0, 1).toUpperCase()}
                    {opinion.channel_avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={proxyImageUrl(opinion.channel_avatar_url)}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(event) => (event.currentTarget.style.display = "none")}
                      />
                    )}
                  </span>
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
                {t("youtubeOpinions.moreCalls", { count: String(activeEvents.length - 4) })}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
        <span>{formatDate(first.date.slice(0, 10))}</span>
        {drawing ? (
          <span className="hidden text-center sm:inline">
            {t(tool === "hline" ? "youtubeOpinions.drawHintSingle" : "youtubeOpinions.drawHint")}
          </span>
        ) : (
          showCalls &&
          calls.size > 0 && (
            <span className="hidden items-center gap-2 sm:inline-flex">
              <span className="text-positive" aria-hidden="true">▲</span>
              {t("youtubeOpinions.bullish")}
              <span className="text-negative" aria-hidden="true">▼</span>
              {t("youtubeOpinions.bearish")}
              <span>{t("youtubeOpinions.opinionMarkers")}</span>
            </span>
          )
        )}
        {count > 1 && <span>{formatDate(last.date.slice(0, 10))}</span>}
      </div>
    </div>
  );
}
