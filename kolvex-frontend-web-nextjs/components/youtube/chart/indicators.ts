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

/** Wilder RSI: warm up with `period` changes, then use Wilder smoothing.
 * A completely flat window is neutral (50), rather than overbought (100).
 */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    gain += Math.max(delta, 0) / period;
    loss += Math.max(-delta, 0) / period;
  }
  const value = () => loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
  out[period] = value();
  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(delta, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-delta, 0)) / period;
    out[i] = value();
  }
  return out;
}

/** MACD (12,26,9). Histogram is DIF - DEA, without the optional 2x scaling. */
export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const fastLine = ema(values, fast), slowLine = ema(values, slow);
  const dif = values.map((_, i) => fastLine[i] === null || slowLine[i] === null ? null : fastLine[i]! - slowLine[i]!);
  const first = Math.max(fast, slow) - 1;
  const signal = ema(dif.slice(first) as number[], signalPeriod);
  const dea: Series = dif.map((_, i) => i < first ? null : signal[i - first]);
  const histogram = dif.map((v, i) => v === null || dea[i] === null ? null : v - dea[i]!);
  return { dif, dea, histogram };
}

/** KDJ (9,3,3): full-window RSV, recursive K/D seeded at 50, J = 3K - 2D.
 * Flat high/low windows use neutral RSV=50. J is intentionally not clamped.
 */
export function kdj(bars: PriceBar[], period = 9, smoothK = 3, smoothD = 3) {
  const k: Series = new Array(bars.length).fill(null);
  const d: Series = new Array(bars.length).fill(null);
  const j: Series = new Array(bars.length).fill(null);
  let previousK = 50, previousD = 50;
  for (let i = period - 1; i < bars.length; i++) {
    let high = -Infinity, low = Infinity;
    for (let n = i - period + 1; n <= i; n++) {
      high = Math.max(high, bars[n].high);
      low = Math.min(low, bars[n].low);
    }
    const rsv = high === low ? 50 : (bars[i].close - low) / (high - low) * 100;
    previousK = (previousK * (smoothK - 1) + rsv) / smoothK;
    previousD = (previousD * (smoothD - 1) + previousK) / smoothD;
    k[i] = previousK; d[i] = previousD; j[i] = 3 * previousK - 2 * previousD;
  }
  return { k, d, j };
}
