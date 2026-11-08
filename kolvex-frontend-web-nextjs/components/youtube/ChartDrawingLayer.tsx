"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatChangePercent, formatPrice } from "@/lib/stockApi";
import { fibLevels, type Anchor, type Drawing, type DrawingGroup } from "./chartDrawings";
import { toneStroke } from "./strength";

type Translate = (key: string, params?: Record<string, string>) => string;
type Point = { x: number; y: number };
type Box = { x1: number; y1: number; x2: number; y2: number };

const FONT_SIZE = 11;
const LINE_HEIGHT = 13;
const TAG_HEIGHT = 16;
/** Below this plot width the chart is a phone: fewer layers, shorter labels. */
const COMPACT_WIDTH = 480;
const KEY_FIB = [0, 0.382, 0.5, 0.618, 1];

const labelProps = {
  fontSize: FONT_SIZE,
  paintOrder: "stroke",
  stroke: "rgb(var(--background))",
  strokeWidth: 3,
  strokeLinejoin: "round",
} as const;

/** Visual tier per AI layer: the trade plan reads first, Fib sits furthest back. */
const tiers: Record<DrawingGroup, { width: number; opacity: number; dash?: string }> = {
  plan: { width: 1.5, opacity: 1 },
  levels: { width: 1, opacity: 0.85 },
  trend: { width: 1, opacity: 0.7, dash: "5 3" },
  fib: { width: 0.75, opacity: 0.45, dash: "3 3" },
  zones: { width: 0.75, opacity: 0.6, dash: "2 3" },
  pattern: { width: 1, opacity: 0.5 },
};

/** Rough text width for 11px UI type: CJK glyphs are about twice as wide as Latin ones. */
function textWidth(text: string) {
  let width = 0;
  for (const char of text) width += /[⺀-￯]/.test(char) ? FONT_SIZE : FONT_SIZE * 0.6;
  return width;
}

const overlaps = (a: Box, b: Box) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

/** A label waiting for space. Level labels (`price` set) fall back to showing the price in-plot. */
interface LabelRequest {
  key: string;
  drawingId: string;
  x: number;
  y: number;
  anchor: "start" | "end" | "middle";
  text: string;
  price?: number;
  color: string;
  priority: number;
  bold?: boolean;
  /** Level labels at almost the same height merge into one ("阻力 · 0.618"). */
  mergeable?: boolean;
  /** May slide up/down one line to find room. */
  nudge?: boolean;
}

interface AxisRequest {
  key: string;
  drawingId: string;
  y: number;
  price: number;
  color: string;
  priority: number;
}

/**
 * Pixel-space overlay for user drawings. Elements carry `data-drawing` / `data-handle`
 * so the chart's pointer handlers can hit-test without per-element listeners.
 *
 * The SVG spans the plot plus the right price axis: lines are clipped to the plot, while level
 * prices are posted on the axis as tags so the plot keeps only short names. Every label competes
 * for space by priority; one that cannot fit is dropped (its line stays) until it is selected.
 */
