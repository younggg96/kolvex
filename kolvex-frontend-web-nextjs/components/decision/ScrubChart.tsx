"use client";

import { useMemo } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export interface ScrubPoint {
  date: string;
  value: number;
}

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
}: {
  data: ScrubPoint[];
  baseline?: number | null;
  positive: boolean;
  height?: number;
  onScrub: (point: ScrubPoint | null) => void;
  label: string;
}) {
  const stroke = positive ? POSITIVE : NEGATIVE;
  const domain = useMemo(() => {
    const values = data.map((point) => point.value);
    if (typeof baseline === "number" && Number.isFinite(baseline)) values.push(baseline);
    if (!values.length) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.1 || Math.abs(max) * 0.01 || 1;
    return [min - pad, max + pad];
  }, [data, baseline]);

  return (
    <div role="img" aria-label={label} style={{ height }} className="touch-pan-y select-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
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
            <ReferenceLine y={baseline} stroke="rgb(var(--foreground) / 0.22)" strokeDasharray="2 5" />
          )}
          <Line
            type="linear"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4.5, fill: stroke, stroke: "rgb(var(--background))", strokeWidth: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
