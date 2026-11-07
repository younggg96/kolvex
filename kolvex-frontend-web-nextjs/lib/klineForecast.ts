/** Kronos K-line forecast (experimental): median candles plus a P10–P90 closing-price band. */
export interface ForecastPoint {
  date: string;
  open: number; high: number; low: number; close: number;
  close_p10: number; close_p90: number;
  volume: number;
}

export interface KlineForecast {
  symbol: string;
  model: string;
  interval: "1d" | "1wk";
  horizon: number;
  samples: number;
  lookback: number;
  /** Date of the last bar the model saw (YYYY-MM-DD, exchange time). */
  context_end: string;
  last_close: number;
  points: ForecastPoint[];
  summary: { median_return: number; p10_return: number; p90_return: number; prob_up: number };
}

export const FORECAST_HORIZON = 20;
export const forecastIntervals = ["1d", "1wk"] as const;

export const klineForecastKey = (symbol: string, interval: string, horizon = FORECAST_HORIZON) =>
  `/api/market/forecast/${encodeURIComponent(symbol)}?interval=${interval}&horizon=${horizon}`;

export async function getKlineForecast(symbol: string, interval: string, signal?: AbortSignal): Promise<KlineForecast> {
  const response = await fetch(klineForecastKey(symbol, interval), { signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error || "unavailable"), { status: response.status, code: data?.error || "unavailable" });
  return data as KlineForecast;
}

/** Lowest P10 and highest P90, so the price scale can make room for the band. */
export function forecastExtent(forecast: KlineForecast | null | undefined): { lo: number; hi: number } | null {
  if (!forecast?.points.length) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const point of forecast.points) {
    lo = Math.min(lo, point.close_p10, point.low);
    hi = Math.max(hi, point.close_p90, point.high);
  }
  return Number.isFinite(lo) ? { lo, hi } : null;
}