export default function ChartDrawingLayer({
  width,
  height,
  axisWidth = 0,
  drawings,
  draft,
  selectedId,
  interactive,
  toPx,
  barsBetween,
  hiddenGroups,
  lastPrice,
  t,
}: {
  width: number;
  height: number;
  /** Width of the price axis to the right of the plot; 0 disables axis tags. */
  axisWidth?: number;
  drawings: Drawing[];
  draft: Drawing | null;
  selectedId: string | null;
  interactive: boolean;
  toPx: (anchor: Anchor) => Point;
  barsBetween: (a: Anchor, b: Anchor) => number;
  hiddenGroups?: ReadonlySet<DrawingGroup>;
  /** Latest close: picks the nearest levels on phones and keeps its axis tag clear. */
  lastPrice?: number;
  t: Translate;
}) {
  const clipId = useId();
  if (!width || !height) return null;

  const compact = width < COMPACT_WIDTH;
  const priceY = (price: number) => toPx({ time: 0, price }).y;
  const visible = visibleDrawings(drawings, selectedId, hiddenGroups, compact, lastPrice);
  const focused = selectedId !== null && visible.some((item) => item.id === selectedId);

  const labels: LabelRequest[] = [];
  const axisTags: AxisRequest[] = [];

  function priorityOf(drawing: Drawing) {
    return drawing.id === selectedId ? 1000 : drawing.priority ?? (drawing.source === "ai" ? 50 : 70);
  }

  function hitLine(id: string, a: Point, b: Point, key?: string) {
    return (
      <line
        key={key}
        data-drawing={id}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="transparent"
        strokeWidth={12}
        pointerEvents="stroke"
        className="cursor-move"
      />
    );
  }

  function displayColor(drawing: Drawing) {
    if (drawing.source !== "ai") return drawing.color;
    if (drawing.type === "fib" || drawing.color.includes("245 158 11")) return "rgb(var(--chart-level))";
    if (drawing.color.includes("negative")) return "rgb(var(--chart-down))";
    if (drawing.color.includes("positive")) return "rgb(var(--chart-up))";
    return drawing.color;
  }

  /** A horizontal level: axis tag for the price, a short in-plot name at the right edge. */
  function levelLabel(drawing: Drawing, key: string, y: number, text: string, price: number, color: string, priority: number, x = width - 4, anchor: "start" | "end" = "end") {
    if (y < 0 || y > height) return;
    if (axisWidth > 0) axisTags.push({ key, drawingId: drawing.id, y, price, color, priority });
    if (text) labels.push({ key, drawingId: drawing.id, x, y: y - 4, anchor, text, price, color, priority, mergeable: true });
    else if (!axisWidth) labels.push({ key, drawingId: drawing.id, x, y: y - 4, anchor, text: formatPrice(price), color, priority });
  }

  function render(drawing: Drawing, preview: boolean) {
    const { id } = drawing;
    const color = displayColor(drawing);
    const [a, b = a] = drawing.points.map(toPx);
    const [pa, pb = pa] = drawing.points;
    const selected = id === selectedId;
    const ai = drawing.source === "ai";
    const tier = drawing.group ? tiers[drawing.group] : null;
    const priority = priorityOf(drawing);
    const stroke = {
      stroke: color,
      strokeWidth: selected ? 1.75 : tier?.width ?? (ai ? 1 : 1.5),
      strokeDasharray: selected ? undefined : tier?.dash,
    };
    /** Phones drop captions on AI trend lines and overlays; colour and selection carry them. */
    const caption = (point: Point, anchor: "start" | "end" = "start", dy = -5) => {
      if (!drawing.label || (compact && ai && !selected)) return;
      labels.push({ key: id, drawingId: id, x: point.x, y: point.y + dy, anchor, text: drawing.label, color, priority, bold: true, nudge: true });
    };
    let body: ReactNode = null;

    switch (drawing.type) {
      case "polyline": {
        const path = drawing.points.map(toPx);
        if (path.length > 0) caption(path[path.length - 1], "end");
        body = <polyline points={path.map(p => `${p.x},${p.y}`).join(" ")} fill="none" {...stroke} pointerEvents="none" />;
        break;
      }
      case "channel": {
        // Base a→b; the parallel passes through c, so the width is c's vertical distance from the base.
        const c = drawing.points[2] ? toPx(drawing.points[2]) : b;
        const run = b.x - a.x;
        const dy = c.y - (run ? a.y + ((b.y - a.y) * (c.x - a.x)) / run : a.y);
        const k = ((width + height) * 2) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
        const end = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        const shift = (p: Point) => ({ x: p.x, y: p.y + dy });
        caption(shift(a), "start", dy < 0 ? -5 : 12);
        body = (
          <>
            <polygon points={[a, end, shift(end), shift(a)].map(p => `${p.x},${p.y}`).join(" ")} fill={color} fillOpacity={0.05} stroke="none" pointerEvents="none" />
            <line x1={a.x} y1={a.y} x2={end.x} y2={end.y} {...stroke} />
            <line x1={a.x} y1={a.y + dy} x2={end.x} y2={end.y + dy} {...stroke} />
            {hitLine(id, a, end, "base")}
            {hitLine(id, shift(a), shift(end), "parallel")}
          </>
        );
        break;
      }
      case "pitchfork": {
        // Andrews: median from P0 through mid(P1, P2); tines through P1 and P2 run parallel to it.
        const [p0, p1, p2] = drawing.points.map(toPx);
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const k = ((width + height) * 2) / (Math.hypot(mid.x - p0.x, mid.y - p0.y) || 1);
        const extend = (p: Point) => ({ x: p.x + (mid.x - p0.x) * k, y: p.y + (mid.y - p0.y) * k });
        caption(p0, "start");
        body = (
          <>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={stroke.strokeWidth} strokeOpacity={0.5} strokeDasharray="3 3" />
            {[[p0, extend(p0)], [p1, extend(p1)], [p2, extend(p2)]].map(([from, to], index) => (
              <g key={index}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} {...stroke} strokeDasharray={index === 0 ? undefined : stroke.strokeDasharray} />
                {hitLine(id, from, to, String(index))}
              </g>
            ))}
          </>
        );
        break;
      }
      case "trend":
        caption(b.x >= a.x ? b : a, "end");
        body = (
          <>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...stroke} />
            {hitLine(id, a, b)}
          </>
        );
        break;
      case "ray": {
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const k = ((width + height) * 2) / length;
        const end = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        caption(b, "start");
        body = (
          <>
            <line x1={a.x} y1={a.y} x2={end.x} y2={end.y} {...stroke} />
            {hitLine(id, a, end)}
          </>
        );
        break;
      }
      case "extended": {
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const scale = (width + height) * 2 / length;
        const start = { x: a.x - (b.x - a.x) * scale, y: a.y - (b.y - a.y) * scale };
        const end = { x: b.x + (b.x - a.x) * scale, y: b.y + (b.y - a.y) * scale };
        body = <><line x1={start.x} y1={start.y} x2={end.x} y2={end.y} {...stroke} />{hitLine(id, start, end)}</>;
        break;
      }
      case "vline":
        labels.push({
          key: id, drawingId: id, x: Math.max(4, Math.min(a.x + 5, width - 80)), y: 14, anchor: "start",
          text: new Date(pa.time).toLocaleDateString(t("common.intlLocale")), color, priority,
        });
        body = <>
          <line x1={a.x} x2={a.x} y1={0} y2={height} {...stroke} strokeDasharray="4 3" />
          {hitLine(id, { x: a.x, y: 0 }, { x: a.x, y: height })}
        </>;
        break;
      case "hline":
        levelLabel(drawing, id, a.y, drawing.label ?? "", pa.price, color, priority);
        body = (
          <>
            <line x1={0} y1={a.y} x2={width} y2={a.y} {...stroke} />
            {hitLine(id, { x: 0, y: a.y }, { x: width, y: a.y })}
          </>
        );
        break;
      case "rect": {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        caption({ x, y });
        body = (
          <rect
            data-drawing={id}
            x={x}
            y={y}
            width={ai ? Math.max(8, Math.abs(b.x - a.x)) : Math.abs(b.x - a.x)}
            height={Math.abs(b.y - a.y)}
            fill={color}
            fillOpacity={ai ? 0.06 : 0.1}
            pointerEvents="all"
            className="cursor-move"
            {...stroke}
          />
        );
        break;
      }
      case "fib":
      case "fibext": {
        const left = Math.min(a.x, b.x);
        const right = Math.max(a.x, b.x);
        const extension = drawing.type === "fibext";
        const priceAt = (level: number) => extension ? pa.price + (pb.price - pa.price) * level : pb.price + (pa.price - pb.price) * level;
        // Phones keep the key ratios only; the golden-pocket band stands in for the rest.
        const levels = (extension ? [1, 1.272, 1.618, 2, 2.618] : fibLevels).filter((level) => extension || !compact || selected || KEY_FIB.includes(level));
        const zoneTop = priceY(priceAt(0.382));
        const zoneBottom = priceY(priceAt(0.618));
        const lineRight = extension ? width : right;
        body = (
          <>
            {!extension && (
              <rect
                x={left}
                y={Math.min(zoneTop, zoneBottom)}
                width={Math.max(right - left, 1)}
                height={Math.abs(zoneBottom - zoneTop)}
                fill={color}
                fillOpacity={selected ? 0.1 : 0.06}
                pointerEvents="none"
              />
            )}
            {levels.map((level) => {
              const price = priceAt(level);
              const y = priceY(price);
              const edge = level === 0 || level === 1;
              const key = level === 0.5 || edge;
              levelLabel(drawing, `${id}-${level}`, y, String(level), price, color, priority - (key ? 0 : 5) - (edge ? 0 : 2), Math.max(4, left + 4), "start");
              return (
                <g key={level}>
                  <line
                    x1={left}
                    y1={y}
                    x2={lineRight}
                    y2={y}
                    stroke={color}
                    strokeWidth={selected ? 1.25 : edge ? 1 : tiers.fib.width}
                    strokeOpacity={selected ? 0.9 : key ? 0.7 : tiers.fib.opacity}
                    strokeDasharray={edge || selected ? undefined : tiers.fib.dash}
                  />
                  {hitLine(id, { x: left, y }, { x: lineRight, y }, String(level))}
                </g>
              );
            })}
          </>
        );
        break;
      }
      case "measure": {
        const change = pa.price ? ((pb.price - pa.price) / pa.price) * 100 : 0;
        const tone = toneStroke[change >= 0 ? "positive" : "negative"];
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        labels.push({
          key: id, drawingId: id, x: (a.x + b.x) / 2, y: b.y + (b.y >= a.y ? 15 : -7), anchor: "middle", color: tone, bold: true, priority,
          text: `${formatChangePercent(change)} · ${formatPrice(pb.price - pa.price)} · ${t("youtubeOpinions.measureBars", {
            count: String(Math.abs(barsBetween(pa, pb))),
          })}`,
        });
        body = (
          <>
            <rect
              data-drawing={id}
              x={x}
              y={y}
              width={ai ? Math.max(8, Math.abs(b.x - a.x)) : Math.abs(b.x - a.x)}
              height={Math.abs(b.y - a.y)}
              fill={tone}
              fillOpacity={0.14}
              pointerEvents="all"
              className="cursor-move"
            />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={tone} strokeWidth={1.5} strokeDasharray="4 3" />
          </>
        );
        break;
      }
    }

    const opacity = preview ? 0.8 : focused && !selected ? 0.25 : tier && drawing.type !== "fib" ? tier.opacity : 1;
    return (
      <g key={preview ? "draft" : id} opacity={opacity}>
        {body}
        {(selected || preview) &&
          drawing.points.map((_, index) => {
            const point = toPx(drawing.points[index]);
            return (
              <circle
                key={index}
                data-drawing={id}
                data-handle={index}
                cx={point.x}
                cy={point.y}
                r={4.5}
                fill="rgb(var(--background))"
                stroke={color}
                strokeWidth={1.5}
                pointerEvents="all"
                className="cursor-grab"
              />
            );
          })}
      </g>
    );
  }

  const bodies = visible.map((drawing) => render(drawing, false));
  const draftBody = draft ? render(draft, true) : null;
  const { placedTags, placedLabels } = placeLabels(labels, axisTags, {
    width, height, compact, axisWidth, lastY: lastPrice === undefined ? undefined : priceY(lastPrice),
  });
  const dimmed = (drawingId: string) => focused && drawingId !== selectedId && drawingId !== draft?.id;

  return (
    <svg
      width={width + axisWidth}
      height={height}
      className={cn("absolute inset-0 overflow-hidden tabular-nums", !interactive && "pointer-events-none")}
      style={{ pointerEvents: interactive ? undefined : "none" }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g pointerEvents={interactive ? "auto" : "none"}>{bodies}</g>
        {draftBody && <g pointerEvents="none">{draftBody}</g>}
        <g pointerEvents="none">
          {placedLabels.map((label) => (
            <text
              key={label.key}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              fill={label.color}
              fontWeight={label.bold ? 600 : 500}
              opacity={dimmed(label.drawingId) ? 0.35 : 1}
              {...labelProps}
            >
              {label.text}
            </text>
          ))}
        </g>
      </g>
      <g pointerEvents="none">
        {placedTags.map((tag) => (
          <g key={tag.key} opacity={dimmed(tag.drawingId) ? 0.35 : 1}>
            <rect x={width + 1} y={tag.y - TAG_HEIGHT / 2} width={axisWidth - 2} height={TAG_HEIGHT} rx={5} fill={tag.color} />
            <text x={width + axisWidth / 2} y={tag.y + 3.75} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="white">
              {tag.price.toFixed(Math.abs(tag.price) >= 1000 ? 0 : 2)}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/**
 * Which drawings to paint. Toggled-off AI layers are skipped (a selected drawing always stays),
 * and on phones only the support and resistance closest to the last price are kept.
 */
function visibleDrawings(
  drawings: Drawing[],
  selectedId: string | null,
  hiddenGroups: ReadonlySet<DrawingGroup> | undefined,
  compact: boolean,
  lastPrice: number | undefined,
) {
  const shown = drawings.filter((item) => item.id === selectedId || !item.group || !hiddenGroups?.has(item.group));
  if (!compact || lastPrice === undefined) return shown;
  let above: Drawing | null = null;
  let below: Drawing | null = null;
  for (const item of shown) {
    if (item.group !== "levels" || !item.points[0]) continue;
    const price = item.points[0].price;
    if (price >= lastPrice && (!above || price < above.points[0].price)) above = item;
    if (price < lastPrice && (!below || price > below.points[0].price)) below = item;
  }
  return shown.filter((item) => item.group !== "levels" || item === above || item === below || item.id === selectedId);
}

/**
 * Greedy placement by priority. Axis tags go first (current price reserved), then in-plot labels;
 * a level whose axis tag did not fit shows its price in the plot instead. A level label that
 * lands on another level label merges into it rather than disappearing.
 */
function placeLabels(
  labels: LabelRequest[],
  tags: AxisRequest[],
  { width, height, compact, axisWidth, lastY }: { width: number; height: number; compact: boolean; axisWidth: number; lastY?: number },
) {
  const tagBoxes: Array<{ y1: number; y2: number }> = [];
  if (lastY !== undefined) tagBoxes.push({ y1: lastY - TAG_HEIGHT / 2 - 1, y2: lastY + TAG_HEIGHT / 2 + 1 });
  const placedTags: AxisRequest[] = [];
  const tagged = new Set<string>();
  if (axisWidth > 0) {
    for (const tag of [...tags].sort((a, b) => b.priority - a.priority)) {
      const box = { y1: tag.y - TAG_HEIGHT / 2, y2: tag.y + TAG_HEIGHT / 2 };
      if (box.y1 < -2 || box.y2 > height + 2) continue;
      if (tagBoxes.some((other) => box.y1 < other.y2 && other.y1 < box.y2)) continue;
      tagBoxes.push(box);
      placedTags.push(tag);
      tagged.add(tag.key);
    }
  }

  const placed: Array<LabelRequest & { box: Box }> = [];
  const boxFor = (label: LabelRequest, text: string, y: number): Box => {
    const w = textWidth(text);
    let x1 = label.anchor === "start" ? label.x : label.anchor === "end" ? label.x - w : label.x - w / 2;
    x1 = Math.min(Math.max(x1, 2), Math.max(width - w - 2, 2));
    return { x1, y1: y - LINE_HEIGHT + 2, x2: x1 + w, y2: y + 2 };
  };
  const anchorX = (label: LabelRequest, box: Box) => label.anchor === "start" ? box.x1 : label.anchor === "end" ? box.x2 : (box.x1 + box.x2) / 2;

  for (const request of [...labels].sort((a, b) => b.priority - a.priority)) {
    // Untagged levels carry their price in-plot; phones skip it for bare Fib ratios to save width.
    const fibRatio = !Number.isNaN(Number(request.text));
    const withPrice = request.price !== undefined && !tagged.has(request.key) && !(compact && fibRatio && request.priority < 1000);
    const text = withPrice ? `${request.text} ${formatPrice(request.price!)}` : request.text;
    const label = { ...request, text };
    const offsets = label.nudge ? [0, -LINE_HEIGHT, LINE_HEIGHT] : [0];
    for (const dy of offsets) {
      const y = Math.min(Math.max(label.y + dy, LINE_HEIGHT - 2), height - 3);
      const box = boxFor(label, label.text, y);
      const hit = placed.find((other) => overlaps(box, other.box));
      if (!hit) {
        placed.push({ ...label, y, x: anchorX(label, box), box });
        break;
      }
      if (label.mergeable && hit.mergeable && Math.abs(hit.y - y) < LINE_HEIGHT) {
        const merged = `${hit.text} · ${request.text}`;
        const mergedBox = boxFor(hit, merged, hit.y);
        if (!placed.some((other) => other !== hit && overlaps(mergedBox, other.box))) {
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
