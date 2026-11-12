// The Web's fullscreen chart for phones, ported from components/youtube/chart/ChartView.tsx
// (advanced plot), ChartDrawingLayer.tsx (shapes, labels and axis tags) and OscillatorPane.tsx.
import { useMemo, useRef, useState, type ReactNode } from "react";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Pressable, View, type GestureResponderEvent } from "react-native";
import { SymbolView } from "expo-symbols";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { usePreferences } from "../state/Preferences";
import type {
  Drawing,
  DrawingGroup,
  DrawingTool,
  PriceBar,
} from "../lib/technicalTypes";
import {
  computeIndicators,
  indicatorMeta,
  indicatorOrder,
  kdj,
  macd,
  rsi,
  vwap,
  type IndicatorKey,
  type Series,
} from "../lib/technicalIndicators";
import type { KlineForecast } from "../lib/stockExtrasApi";
import { callMarks, CallMarks, type CallEvent } from "./CandleGraph";
import { Copy } from "./UI";

export const AXIS = 56;
const TIME_AXIS = 26;
const TOP_PAD = 28;
const FONT_SIZE = 11;
const LINE_HEIGHT = 13;
const TAG_HEIGHT = 16;
const SNAP_PX = 12;
const HIT_PX = 14;
/** Below this plot width the Web treats the chart as a phone: fewer layers, shorter labels. */
const COMPACT_WIDTH = 480;
const KEY_FIB = [0, 0.382, 0.5, 0.618, 1];
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const LEGEND_PREVIEW = 2;

export type Oscillator = "kdj" | "macd" | "rsi";
export const oscillatorLabels: Record<Oscillator, string> = {
  kdj: "KDJ (9, 3, 3)",
  macd: "MACD (12, 26, 9)",
  rsi: "RSI (14)",
};
/** Visible window in bar indices, as the Web's GraphView: [start, end). */
export type ChartWindowView = { start: number; end: number };
type Point = { x: number; y: number };
type Anchor = { time: number; price: number };

const tiers: Record<
  DrawingGroup,
  { width: number; opacity: number; dash?: string }
> = {
  plan: { width: 1.5, opacity: 1 },
  levels: { width: 1, opacity: 0.85 },
  trend: { width: 1, opacity: 0.7, dash: "5,3" },
  fib: { width: 0.75, opacity: 0.45, dash: "3,3" },
  zones: { width: 0.75, opacity: 0.6, dash: "2,3" },
  pattern: { width: 1, opacity: 0.5 },
};

export const formatPrice = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fixed = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function textWidth(text: string) {
  let width = 0;
  for (const char of text)
    width += /[⺀-￯]/.test(char) ? FONT_SIZE : FONT_SIZE * 0.6;
  return width;
}

let drawingSerial = 0;
const newId = () =>
  `mobile-${Date.now().toString(36)}-${(drawingSerial++).toString(36)}`;

/** Turns the Web's CSS colour tokens into concrete colours for react-native-svg. */
export function useChartColors() {
  const t = useTheme();
  return useMemo(() => {
    const level = t.dark ? "rgb(176,148,96)" : "rgb(148,112,48)";
    const resolve = (color: string) => {
      if (color.includes("--chart-level")) return level;
      if (color.includes("--chart-up") || color.includes("positive"))
        return t.chartUp;
      if (color.includes("--chart-down") || color.includes("negative"))
        return t.chartDown;
      if (color.includes("--foreground")) return t.text;
      if (color.includes("--muted-foreground")) return t.secondary;
      const m = color.match(/^rgb\((\d+)\s+(\d+)\s+(\d+)\)$/);
      return m ? `rgb(${m[1]},${m[2]},${m[3]})` : color;
    };
    return { level, resolve };
  }, [t]);
}

/** Time (ms) → fractional bar index, so drawings survive range and interval changes. */
function makeIndexAt(times: number[]) {
  return (time: number) => {
    const n = times.length;
    if (!n) return 0;
    if (n === 1) return 0;
    if (time <= times[0]) {
      const step = times[1] - times[0] || 1;
      return (time - times[0]) / step;
    }
    if (time >= times[n - 1]) {
      const step = times[n - 1] - times[n - 2] || 1;
      return n - 1 + (time - times[n - 1]) / step;
    }
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= time) lo = mid;
      else hi = mid;
    }
    return lo + (time - times[lo]) / (times[hi] - times[lo] || 1);
  };
}
function makeTimeAt(times: number[]) {
  return (index: number) => {
    const n = times.length;
    if (!n) return 0;
    if (n === 1) return times[0];
    const step = n > 1 ? times[n - 1] - times[n - 2] : 86_400_000;
    if (index >= n - 1) return times[n - 1] + (index - (n - 1)) * step;
    if (index <= 0) return times[0] + index * (times[1] - times[0]);
    const lo = Math.floor(index);
    return times[lo] + (index - lo) * (times[lo + 1] - times[lo]);
  };
}

function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const k = length
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length))
    : 0;
  return Math.hypot(p.x - (a.x + k * dx), p.y - (a.y + k * dy));
}

type LabelRequest = {
  key: string;
  drawingId: string;
  x: number;
  y: number;
  anchor: "start" | "end" | "middle";
  text: string;
  color: string;
  priority: number;
  price?: number;
  bold?: boolean;
  nudge?: boolean;
  mergeable?: boolean;
};
type AxisRequest = {
  key: string;
  drawingId: string;
  y: number;
  price: number;
  color: string;
  priority: number;
};
type Box = { x1: number; y1: number; x2: number; y2: number };
const overlaps = (a: Box, b: Box) =>
  a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

