"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatChangePercent, formatPrice } from "@/lib/stockApi";
import { fibLevels, type Anchor, type Drawing } from "./chartDrawings";
import { toneStroke } from "./strength";

type Translate = (key: string, params?: Record<string, string>) => string;
type Point = { x: number; y: number };

const labelProps = {
  fontSize: 11,
  paintOrder: "stroke",
  stroke: "rgb(var(--background))",
  strokeWidth: 3,
  strokeLinejoin: "round",
} as const;

/**
 * Pixel-space overlay for user drawings. Elements carry `data-drawing` / `data-handle`
 * so the chart's pointer handlers can hit-test without per-element listeners.
 */
export default function ChartDrawingLayer({
  width,
  height,
  drawings,
  draft,
  selectedId,
  interactive,
  toPx,
  barsBetween,
  t,
}: {
  width: number;
  height: number;
  drawings: Drawing[];
  draft: Drawing | null;
  selectedId: string | null;
  interactive: boolean;
  toPx: (anchor: Anchor) => Point;
  barsBetween: (a: Anchor, b: Anchor) => number;
  t: Translate;
}) {
  if (!width || !height) return null;

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

  function render(drawing: Drawing, preview: boolean) {
    const { id, color } = drawing;
    const [a, b = a] = drawing.points.map(toPx);
    const [pa, pb = pa] = drawing.points;
    const selected = id === selectedId;
    const stroke = { stroke: color, strokeWidth: selected ? 2 : 1.5 };
    let body: ReactNode = null;

    switch (drawing.type) {
      case "trend":
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
        body = (
          <>
            <line x1={a.x} y1={a.y} x2={end.x} y2={end.y} {...stroke} />
            {hitLine(id, a, end)}
          </>
        );
        break;
      }
      case "hline":
        body = (
          <>
            <line x1={0} y1={a.y} x2={width} y2={a.y} {...stroke} />
            <text x={width - 4} y={a.y - 4} textAnchor="end" fill={color} {...labelProps}>
              {formatPrice(pa.price)}
            </text>
            {hitLine(id, { x: 0, y: a.y }, { x: width, y: a.y })}
          </>
        );
        break;
      case "rect": {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        body = (
          <rect
            data-drawing={id}
            x={x}
            y={y}
            width={Math.abs(b.x - a.x)}
            height={Math.abs(b.y - a.y)}
            fill={color}
            fillOpacity={0.1}
            pointerEvents="all"
            className="cursor-move"
            {...stroke}
          />
        );
        break;
      }
      case "fib": {
        const left = Math.min(a.x, b.x);
        const right = Math.max(a.x, b.x);
        body = fibLevels.map((level) => {
          const price = pb.price + (pa.price - pb.price) * level;
          const y = toPx({ time: pa.time, price }).y;
          return (
            <g key={level}>
              <line x1={left} y1={y} x2={right} y2={y} stroke={color} strokeWidth={level === 0.5 ? 1.5 : 1} strokeOpacity={level === 0 || level === 1 ? 1 : 0.7} />
              <text x={left + 4} y={y - 3} fill={color} {...labelProps}>
                {`${level} (${formatPrice(price)})`}
              </text>
              {hitLine(id, { x: left, y }, { x: right, y }, String(level))}
            </g>
          );
        });
        break;
      }
      case "measure": {
        const change = pa.price ? ((pb.price - pa.price) / pa.price) * 100 : 0;
        const tone = toneStroke[change >= 0 ? "positive" : "negative"];
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const label = `${formatChangePercent(change)} · ${formatPrice(pb.price - pa.price)} · ${t("youtubeOpinions.measureBars", {
          count: String(Math.abs(barsBetween(pa, pb))),
        })}`;
        body = (
          <>
            <rect
              data-drawing={id}
              x={x}
              y={y}
              width={Math.abs(b.x - a.x)}
              height={Math.abs(b.y - a.y)}
              fill={tone}
              fillOpacity={0.14}
              pointerEvents="all"
              className="cursor-move"
            />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={tone} strokeWidth={1.5} strokeDasharray="4 3" />
            <text
              x={(a.x + b.x) / 2}
              y={b.y + (b.y >= a.y ? 15 : -7)}
              textAnchor="middle"
              fill={tone}
              fontWeight={600}
              {...labelProps}
            >
              {label}
            </text>
          </>
        );
        break;
      }
    }

    return (
      <g key={preview ? "draft" : id} className={cn(preview && "opacity-80")}>
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

  return (
    <svg
      width={width}
      height={height}
      className={cn("absolute inset-0 overflow-hidden tabular-nums", !interactive && "pointer-events-none")}
      style={{ pointerEvents: interactive ? undefined : "none" }}
    >
      <g pointerEvents={interactive ? "auto" : "none"}>
        {drawings.map((drawing) => render(drawing, false))}
      </g>
      {draft && <g pointerEvents="none">{render(draft, true)}</g>}
    </svg>
  );
}
