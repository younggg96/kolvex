"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { toneStroke, type StrengthTone } from "./strength";

export interface StrengthPoint {
  date: string;
  value: number;
  count: number;
}

const WIDTH = 1000;
const HEIGHT = 200;
const PAD = 14;

function y(value: number) {
  const clamped = Math.max(-100, Math.min(100, value));
  return PAD + ((100 - clamped) / 200) * (HEIGHT - PAD * 2);
}

/**
 * Opinion strength over time on a fixed −100…+100 scale with no numeric axis.
 * Pointer or arrow keys scrub; the parent rewrites its headline from onScrub.
 */
export default function StrengthChart({
  points,
  tone,
  label,
  formatDate,
  onScrub,
}: {
  points: StrengthPoint[];
  tone: StrengthTone;
  label: string;
  formatDate: (date: string) => string;
  onScrub: (point: StrengthPoint | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const count = points.length;
  const x = (index: number) => (count === 1 ? WIDTH / 2 : (index / (count - 1)) * WIDTH);
  const path = points
    .map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(" ");
  const stroke = toneStroke[tone];

  function select(index: number | null) {
    setActive(index);
    onScrub(index === null ? null : points[index]);
  }

  function handlePointer(event: PointerEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !count) return;
    const ratio = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    select(count === 1 ? 0 : Math.round(ratio * (count - 1)));
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!count) return;
    const current = active ?? count - 1;
    if (event.key === "ArrowLeft") select(Math.max(current - 1, 0));
    else if (event.key === "ArrowRight") select(Math.min(current + 1, count - 1));
    else if (event.key === "Escape") select(null);
    else return;
    event.preventDefault();
  }

  const activePoint = active === null ? null : points[active];

  return (
    <div className="min-w-0">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.max(count - 1, 0)}
        aria-valuenow={active ?? count - 1}
        aria-valuetext={activePoint ? formatDate(activePoint.date) : undefined}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => select(null)}
        onKeyDown={handleKey}
        onBlur={() => select(null)}
        className="relative h-[150px] cursor-crosshair touch-pan-y select-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:h-[190px]"
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <line
            x1={0}
            x2={WIDTH}
            y1={y(0)}
            y2={y(0)}
            stroke="rgb(var(--foreground) / 0.18)"
            strokeDasharray="2 5"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          {count > 1 && (
            <path
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className={cn(active !== null && "opacity-40", "transition-opacity duration-150")}
            />
          )}
          {active !== null && count > 1 && (
            <path
              d={points
                .slice(0, active + 1)
                .map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`)
                .join(" ")}
              fill="none"
              stroke={stroke}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {activePoint && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-foreground/25"
            style={{ left: `${(x(active!) / WIDTH) * 100}%` }}
          />
        )}
        {count > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-background"
            style={{
              left: `${(x(active ?? count - 1) / WIDTH) * 100}%`,
              top: `${(y((activePoint ?? points[count - 1]).value) / HEIGHT) * 100}%`,
              backgroundColor: stroke,
            }}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{formatDate(points[0].date)}</span>
        {count > 1 && <span>{formatDate(points[count - 1].date)}</span>}
      </div>
    </div>
  );
}
