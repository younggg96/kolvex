import type { PriceBar } from "./technicalTypes";
export function validBars(input: unknown): PriceBar[] {
  if (!Array.isArray(input)) throw new Error("K 线格式无效，请重试。");
  return input
    .filter(
      (bar): bar is PriceBar =>
        !!bar &&
        typeof bar.date === "string" &&
        Number.isFinite(Date.parse(bar.date)) &&
        [bar.open, bar.high, bar.low, bar.close].every(
          (v) => typeof v === "number" && Number.isFinite(v),
        ) &&
        bar.high >= Math.max(bar.open, bar.close, bar.low) &&
        bar.low <= Math.min(bar.open, bar.close),
    )
    .map((bar) => ({
      ...bar,
      volume:
        typeof bar.volume === "number" &&
        Number.isFinite(bar.volume) &&
        bar.volume >= 0
          ? bar.volume
          : null,
    }));
}
export function calendarDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