/** Greedy placement by priority, exactly as the Web: axis tags first, then in-plot labels. */
function placeLabels(
  labels: LabelRequest[],
  tags: AxisRequest[],
  {
    width,
    height,
    compact,
    lastY,
  }: { width: number; height: number; compact: boolean; lastY?: number },
) {
  const tagBoxes: { y1: number; y2: number }[] = [];
  if (lastY !== undefined)
    tagBoxes.push({
      y1: lastY - TAG_HEIGHT / 2 - 1,
      y2: lastY + TAG_HEIGHT / 2 + 1,
    });
  const placedTags: AxisRequest[] = [];
  const tagged = new Set<string>();
  for (const tag of [...tags].sort((a, b) => b.priority - a.priority)) {
    const box = { y1: tag.y - TAG_HEIGHT / 2, y2: tag.y + TAG_HEIGHT / 2 };
    if (box.y1 < -2 || box.y2 > height + 2) continue;
    if (tagBoxes.some((o) => box.y1 < o.y2 && o.y1 < box.y2)) continue;
    tagBoxes.push(box);
    placedTags.push(tag);
    tagged.add(tag.key);
  }
  const placed: (LabelRequest & { box: Box })[] = [];
  const boxFor = (label: LabelRequest, text: string, y: number): Box => {
    const w = textWidth(text);
    let x1 =
      label.anchor === "start"
        ? label.x
        : label.anchor === "end"
          ? label.x - w
          : label.x - w / 2;
    x1 = Math.min(Math.max(x1, 2), Math.max(width - w - 2, 2));
    return { x1, y1: y - LINE_HEIGHT + 2, x2: x1 + w, y2: y + 2 };
  };
  const anchorX = (label: LabelRequest, box: Box) =>
    label.anchor === "start"
      ? box.x1
      : label.anchor === "end"
        ? box.x2
        : (box.x1 + box.x2) / 2;
  for (const request of [...labels].sort((a, b) => b.priority - a.priority)) {
    const fibRatio = !Number.isNaN(Number(request.text));
    const withPrice =
      request.price !== undefined &&
      !tagged.has(request.key) &&
      !(compact && fibRatio && request.priority < 1000);
    const text = withPrice
      ? `${request.text} ${formatPrice(request.price!)}`
      : request.text;
    const label = { ...request, text };
    for (const dy of label.nudge ? [0, -LINE_HEIGHT, LINE_HEIGHT] : [0]) {
      const y = Math.min(Math.max(label.y + dy, LINE_HEIGHT - 2), height - 3);
      const box = boxFor(label, label.text, y);
      const hit = placed.find((o) => overlaps(box, o.box));
      if (!hit) {
        placed.push({ ...label, y, x: anchorX(label, box), box });
        break;
      }
      if (
        label.mergeable &&
        hit.mergeable &&
        Math.abs(hit.y - y) < LINE_HEIGHT
      ) {
        const merged = `${hit.text} · ${request.text}`;
        const mergedBox = boxFor(hit, merged, hit.y);
        if (!placed.some((o) => o !== hit && overlaps(mergedBox, o.box))) {
          hit.text = merged;
          hit.box = mergedBox;
          hit.x = anchorX(hit, mergedBox);
          break;
        }
      }
    }
  }
  return { placedTags, placedLabels: placed };
}

/** Toggled-off AI layers are skipped; on phones only the levels nearest the last price stay. */
function visibleDrawings(
  drawings: Drawing[],
  selectedId: string | null,
  hidden: ReadonlySet<DrawingGroup>,
  compact: boolean,
  lastPrice: number | undefined,
) {
  const shown = drawings.filter(
    (d) => d.id === selectedId || !d.group || !hidden.has(d.group),
  );
  if (!compact || lastPrice === undefined) return shown;
  let above: Drawing | null = null;
  let below: Drawing | null = null;
  for (const d of shown) {
    if (d.group !== "levels" || !d.points[0]) continue;
    const price = d.points[0].price;
    if (price >= lastPrice && (!above || price < above.points[0].price))
      above = d;
    if (price < lastPrice && (!below || price > below.points[0].price))
      below = d;
  }
  return shown.filter(
    (d) =>
      d.group !== "levels" || d === above || d === below || d.id === selectedId,
  );
}

