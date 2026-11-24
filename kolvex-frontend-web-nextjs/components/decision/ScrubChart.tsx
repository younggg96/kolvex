"use client";

import { useMemo } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export interface ScrubPoint {
  date: string;
  value: number;
  /** Intraday US session; pre-market, after-hours and overnight runs draw at half opacity. */
  session?: "regular" | "pre" | "post" | "overnight";
}

type ChartPoint = ScrubPoint & { regular: number | null; extended: number | null };

const isExtended = (point?: ScrubPoint) => Boolean(point?.session && point.session !== "regular");

const POSITIVE = "rgb(var(--positive-fill))";
const NEGATIVE = "rgb(var(--negative-fill))";

/** Axis-free line in the direction colour; hovering or dragging reports the point to the headline. */
export default function ScrubChart({
  data,
  baseline,
  positive,
  height = 220,
  onScrub,
  label,
  tone = "direction",
}: {
  data: ScrubPoint[];
  baseline?: number | null;
  positive: boolean;
  height?: number | string;
  onScrub: (point: ScrubPoint | null) => void;
  label: string;
  tone?: "direction" | "neutral";
}) {
  const stroke =
    tone === "neutral" ? "rgb(var(--foreground) / 0.7)" : positive ? POSITIVE : NEGATIVE;
  const domain = useMemo(() => {
    const values = data.map((point) => point.value);
    if (typeof baseline === "number" && Number.isFinite(baseline)) values.push(baseline);
    if (!values.length) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.1 || Math.abs(max) * 0.01 || 1;
    return [min - pad, max + pad];
  }, [data, baseline]);
  // Split the line by session; the extended run includes the regular point it joins.
  const points = useMemo<ChartPoint[]>(
    () =>
      data.map((point, index) => ({
        ...point,
        regular: isExtended(point) ? null : point.value,
        extended:
          isExtended(point) || isExtended(data[index + 1]) || isExtended(data[index - 1])
            ? point.value
            : null,
      })),
    [data],
  );
  const hasExtended = points.some((point) => isExtended(point));

  return (
    <div role="img" aria-label={label} style={{ height }} className="touch-pan-y select-none">
      <ResponsiveContainer width="100%" height="100%" className="!bg-transparent">
        <LineChart
          data={points}
          margin={{ top: 8, right: 2, left: 2, bottom: 8 }}
          onMouseMove={(state) => {
            const point = state?.activePayload?.[0]?.payload as ScrubPoint | undefined;
            onScrub(point ?? null);
          }}
          onMouseLeave={() => onScrub(null)}
        >
          <YAxis hide domain={domain} />
          <Tooltip
            content={() => null}
            cursor={{ stroke: "rgb(var(--foreground) / 0.25)", strokeWidth: 1 }}
            isAnimationActive={false}
          />
          {typeof baseline === "number" && Number.isFinite(baseline) && (
            <ReferenceLine
              y={baseline}
              stroke="rgb(var(--foreground) / 0.22)"
              strokeDasharray="2 5"
            />
          )}
          {hasExtended && (
            <Line
              type="linear"
              dataKey="extended"
              stroke={stroke}
              strokeOpacity={0.45}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4.5, fill: stroke, stroke: "rgb(var(--background))", strokeWidth: 3 }}
              isAnimationActive={false}
            />
          )}
          <Line
            type="linear"
            dataKey={hasExtended ? "regular" : "value"}
            stroke={stroke}
            strokeWidth={2}
            dot={data.length === 1 ? { r: 3, fill: stroke } : false}
            activeDot={{ r: 4.5, fill: stroke, stroke: "rgb(var(--background))", strokeWidth: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
