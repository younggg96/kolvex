import type { PriceBar } from "@/lib/stockApi";

export type IndicatorKey = "volume" | "vwap" | "ema5" | "ema20" | "ema50" | "ema200" | "bb";
export type Series = Array<number | null>;

export const indicatorMeta: Record<IndicatorKey, { label: string; color: string }> = {
  volume: { label: "Volume", color: "rgb(var(--muted-foreground))" },
  vwap: { label: "VWAP", color: "rgb(236 72 153)" },
  ema5: { label: "EMA (5)", color: "rgb(20 184 166)" },
  ema20: { label: "EMA (20)", color: "rgb(168 85 247)" },
  ema50: { label: "EMA (50)", color: "rgb(59 130 246)" },
  ema200: { label: "EMA (200)", color: "rgb(125 175 205)" },
  bb: { label: "BB (20, 2)", color: "rgb(148 163 184)" },
};

export const indicatorOrder: IndicatorKey[] = ["volume", "vwap", "ema5", "ema20", "ema50", "ema200", "bb"];

/** Seeded with the simple average of the first `period` values; earlier points stay empty. */
export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  out[period - 1] = current;
  for (let index = period; index < values.length; index++) {
    current = values[index] * k + current * (1 - k);
    out[index] = current;
  }
  return out;
}

/** Intraday VWAP resets each session; on daily and longer bars it is anchored to the `anchor` bar. */
export function vwap(bars: PriceBar[], intraday: boolean, anchor = 0): Series {
  let session = "";
  let priceVolume = 0;
  let volume = 0;
  return bars.map((bar, index) => {
    if (!intraday && index < anchor) return null;
    const day = bar.date.slice(0, 10);
    if (intraday && day !== session) {
      session = day;
      priceVolume = 0;
      volume = 0;
    }
    const weight = bar.volume || 0;
    priceVolume += ((bar.high + bar.low + bar.close) / 3) * weight;
    volume += weight;
    return volume ? priceVolume / volume : null;
  });
}

export function bollinger(values: number[], period = 20, width = 2) {
  const middle: Series = [];
  const upper: Series = [];
  const lower: Series = [];
  for (let index = 0; index < values.length; index++) {
    if (index < period - 1) {
      middle.push(null);
      upper.push(null);
      lower.push(null);
      continue;
    }
    const window = values.slice(index - period + 1, index + 1);
    const mean = window.reduce((sum, value) => sum + value, 0) / period;
    const deviation = Math.sqrt(window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period);
    middle.push(mean);
    upper.push(mean + width * deviation);
    lower.push(mean - width * deviation);
  }
  return { middle, upper, lower };
}

export function computeIndicators(bars: PriceBar[], intraday: boolean, vwapAnchor = 0) {
  const closes = bars.map((bar) => bar.close);
  return {
    vwap: vwap(bars, intraday, vwapAnchor),
    ema5: ema(closes, 5),
    ema20: ema(closes, 20),
    ema50: ema(closes, 50),
    ema200: ema(closes, 200),
    bb: bollinger(closes),
  };
}

export type IndicatorValues = ReturnType<typeof computeIndicators>;