export function AdvancedChart({
  bars,
  view,
  height,
  intraday,
  autoScale,
  indicators,
  drawings,
  hiddenGroups,
  selectedId,
  onSelectDrawing,
  onDrawingsChange,
  tool,
  color,
  magnet,
  onCommit,
  events,
  showCalls,
  containing,
  active,
  onActive,
  forecast,
  forecastNote,
  onDoubleTap,
  variant = "candles",
  readOnly = false,
}: {
  /** "line" is the Web's preview PriceGraph: a close line over the same drawings and tags. */
  variant?: "candles" | "line";
  /** Drawings show but cannot be selected or moved (the stock page preview). */
  readOnly?: boolean;
  bars: PriceBar[];
  view: ChartWindowView;
  height: number;
  intraday: boolean;
  autoScale: boolean;
  indicators: IndicatorKey[];
  drawings: Drawing[];
  hiddenGroups: ReadonlySet<DrawingGroup>;
  selectedId: string | null;
  onSelectDrawing: (id: string | null) => void;
  /** `recordFrom` is the undo snapshot; null while a drag is still moving. */
  onDrawingsChange: (next: Drawing[], recordFrom?: Drawing[] | null) => void;
  tool: DrawingTool;
  color: string;
  magnet: boolean;
  onCommit: (drawing: Drawing) => void;
  events: readonly CallEvent[];
  showCalls: boolean;
  containing: boolean;
  active: number | null;
  onActive: (index: number | null) => void;
  forecast: KlineForecast | null;
  forecastNote?: ReactNode;
  onDoubleTap: () => void;
}) {
  const t = useTheme();
  const text = useText();
  const { locale } = usePreferences();
  const { level, resolve } = useChartColors();
  const [width, setWidth] = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const [draft, setDraft] = useState<{
    drawing: Drawing;
    start: Point;
    awaitingSecond: boolean;
  } | null>(null);
  const edit = useRef<{
    id: string;
    handle: number | "body";
    origin: Anchor;
    before: Drawing[];
    moved: boolean;
  } | null>(null);
  const touch = useRef<{
    x: number;
    y: number;
    moved: boolean;
    mode: "draw" | "edit" | "tap";
  } | null>(null);
  const lastTap = useRef(0);

  const count = bars.length;
  const times = useMemo(() => bars.map((b) => Date.parse(b.date)), [bars]);
  const indexAt = useMemo(() => makeIndexAt(times), [times]);
  const timeAt = useMemo(() => makeTimeAt(times), [times]);
  const series = useMemo(
    () => computeIndicators(bars, intraday),
    [bars, intraday],
  );
  const firstVisible = Math.max(Math.floor(view.start), 0);
  const lastVisible = Math.min(Math.ceil(view.end), count) - 1;
  const vwapSeries = useMemo(
    () => vwap(bars, intraday, intraday ? 0 : firstVisible),
    [bars, intraday, firstVisible],
  );
  const lines: Record<"vwap" | "ema5" | "ema20" | "ema50" | "ema200", Series> =
    {
      ...series,
      vwap: vwapSeries,
    };
  const forecastBase = useMemo(() => {
    if (!forecast || !count) return -1;
    return bars.findLastIndex(
      (b) => b.date.slice(0, 10) <= forecast.context_end,
    );
  }, [forecast, bars, count]);

  const plotW = Math.max(width - AXIS, 1);
  const plotH = Math.max(height - TIME_AXIS, 1);
  const showVolume = indicators.includes("volume");
  const priceTop = TOP_PAD;
  const priceBottomFull = plotH - 4;
  const volumeH = showVolume ? (priceBottomFull - priceTop) * 0.18 : 0;
  const priceBottom = Math.max(plotH - volumeH - 16, priceTop + 1);
  const slot = plotW / Math.max(view.end - view.start, 1e-6);
  const xOf = (index: number) => (index - view.start + 0.5) * slot;

  const yRange = useMemo(() => {
    if (!count) return { lo: 0, hi: 1, maxVolume: 1 };
    const from = autoScale ? firstVisible : 0;
    const to = autoScale ? lastVisible : count - 1;
    let lo = Infinity;
    let hi = -Infinity;
    let maxVolume = 1;
    for (let i = Math.max(from, 0); i <= Math.min(to, count - 1); i++) {
      lo = Math.min(lo, bars[i].low);
      hi = Math.max(hi, bars[i].high);
      maxVolume = Math.max(maxVolume, bars[i].volume || 0);
    }
    if (forecast && forecastBase >= 0)
      forecast.points.forEach((p, k) => {
        const i = forecastBase + 1 + k;
        if (i >= view.start && i < view.end) {
          lo = Math.min(lo, p.close_p10, p.low);
          hi = Math.max(hi, p.close_p90, p.high);
        }
      });
    if (!Number.isFinite(lo)) return { lo: 0, hi: 1, maxVolume };
    const pad = (hi - lo || hi * 0.01 || 1) * 0.06;
    return { lo: lo - pad, hi: hi + pad, maxVolume };
  }, [
    bars,
    count,
    autoScale,
    firstVisible,
    lastVisible,
    forecast,
    forecastBase,
    view.start,
    view.end,
  ]);
  const yOf = (price: number) =>
    priceTop +
    ((yRange.hi - price) / (yRange.hi - yRange.lo || 1)) *
      (priceBottom - priceTop);
  const priceAt = (y: number) =>
    yRange.hi -
    ((y - priceTop) / (priceBottom - priceTop || 1)) * (yRange.hi - yRange.lo);
  const toPx = (a: Anchor): Point => ({
    x: xOf(indexAt(a.time)),
    y: yOf(a.price),
  });

  const last = bars[count - 1];
  const lastUp = !!last && last.close >= (bars[count - 2]?.close ?? last.open);
  const compact = plotW < COMPACT_WIDTH;
  const visible = visibleDrawings(
    drawings,
    selectedId,
    hiddenGroups,
    compact,
    last?.close,
  );
  const focused =
    selectedId !== null && visible.some((d) => d.id === selectedId);

  // --- drawing layer -----------------------------------------------------------------
  const labels: LabelRequest[] = [];
  const axisTags: AxisRequest[] = [];
  const priorityOf = (d: Drawing) =>
    d.id === selectedId ? 1000 : (d.priority ?? (d.source === "ai" ? 50 : 70));
  const displayColor = (d: Drawing) => {
    if (d.source !== "ai") return resolve(d.color);
    if (d.type === "fib" || d.color.includes("245 158 11")) return level;
    return resolve(d.color);
  };
  const levelLabel = (
    d: Drawing,
    key: string,
    y: number,
    label: string,
    price: number,
    c: string,
    priority: number,
    x = plotW - 4,
    anchor: "start" | "end" = "end",
  ) => {
    if (y < 0 || y > plotH) return;
    axisTags.push({ key, drawingId: d.id, y, price, color: c, priority });
    if (label)
      labels.push({
        key,
        drawingId: d.id,
        x,
        y: y - 4,
        anchor,
        text: text(label),
        price,
        color: c,
        priority,
        mergeable: true,
      });
  };
  const far = (plotW + plotH) * 2;

  function render(d: Drawing, preview: boolean) {
    const id = d.id;
    const c = displayColor(d);
    const pts = d.points.map(toPx);
    const a = pts[0];
    const b = pts[1] ?? a;
    const pa = d.points[0];
    const pb = d.points[1] ?? pa;
    if (!a) return null;
    const selected = id === selectedId;
    const ai = d.source === "ai";
    const tier = d.group ? tiers[d.group] : null;
    const priority = priorityOf(d);
    const stroke = {
      stroke: c,
      strokeWidth: selected ? 1.75 : (tier?.width ?? (ai ? 1 : 1.5)),
      strokeDasharray: selected ? undefined : tier?.dash,
    };
    const caption = (p: Point, anchor: "start" | "end" = "start", dy = -5) => {
      if (!d.label || (compact && ai && !selected)) return;
      labels.push({
        key: id,
        drawingId: id,
        x: p.x,
        y: p.y + dy,
        anchor,
        text: text(d.label),
        color: c,
        priority,
        bold: true,
        nudge: true,
      });
    };
    let body: ReactNode = null;
    switch (d.type) {
      case "polyline":
        caption(pts[pts.length - 1], "end");
        body = (
          <Polyline
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            {...stroke}
          />
        );
        break;
      case "channel": {
        const cpt = pts[2] ?? b;
        const run = b.x - a.x;
        const dy =
          cpt.y - (run ? a.y + ((b.y - a.y) * (cpt.x - a.x)) / run : a.y);
        const k = far / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
        const end = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        caption({ x: a.x, y: a.y + dy }, "start", dy < 0 ? -5 : 12);
        body = (
          <>
            <Polygon
              points={[
                a,
                end,
                { x: end.x, y: end.y + dy },
                { x: a.x, y: a.y + dy },
              ]
                .map((p) => `${p.x},${p.y}`)
                .join(" ")}
              fill={c}
              fillOpacity={0.05}
            />
            <Line x1={a.x} y1={a.y} x2={end.x} y2={end.y} {...stroke} />
            <Line
              x1={a.x}
              y1={a.y + dy}
              x2={end.x}
              y2={end.y + dy}
              {...stroke}
            />
          </>
        );
        break;
      }
      case "pitchfork": {
        const [p0, p1 = p0, p2 = p0] = pts;
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const k = far / (Math.hypot(mid.x - p0.x, mid.y - p0.y) || 1);
        const ext = (p: Point) => ({
          x: p.x + (mid.x - p0.x) * k,
          y: p.y + (mid.y - p0.y) * k,
        });
        caption(p0, "start");
        body = (
          <>
            <Line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={c}
              strokeWidth={stroke.strokeWidth}
              strokeOpacity={0.5}
              strokeDasharray="3,3"
            />
            {[p0, p1, p2].map((from, i) => {
              const to = ext(from);
              return (
                <Line
                  key={i}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  {...stroke}
                  strokeDasharray={i === 0 ? undefined : stroke.strokeDasharray}
                />
              );
            })}
          </>
        );
        break;
      }
      case "trend":
        caption(b.x >= a.x ? b : a, "end");
        body = <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...stroke} />;
        break;
      case "ray": {
        const k = far / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
        caption(b, "start");
        body = (
          <Line
            x1={a.x}
            y1={a.y}
            x2={a.x + (b.x - a.x) * k}
            y2={a.y + (b.y - a.y) * k}
            {...stroke}
          />
        );
        break;
      }
      case "extended": {
        const k = far / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
        body = (
          <Line
            x1={a.x - (b.x - a.x) * k}
            y1={a.y - (b.y - a.y) * k}
            x2={b.x + (b.x - a.x) * k}
            y2={b.y + (b.y - a.y) * k}
            {...stroke}
          />
        );
        break;
      }
      case "vline":
        labels.push({
          key: id,
          drawingId: id,
          x: Math.max(4, Math.min(a.x + 5, plotW - 80)),
          y: 14,
          anchor: "start",
          text: new Date(pa.time).toLocaleDateString(
            locale === "en" ? "en-US" : "zh-CN",
          ),
          color: c,
          priority,
        });
        body = (
          <Line
            x1={a.x}
            x2={a.x}
            y1={0}
            y2={plotH}
            {...stroke}
            strokeDasharray="4,3"
          />
        );
        break;
      case "hline":
        levelLabel(d, id, a.y, d.label ?? "", pa.price, c, priority);
        body = <Line x1={0} y1={a.y} x2={plotW} y2={a.y} {...stroke} />;
        break;
      case "rect": {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        caption({ x, y });
        body = (
          <Rect
            x={x}
            y={y}
            width={ai ? Math.max(8, Math.abs(b.x - a.x)) : Math.abs(b.x - a.x)}
            height={Math.abs(b.y - a.y)}
            fill={c}
            fillOpacity={ai ? 0.06 : 0.1}
            {...stroke}
          />
        );
        break;
      }
      case "fib":
      case "fibext": {
        const left = Math.min(a.x, b.x);
        const right = Math.max(a.x, b.x);
        const extension = d.type === "fibext";
        const at = (lv: number) =>
          extension
            ? pa.price + (pb.price - pa.price) * lv
            : pb.price + (pa.price - pb.price) * lv;
        const levels = (
          extension ? [1, 1.272, 1.618, 2, 2.618] : FIB_LEVELS
        ).filter(
          (lv) => extension || !compact || selected || KEY_FIB.includes(lv),
        );
        const zoneTop = yOf(at(0.382));
        const zoneBottom = yOf(at(0.618));
        const lineRight = extension ? plotW : right;
        body = (
          <>
            {!extension && (
              <Rect
                x={left}
                y={Math.min(zoneTop, zoneBottom)}
                width={Math.max(right - left, 1)}
                height={Math.abs(zoneBottom - zoneTop)}
                fill={c}
                fillOpacity={selected ? 0.1 : 0.06}
              />
            )}
            {levels.map((lv) => {
              const price = at(lv);
              const y = yOf(price);
              const edge = lv === 0 || lv === 1;
              const key = lv === 0.5 || edge;
              levelLabel(
                d,
                `${id}-${lv}`,
                y,
                String(lv),
                price,
                c,
                priority - (key ? 0 : 5) - (edge ? 0 : 2),
                Math.max(4, left + 4),
                "start",
              );
              return (
                <Line
                  key={lv}
                  x1={left}
                  y1={y}
                  x2={lineRight}
                  y2={y}
                  stroke={c}
                  strokeWidth={selected ? 1.25 : edge ? 1 : tiers.fib.width}
                  strokeOpacity={selected ? 0.9 : key ? 0.7 : tiers.fib.opacity}
                  strokeDasharray={
                    edge || selected ? undefined : tiers.fib.dash
                  }
                />
              );
            })}
          </>
        );
        break;
      }
      case "measure": {
        const change = pa.price ? ((pb.price - pa.price) / pa.price) * 100 : 0;
        const tone = change >= 0 ? t.chartUp : t.chartDown;
        const between = Math.round(
          Math.abs(indexAt(pb.time) - indexAt(pa.time)),
        );
        labels.push({
          key: id,
          drawingId: id,
          x: (a.x + b.x) / 2,
          y: b.y + (b.y >= a.y ? 15 : -7),
          anchor: "middle",
          color: tone,
          bold: true,
          priority,
          text: `${change >= 0 ? "+" : ""}${change.toFixed(2)}% · ${formatPrice(pb.price - pa.price)} · ${between} 根`,
        });
        body = (
          <>
            <Rect
              x={Math.min(a.x, b.x)}
              y={Math.min(a.y, b.y)}
              width={Math.abs(b.x - a.x)}
              height={Math.abs(b.y - a.y)}
              fill={tone}
              fillOpacity={0.14}
            />
            <Line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={tone}
              strokeWidth={1.5}
              strokeDasharray="4,3"
            />
          </>
        );
        break;
      }
    }
    const opacity = preview
      ? 0.8
      : focused && !selected
        ? 0.25
        : tier && d.type !== "fib"
          ? tier.opacity
          : 1;
    return (
      <G key={preview ? "draft" : id} opacity={opacity}>
        {body}
        {(selected || preview) &&
          pts.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={5}
              fill={t.background}
              stroke={c}
              strokeWidth={1.5}
            />
          ))}
      </G>
    );
  }

  const bodies = width ? visible.map((d) => render(d, false)) : null;
  const draftBody = draft && width ? render(draft.drawing, true) : null;
  const { placedTags, placedLabels } = placeLabels(labels, axisTags, {
    width: plotW,
    height: plotH,
    compact,
    lastY: last ? yOf(last.close) : undefined,
  });
  const tagYs = [
    ...placedTags.map((tag) => tag.y),
    ...(last ? [yOf(last.close)] : []),
  ];
  const dimmed = (id: string) =>
    focused && id !== selectedId && id !== draft?.drawing.id;

  // --- hit testing and gestures ------------------------------------------------------
  function locate(x: number, y: number, snap = magnet): Anchor {
    let index = x / slot + view.start - 0.5;
    let price = priceAt(y);
    if (snap && count) {
      index = Math.min(Math.max(Math.round(index), 0), count - 1);
      const bar = bars[index];
      const nearest = [bar.open, bar.high, bar.low, bar.close].reduce(
        (best, v) =>
          Math.abs(yOf(v) - y) < Math.abs(yOf(best) - y) ? v : best,
      );
      if (Math.abs(yOf(nearest) - y) <= SNAP_PX) price = nearest;
    }
    return { time: timeAt(index), price };
  }
  function hitTest(p: Point): { id: string; handle: number | "body" } | null {
    const order = [...visible].sort((x, y) =>
      x.id === selectedId ? -1 : y.id === selectedId ? 1 : 0,
    );
    for (const d of order) {
      const pts = d.points.map(toPx);
      if (d.id === selectedId) {
        const handle = pts.findIndex(
          (q) => Math.hypot(q.x - p.x, q.y - p.y) <= HIT_PX + 4,
        );
        if (handle >= 0) return { id: d.id, handle };
      }
      const a = pts[0];
      const b = pts[1] ?? a;
      if (!a) continue;
      let distance = Infinity;
      switch (d.type) {
        case "hline":
          distance = Math.abs(p.y - a.y);
          break;
        case "vline":
          distance = Math.abs(p.x - a.x);
          break;
        case "rect":
        case "measure":
          distance =
            p.x >= Math.min(a.x, b.x) - 4 &&
            p.x <= Math.max(a.x, b.x) + 4 &&
            p.y >= Math.min(a.y, b.y) - 4 &&
            p.y <= Math.max(a.y, b.y) + 4
              ? 0
              : Infinity;
          break;
        case "fib":
        case "fibext":
          distance =
            p.x >= Math.min(a.x, b.x) - 4 &&
            (d.type === "fibext" || p.x <= Math.max(a.x, b.x) + 4) &&
            p.y >= Math.min(a.y, b.y) - 4 &&
            p.y <= Math.max(a.y, b.y) + 4
              ? 0
              : Infinity;
          break;
        case "ray":
        case "extended": {
          const k = far / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
          const end = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
          const start =
            d.type === "extended"
              ? { x: a.x - (b.x - a.x) * k, y: a.y - (b.y - a.y) * k }
              : a;
          distance = segmentDistance(p, start, end);
          break;
        }
        default:
          for (let i = 1; i < pts.length; i++)
            distance = Math.min(
              distance,
              segmentDistance(p, pts[i - 1], pts[i]),
            );
          if (pts.length === 1) distance = Math.hypot(p.x - a.x, p.y - a.y);
      }
      if (distance <= HIT_PX) return { id: d.id, handle: "body" };
    }
    return null;
  }
  const drawing = tool !== "cursor";
  const commit = (d: Drawing) => {
    setDraft(null);
    onCommit(d);
  };
  const barAt = (x: number) =>
    Math.max(
      firstVisible,
      Math.min(lastVisible, Math.floor(x / slot + view.start)),
    );

  const onGrant = (event: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = event.nativeEvent;
    if (drawing) {
      const anchor = locate(x, y);
      const type = tool as Drawing["type"];
      touch.current = { x, y, moved: false, mode: "draw" };
      if (type === "hline" || type === "vline")
        commit({ id: newId(), type, points: [anchor], color });
      else if (draft?.awaitingSecond)
        commit({ ...draft.drawing, points: [draft.drawing.points[0], anchor] });
      else
        setDraft({
          drawing: { id: newId(), type, points: [anchor, anchor], color },
          start: { x, y },
          awaitingSecond: false,
        });
      return;
    }
    const hit = readOnly ? null : hitTest({ x, y });
    if (hit) {
      onSelectDrawing(hit.id);
      const target = drawings.find((d) => d.id === hit.id);
      // AI drawings come from the saved analysis; only manual drawings move.
      if (target && target.source !== "ai")
        edit.current = {
          id: hit.id,
          handle: hit.handle,
          origin: locate(x, y, false),
          before: drawings,
          moved: false,
        };
      touch.current = { x, y, moved: false, mode: "edit" };
      return;
    }
    touch.current = { x, y, moved: false, mode: "tap" };
  };
  const onMove = (event: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = event.nativeEvent;
    const state = touch.current;
    if (state && Math.hypot(x - state.x, y - state.y) > 5) state.moved = true;
    const e = edit.current;
    if (e) {
      const anchor = locate(x, y);
      const free = locate(x, y, false);
      const shift = indexAt(free.time) - indexAt(e.origin.time);
      const lift = free.price - e.origin.price;
      const next = e.before.map((d) => {
        if (d.id !== e.id) return d;
        const points =
          e.handle === "body"
            ? d.points.map((p) => ({
                time: timeAt(indexAt(p.time) + shift),
                price: p.price + lift,
              }))
            : d.points.map((p, i) => (i === e.handle ? anchor : p));
        return { ...d, points };
      });
      e.moved = true;
      onDrawingsChange(next, null);
      return;
    }
    if (draft && !draft.awaitingSecond)
      setDraft({
        ...draft,
        drawing: {
          ...draft.drawing,
          points: [draft.drawing.points[0], locate(x, y)],
        },
      });
    else if (state?.mode === "tap" && !drawing) onActive(barAt(x));
  };
  const onRelease = (event: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = event.nativeEvent;
    const e = edit.current;
    edit.current = null;
    const state = touch.current;
    touch.current = null;
    if (e?.moved) onDrawingsChange(drawings, e.before);
    if (draft && !draft.awaitingSecond) {
      if (Math.hypot(x - draft.start.x, y - draft.start.y) > 5)
        commit({
          ...draft.drawing,
          points: [draft.drawing.points[0], locate(x, y)],
        });
      else setDraft({ ...draft, awaitingSecond: true });
      return;
    }
    if (state?.mode === "tap" && !state.moved) {
      const now = event.nativeEvent.timestamp;
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        onDoubleTap();
        return;
      }
      lastTap.current = now;
      onSelectDrawing(null);
      onActive(barAt(x));
    }
  };
  const onTerminate = () => {
    const e = edit.current;
    edit.current = null;
    touch.current = null;
    if (e?.moved) onDrawingsChange(e.before, null);
    if (draft && !draft.awaitingSecond) setDraft(null);
  };

  // --- marks -------------------------------------------------------------------------
  const visibleBars = count ? bars.slice(firstVisible, lastVisible + 1) : [];
  const marks = showCalls
    ? callMarks(visibleBars, events, containing, 20, (i) =>
        xOf(firstVisible + i),
      )
    : [];
  const extremes = (() => {
    if (lastVisible < firstVisible) return null;
    let high = firstVisible;
    let low = firstVisible;
    for (let i = firstVisible; i <= lastVisible; i++) {
      if (bars[i].high > bars[high].high) high = i;
      if (bars[i].low < bars[low].low) low = i;
    }
    return { high, low };
  })();
  const path = (values: Series) => {
    let d = "";
    let pen = false;
    for (
      let i = Math.max(firstVisible - 1, 0);
      i <= Math.min(lastVisible + 1, count - 1);
      i++
    ) {
      const v = values[i];
      if (v === null || v === undefined) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const band = () => {
    const upper: string[] = [];
    const lower: string[] = [];
    for (
      let i = Math.max(firstVisible - 1, 0);
      i <= Math.min(lastVisible + 1, count - 1);
      i++
    ) {
      const top = series.bb.upper[i];
      const bottom = series.bb.lower[i];
      if (top === null || bottom === null) continue;
      upper.push(`${xOf(i).toFixed(1)},${yOf(top).toFixed(1)}`);
      lower.unshift(`${xOf(i).toFixed(1)},${yOf(bottom).toFixed(1)}`);
    }
    return upper.length ? `M${upper.join("L")}L${lower.join("L")}Z` : "";
  };
  const ticks = (() => {
    const lo = priceAt(priceBottom);
    const hi = priceAt(priceTop);
    const raw = (hi - lo) / 4;
    const power = 10 ** Math.floor(Math.log10(raw || 1));
    const step =
      [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
    return out;
  })();
  const dateLabel = (i: number) => {
    const bar = bars[i];
    if (!bar) return "";
    const date = new Date(bar.date);
    if (intraday && view.end - view.start < 120)
      return (
        bar.date.slice(11, 16) ||
        date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    return date.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
      month: "short",
      day: "numeric",
    });
  };
  const timeLabels =
    lastVisible > firstVisible
      ? [0.12, 0.45, 0.78].map((p) =>
          Math.round(firstVisible + (lastVisible - firstVisible) * p),
        )
      : [];

  const legend = indicatorOrder.filter(
    (k) => k !== "volume" && indicators.includes(k),
  );
  const shownIndex = active ?? Math.min(lastVisible, count - 1);
  const legendValue = (k: IndicatorKey) => {
    const v =
      k === "bb"
        ? series.bb.middle[shownIndex]
        : lines[k as keyof typeof lines][shownIndex];
    return v === null || v === undefined ? "—" : v.toFixed(2);
  };
  const legendColor = (k: IndicatorKey) => resolve(indicatorMeta[k].color);

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {!!width && (
        <Svg width={width} height={height}>
          <Defs>
            <ClipPath id="plot">
              <Rect x={0} y={0} width={plotW} height={plotH} />
            </ClipPath>
          </Defs>
          {ticks.map((v) => (
            <G key={v}>
              <Line
                x1={0}
                x2={plotW}
                y1={yOf(v)}
                y2={yOf(v)}
                stroke={t.border}
                strokeOpacity={0.6}
              />
              {/* An axis number under a price tag would show through it; the tag wins. */}
              {!tagYs.some((y) => Math.abs(y - yOf(v)) < TAG_HEIGHT) && (
                <SvgText
                  x={plotW + 8}
                  y={yOf(v) + 4}
                  fontSize={FONT_SIZE}
                  fill={t.secondary}
                >
                  {fixed(v)}
                </SvgText>
              )}
            </G>
          ))}
          <G clipPath="url(#plot)">
            {indicators.includes("bb") && (
              <>
                <Path d={band()} fill={legendColor("bb")} fillOpacity={0.07} />
                <Path
                  d={path(series.bb.upper)}
                  fill="none"
                  stroke={legendColor("bb")}
                  strokeWidth={1}
                />
                <Path
                  d={path(series.bb.lower)}
                  fill="none"
                  stroke={legendColor("bb")}
                  strokeWidth={1}
                />
                <Path
                  d={path(series.bb.middle)}
                  fill="none"
                  stroke={legendColor("bb")}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
              </>
            )}
            {variant === "line" &&
              visibleBars.length > 1 &&
              (() => {
                const first = visibleBars[0].close;
                const lastClose = visibleBars[visibleBars.length - 1].close;
                const tone = lastClose >= first ? t.chartUp : t.chartDown;
                const line = visibleBars
                  .map(
                    (bar, k) =>
                      `${k ? "L" : "M"}${xOf(firstVisible + k).toFixed(1)},${yOf(bar.close).toFixed(1)}`,
                  )
                  .join("");
                const left = xOf(firstVisible).toFixed(1);
                const right = xOf(
                  firstVisible + visibleBars.length - 1,
                ).toFixed(1);
                return (
                  <G>
                    <Defs>
                      <LinearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={tone} stopOpacity={0.22} />
                        <Stop offset="1" stopColor={tone} stopOpacity={0} />
                      </LinearGradient>
                    </Defs>
                    <Line
                      x1={0}
                      x2={plotW}
                      y1={yOf(first)}
                      y2={yOf(first)}
                      stroke={t.secondary}
                      strokeOpacity={0.4}
                      strokeDasharray="2,4"
                    />
                    <Path
                      d={`${line}L${right},${plotH}L${left},${plotH}Z`}
                      fill="url(#lineArea)"
                    />
                    <Path
                      d={line}
                      fill="none"
                      stroke={tone}
                      strokeWidth={2}
                      strokeLinejoin="round"
                    />
                  </G>
                );
              })()}
            {variant === "candles" &&
              visibleBars.map((bar, k) => {
                const i = firstVisible + k;
                const fill = bar.close >= bar.open ? t.chartUp : t.chartDown;
                const top = yOf(Math.max(bar.open, bar.close));
                const bottom = yOf(Math.min(bar.open, bar.close));
                const cx = xOf(i);
                const w = Math.max(slot * 0.62, 1);
                const vol = showVolume
                  ? ((bar.volume || 0) / yRange.maxVolume) * volumeH
                  : 0;
                return (
                  <G key={bar.date}>
                    {showVolume && (
                      <Rect
                        x={cx - w / 2}
                        y={plotH - vol}
                        width={w}
                        height={vol}
                        fill={fill}
                        opacity={0.28}
                      />
                    )}
                    <Line
                      x1={cx}
                      x2={cx}
                      y1={yOf(bar.high)}
                      y2={yOf(bar.low)}
                      stroke={fill}
                      strokeWidth={1}
                    />
                    <Rect
                      x={cx - w / 2}
                      y={top}
                      width={w}
                      height={Math.max(bottom - top, 1)}
                      fill={fill}
                    />
                  </G>
                );
              })}
            {(["vwap", "ema5", "ema20", "ema50", "ema200"] as const).map((k) =>
              indicators.includes(k) ? (
                <Path
                  key={k}
                  d={path(lines[k])}
                  fill="none"
                  stroke={legendColor(k)}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
              ) : null,
            )}
            {forecast &&
              forecastBase >= 0 &&
              bars[forecastBase] &&
              (() => {
                const base = forecastBase;
                const anchor = `${xOf(base).toFixed(1)},${yOf(bars[base].close).toFixed(1)}`;
                const upper = [anchor];
                const lower = [anchor];
                let median = `M${anchor}`;
                forecast.points.forEach((p, k) => {
                  const x = xOf(base + 1 + k).toFixed(1);
                  upper.push(`${x},${yOf(p.close_p90).toFixed(1)}`);
                  lower.unshift(`${x},${yOf(p.close_p10).toFixed(1)}`);
                  median += `L${x},${yOf(p.close).toFixed(1)}`;
                });
                const tone =
                  forecast.summary.median_return >= 0 ? t.chartUp : t.chartDown;
                const w = Math.max(slot * 0.5, 1);
                return (
                  <G>
                    <Line
                      x1={xOf(base + 0.5)}
                      x2={xOf(base + 0.5)}
                      y1={0}
                      y2={priceBottom}
                      stroke={t.text}
                      strokeOpacity={0.25}
                      strokeDasharray="2,4"
                    />
                    <Path
                      d={`M${upper.join("L")}L${lower.join("L")}Z`}
                      fill={tone}
                      fillOpacity={0.12}
                    />
                    {forecast.points.map((p, k) => {
                      const cx = xOf(base + 1 + k);
                      const top = yOf(Math.max(p.open, p.close));
                      const bottom = yOf(Math.min(p.open, p.close));
                      const f = p.close >= p.open ? t.chartUp : t.chartDown;
                      return (
                        <G key={p.date} opacity={0.35}>
                          <Line
                            x1={cx}
                            x2={cx}
                            y1={yOf(p.high)}
                            y2={yOf(p.low)}
                            stroke={f}
                            strokeWidth={1}
                          />
                          <Rect
                            x={cx - w / 2}
                            y={top}
                            width={w}
                            height={Math.max(bottom - top, 1)}
                            fill="none"
                            stroke={f}
                            strokeWidth={1}
                          />
                        </G>
                      );
                    })}
                    <Path
                      d={median}
                      fill="none"
                      stroke={tone}
                      strokeWidth={1.5}
                      strokeDasharray="5,4"
                    />
                  </G>
                );
              })()}
            {last && (
              <Line
                x1={0}
                x2={plotW}
                y1={yOf(last.close)}
                y2={yOf(last.close)}
                stroke={lastUp ? t.chartUp : t.chartDown}
                strokeOpacity={0.45}
              />
            )}
            {bodies}
            {draftBody}
            {marks.map(({ index, entry }) => {
              const bar = visibleBars[index];
              return (
                <CallMarks
                  key={`call${index}`}
                  cx={xOf(firstVisible + index)}
                  high={yOf(bar.high)}
                  low={yOf(bar.low)}
                  entry={entry}
                  up={t.chartUp}
                  down={t.chartDown}
                  dot={t.secondary}
                />
              );
            })}
            {active !== null &&
              active >= firstVisible &&
              active <= lastVisible && (
                <Line
                  x1={xOf(active)}
                  x2={xOf(active)}
                  y1={0}
                  y2={plotH}
                  stroke={t.secondary}
                  strokeDasharray="3,3"
                />
              )}
          </G>
          {placedLabels.map((label) => (
            // A background-coloured halo under each label keeps it legible over candles.
            <G key={label.key} opacity={dimmed(label.drawingId) ? 0.35 : 1}>
              <SvgText
                x={label.x}
                y={label.y}
                textAnchor={label.anchor}
                fill={t.background}
                fontSize={FONT_SIZE}
                fontWeight={label.bold ? "600" : "500"}
                stroke={t.background}
                strokeWidth={3}
              >
                {label.text}
              </SvgText>
              <SvgText
                x={label.x}
                y={label.y}
                textAnchor={label.anchor}
                fill={label.color}
                fontSize={FONT_SIZE}
                fontWeight={label.bold ? "600" : "500"}
              >
                {label.text}
              </SvgText>
            </G>
          ))}
          {extremes && (
            <>
              {(variant === "line"
                ? (["high"] as const)
                : (["high", "low"] as const)
              ).map((side) => {
                const i = side === "high" ? extremes.high : extremes.low;
                const value = side === "high" ? bars[i].high : bars[i].low;
                const label = fixed(value);
                const w = textWidth(label) + 12;
                const cx = Math.min(
                  Math.max(xOf(i), w / 2 + 2),
                  plotW - w / 2 - 2,
                );
                const y =
                  side === "high"
                    ? Math.max(yOf(value) - 6, 1) - 18
                    : Math.min(yOf(value) + 6, plotH - 18);
                return (
                  <G key={side}>
                    <Rect
                      x={cx - w / 2}
                      y={y}
                      width={w}
                      height={18}
                      rx={6}
                      fill={t.background}
                      fillOpacity={0.9}
                      stroke={t.border}
                    />
                    <SvgText
                      x={cx}
                      y={y + 13}
                      fontSize={FONT_SIZE}
                      textAnchor="middle"
                      fill={t.text}
                      opacity={0.8}
                    >
                      {label}
                    </SvgText>
                  </G>
                );
              })}
            </>
          )}
          {placedTags.map((tag) => (
            <G key={tag.key} opacity={dimmed(tag.drawingId) ? 0.35 : 1}>
              <Rect
                x={plotW + 1}
                y={tag.y - TAG_HEIGHT / 2}
                width={AXIS - 2}
                height={TAG_HEIGHT}
                rx={5}
                fill={tag.color}
              />
              <SvgText
                x={plotW + AXIS / 2}
                y={tag.y + 3.75}
                textAnchor="middle"
                fontSize={10.5}
                fontWeight="600"
                fill="#FFFFFF"
              >
                {tag.price.toFixed(Math.abs(tag.price) >= 1000 ? 0 : 2)}
              </SvgText>
            </G>
          ))}
          {last && (
            <G>
              <Rect
                x={plotW + 1}
                y={yOf(last.close) - 10}
                width={AXIS - 2}
                height={20}
                rx={6}
                fill={lastUp ? t.chartUp : t.chartDown}
              />
              <SvgText
                x={plotW + AXIS / 2}
                y={yOf(last.close) + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight="700"
                fill="#FFFFFF"
              >
                {last.close.toFixed(Math.abs(last.close) >= 1000 ? 0 : 2)}
              </SvgText>
            </G>
          )}
          {timeLabels.map((i) => (
            <SvgText
              key={`d${i}`}
              x={xOf(i)}
              y={height - 8}
              fontSize={FONT_SIZE}
              textAnchor="middle"
              fill={t.secondary}
            >
              {dateLabel(i)}
            </SvgText>
          ))}
        </Svg>
      )}
      {/* Touch surface over the plot: draw, select and drag drawings, tap to inspect a bar. */}
      <View
        accessibilityLabel={text(drawing ? "在图表上绘制画线" : "价格图表")}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: plotW,
          height: plotH,
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => drawing || !!edit.current}
        onResponderTerminationRequest={() => !drawing && !edit.current}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={onTerminate}
      />
      {legend.length > 0 && (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 6,
            top: 2,
            maxWidth: Math.max(plotW - 12, 120),
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            columnGap: 12,
            rowGap: 2,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: t.dark
              ? "rgba(0,0,0,0.7)"
              : "rgba(255,255,255,0.7)",
          }}
        >
          {(compact && !legendOpen
            ? legend.slice(0, LEGEND_PREVIEW)
            : legend
          ).map((k) => (
            <Copy key={k} size={11} localize={false}>
              <Copy size={11} muted localize={false}>
                {indicatorMeta[k].label}{" "}
              </Copy>
              <Copy size={11} bold localize={false} color={legendColor(k)}>
                {legendValue(k)}
              </Copy>
            </Copy>
          ))}
          {compact && legend.length > LEGEND_PREVIEW && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: legendOpen }}
              hitSlop={10}
              onPress={() => setLegendOpen((v) => !v)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                minHeight: 20,
              }}
            >
              <Copy size={11} bold muted>
                {legendOpen ? "收起" : `+${legend.length - LEGEND_PREVIEW} 个`}
              </Copy>
              <SymbolView
                name={legendOpen ? "chevron.up" : "chevron.down"}
                size={9}
                tintColor={t.secondary}
              />
            </Pressable>
          )}
        </View>
      )}
      {forecastNote && (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 6,
            bottom: TIME_AXIS + 4,
            maxWidth: plotW - 12,
          }}
        >
          {forecastNote}
        </View>
      )}
    </View>
  );
}

