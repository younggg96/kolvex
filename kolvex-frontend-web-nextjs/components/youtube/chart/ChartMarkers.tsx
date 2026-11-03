"use client";

/**
 * Small, self-contained overlays shared by the compact preview and the advanced chart.
 *
 * Every export here positions ABSOLUTELY inside the caller's plot container and is
 * `pointer-events-none` / `aria-hidden`, so the caller keeps owning hit-testing, focus and
 * screen-reader text. Coordinates are CSS pixels relative to that container.
 *
 * Consumers: `ChartView` (advanced) and `PriceGraph` (compact + advanced).
 */
import { cn } from "@/lib/utils";
import { toneStroke } from "../strength";

export type MarkerDirection = "up" | "down" | "dot";
export type ExtremeSide = "high" | "low";

/**
 * A creator's call on one bar: a green ▲ above the low, a red ▼ above the high, or a grey
 * dot for neutral/mixed calls. The count is shown when a bar carries more than one call.
 */
export function CallMarker({
  direction,
  count,
  x,
  y,
}: {
  direction: MarkerDirection;
  count: number;
  x: number;
  y: number;
}) {
  const color = toneStroke[direction === "up" ? "positive" : direction === "down" ? "negative" : "neutral"];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute flex -translate-x-1/2 items-center gap-px text-[0.625rem] font-semibold leading-none tabular-nums",
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
 * The window's high/low as a quiet floating label (`$350.78`), the way Finsepa/Apple Stocks
 * mark extremes — no `H:`/`L:` prefix and no box, just a hairline bubble over the peak or
 * under the trough.
 *
 * - `label` replaces the formatted value when the caller needs a caption (e.g. the range total).
 * - `clamp` keeps the bubble inside the plot near the left/right edges; pass the plot width
 *   when the extreme sits at the very edge.
 */
export function ExtremeTag({
  side,
  value,
  x,
  y,
  label,
  clamp,
}: {
  side: ExtremeSide;
  value: number;
  x: number;
  y: number;
  /** Optional caption rendered before the value. */
  label?: string;
  /** Plot width in px; when given, the bubble is nudged so it never overflows. */
  clamp?: number;
}) {
  const text = label ?? (Number.isFinite(value) ? value.toFixed(2) : "—");
  const edge = clamp === undefined ? undefined : Math.min(Math.max(x, 42), Math.max(clamp - 42, 42));
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md border border-border/70 bg-background/90 px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums text-foreground/80 shadow-[0_1px_2px_rgb(var(--foreground)/0.06)] backdrop-blur-sm",
        side === "high" ? "-translate-y-full" : "-translate-y-0",
      )}
      style={{ left: edge ?? x, top: y }}
    >
      {text}
    </span>
  );
}

/**
 * The right-axis price tag (the filled pill Apple Stocks pins to the last close).
 * `tone` drives the fill so a red day reads red without a second prop deciding the colour.
 */
export function PriceTag({
  value,
  x,
  y,
  tone = "neutral",
  decimals,
}: {
  value: number;
  x: number;
  y: number;
  tone?: "positive" | "negative" | "neutral";
  decimals?: number;
}) {
  const text = Number.isFinite(value)
    ? value.toFixed(decimals ?? (Math.abs(value) >= 1000 ? 0 : 2))
    : "—";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -translate-y-1/2 rounded-[0.3125rem] px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums",
        tone === "neutral" ? "bg-foreground text-background" : "text-white",
      )}
      style={{
        left: x,
        top: y,
        backgroundColor:
          tone === "positive" ? "rgb(var(--chart-up))" : tone === "negative" ? "rgb(var(--chart-down))" : undefined,
      }}
    >
      {text}
    </span>
  );
}
