export type ChartWindow = {
  count: number;
  offset: number;
  length: number;
  /** Fewest and most bars a window may show; the Web's advanced chart allows 8 to all. */
  min?: number;
  max?: number;
};
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export function normalizedWindow(value: ChartWindow): ChartWindow {
  const length = Math.max(0, Math.floor(value.length));
  const count = clamp(
    Math.round(value.count),
    Math.min(value.min ?? 15, length),
    Math.min(value.max ?? 240, length),
  );
  return {
    ...value,
    length,
    count,
    offset: clamp(Math.round(value.offset), 0, Math.max(0, length - count)),
  };
}
export function panWindow(
  value: ChartWindow,
  dx: number,
  width: number,
): ChartWindow {
  const current = normalizedWindow(value);
  if (!Number.isFinite(dx) || !Number.isFinite(width) || width <= 0)
    return current;
  return normalizedWindow({
    ...current,
    offset: current.offset + (dx / width) * current.count,
  });
}
export function pinchWindow(value: ChartWindow, ratio: number): ChartWindow {
  const current = normalizedWindow(value);
  if (!Number.isFinite(ratio) || ratio <= 0) return current;
  const next = normalizedWindow({ ...current, count: current.count / ratio });
  return normalizedWindow({
    ...next,
    offset: current.offset + (current.count - next.count) / 2,
  });
}