/** The Web's KDJ / MACD / RSI strip under the time axis, sharing the price chart's window. */
export function OscillatorPane({
  bars,
  kind,
  onChange,
  view,
  active,
  onActive,
  height: HEIGHT = 92,
}: {
  bars: PriceBar[];
  kind: Oscillator;
  onChange: (next: Oscillator | null) => void;
  view: ChartWindowView;
  active: number | null;
  onActive: (index: number | null) => void;
  /** Plot height; the tab row above it adds 28pt. */
  height?: number;
}) {
  const t = useTheme();
  const text = useText();
  const { level, resolve } = useChartColors();
  const [width, setWidth] = useState(0);
  const data = useMemo(() => {
    const closes = bars.map((b) => b.close);
    if (kind === "rsi")
      return {
        lines: [
          {
            name: "RSI",
            values: rsi(closes),
            color: resolve(indicatorMeta.ema20.color),
          },
        ],
        histogram: null,
      };
    if (kind === "macd") {
      const v = macd(closes);
      return {
        lines: [
          {
            name: "DIF",
            values: v.dif,
            color: resolve(indicatorMeta.ema50.color),
          },
          { name: "DEA", values: v.dea, color: level },
        ],
        histogram: v.histogram,
      };
    }
    const v = kdj(bars);
    return {
      lines: [
        { name: "K", values: v.k, color: resolve(indicatorMeta.ema50.color) },
        { name: "D", values: v.d, color: level },
        { name: "J", values: v.j, color: resolve(indicatorMeta.ema20.color) },
      ],
      histogram: null as Series | null,
    };
  }, [bars, kind, level, resolve]);
  const first = Math.max(0, Math.floor(view.start));
  const last = Math.min(bars.length - 1, Math.ceil(view.end) - 1);
  const plotW = Math.max(width - AXIS, 1);
  const slot = plotW / Math.max(view.end - view.start, 1);
  const x = (i: number) => (i - view.start + 0.5) * slot;
  const values: number[] = [];
  for (let i = first; i <= last; i++) {
    for (const l of data.lines)
      if (l.values[i] != null) values.push(l.values[i]!);
    if (data.histogram?.[i] != null) values.push(data.histogram[i]!);
  }
  const max = Math.max(kind === "macd" ? 0 : 100, ...values);
  const min = Math.min(0, ...values);
  const pad = 6;
  const y = (v: number) =>
    pad + ((max - v) / (max - min || 1)) * (HEIGHT - pad * 2);
  const selected = active ?? last;
  const thresholds =
    kind === "macd" ? [0] : kind === "rsi" ? [30, 70] : [20, 80];
  const pathOf = (vals: Series) => {
    let d = "";
    let pen = false;
    for (
      let i = Math.max(first - 1, 0);
      i <= Math.min(last + 1, bars.length - 1);
      i++
    ) {
      const v = vals[i];
      if (v == null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", height: 28 }}>
        {(["kdj", "macd", "rsi"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === value }}
            accessibilityLabel={oscillatorLabels[value]}
            onPress={() => onChange(value)}
            hitSlop={8}
            style={{
              height: 28,
              paddingHorizontal: 8,
              justifyContent: "center",
            }}
          >
            <View
              style={{
                borderBottomWidth: 2,
                borderBottomColor: kind === value ? t.text : "transparent",
              }}
            >
              <Copy
                size={13}
                bold={kind === value}
                muted={kind !== value}
                localize={false}
              >
                {value.toUpperCase()}
              </Copy>
            </View>
          </Pressable>
        ))}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            flexWrap: "wrap",
            columnGap: 8,
            paddingLeft: 4,
          }}
        >
          {data.lines.map((l) => (
            <Copy key={l.name} size={11} localize={false} color={l.color}>
              {`${l.name} ${l.values[selected]?.toFixed(2) ?? "—"}`}
            </Copy>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text("隐藏副图")}
          onPress={() => onChange(null)}
          hitSlop={8}
          style={{
            width: 32,
            height: 28,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SymbolView name="xmark" size={13} tintColor={t.secondary} />
        </Pressable>
      </View>
      <View
        style={{ height: HEIGHT }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          const px = e.nativeEvent.locationX;
          onActive(
            px > plotW
              ? null
              : Math.max(
                  first,
                  Math.min(Math.floor(view.start + px / slot), last),
                ),
          );
        }}
        onResponderMove={(e) => {
          const px = e.nativeEvent.locationX;
          onActive(
            px > plotW
              ? null
              : Math.max(
                  first,
                  Math.min(Math.floor(view.start + px / slot), last),
                ),
          );
        }}
        onResponderTerminationRequest={() => true}
      >
        {!!width && (
          <Svg width={width} height={HEIGHT}>
            {thresholds.map((v) => (
              <G key={v}>
                <Line
                  x1={0}
                  x2={plotW}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={t.border}
                  strokeDasharray="3,3"
                />
                <SvgText
                  x={plotW + 8}
                  y={y(v) + 4}
                  fontSize={10}
                  fill={t.secondary}
                >
                  {String(v)}
                </SvgText>
              </G>
            ))}
            {data.histogram &&
              Array.from(
                { length: Math.max(0, last - first + 1) },
                (_, k) => first + k,
              ).map((i) => {
                const v = data.histogram![i];
                if (v == null) return null;
                return (
                  <Rect
                    key={i}
                    x={x(i) - slot * 0.3}
                    width={Math.max(1, slot * 0.6)}
                    y={Math.min(y(v), y(0))}
                    height={Math.max(1, Math.abs(y(v) - y(0)))}
                    fill={v >= 0 ? t.chartUp : t.chartDown}
                    opacity={0.55}
                  />
                );
              })}
            {data.lines.map((l) => (
              <Path
                key={l.name}
                d={pathOf(l.values)}
                stroke={l.color}
                strokeWidth={1.25}
                fill="none"
              />
            ))}
            {active !== null && active >= first && active <= last && (
              <Line
                x1={x(active)}
                x2={x(active)}
                y1={0}
                y2={HEIGHT}
                stroke={t.secondary}
                strokeDasharray="3,3"
              />
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}
