// Stock-page reads added after the first migration pass: the full options chain,
// PE-reference valuation, AI fundamentals and the experimental Kronos forecast.
import { ApiError, apiRequest, apiResponse } from "./http";
import { optionsChainKey, type OptionsChain } from "./optionsChain";

const encoded = encodeURIComponent;
/** A failure the screen words itself, keyed by the backend's code. */
export class CodedError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const coded = (error: unknown, map: (e: ApiError) => string): never => {
  if (error instanceof ApiError) throw new CodedError(map(error));
  throw error;
};

/** The options feed is licensed per signed-in user: always send the session. */
export async function optionsChain(
  symbol: string,
  expiration: string | null,
  user: string,
  signal: AbortSignal,
): Promise<OptionsChain> {
  try {
    const data = await apiRequest<OptionsChain>(
      optionsChainKey(symbol, expiration).replace(/^\/api/, ""),
      { signal, authenticated: true, expectedUser: user, timeout: 45_000 },
    );
    if (data?.symbol !== symbol.toUpperCase() || !Array.isArray(data.contracts))
      throw new CodedError("unavailable");
    return data;
  } catch (error) {
    return coded(error, (e) =>
      // FastAPI's bare "Not Found" means a backend without this route.
      e.status === 404 && e.detail && e.detail !== "Not Found"
        ? "no_options"
        : e.detail === "options_data_not_configured"
          ? "not_configured"
          : e.status === 429
            ? "rate_limited"
            : e.status === 401
              ? "unauthorized"
              : "unavailable",
    );
  }
}

export type ValuationScenario = "conservative" | "base" | "optimistic";
export const valuationScenarios: ValuationScenario[] = [
  "conservative",
  "base",
  "optimistic",
];
export type Multiples = Record<ValuationScenario, number>;
export type ValuationPoint = {
  date: string;
  price: number;
  eps: number | null;
  pe: number | null;
  event_id: string;
  status: string;
  conservative: number | null;
  base: number | null;
  optimistic: number | null;
  premium_discount: number | null;
};
export type ValuationSource = {
  value: number;
  raw_value: number | null;
  filed: string;
  start: string;
  end: string;
  source_url: string;
  form: string;
};
export type ValuationEvent = {
  period_start: string | null;
  period_end: string | null;
  method: string | null;
  inputs: ValuationSource[];
  status: string;
};
export type ValuationReference = {
  scenarios: Record<
    ValuationScenario,
    {
      reference_value: number;
      target_pe: number;
      comparison: { price_space: number; premium_discount: number };
    }
  >;
};
export interface StockValuation {
  symbol: string;
  as_of: string;
  currency: string;
  snapshot_id: string;
  current: ValuationEvent & {
    eps: number | null;
    price: number | null;
    price_date: string | null;
    pe: number | null;
    share_basis_status: string;
    reference: ValuationReference | null;
    calibration: {
      multiples: Multiples | null;
      percentile: number | null;
      sample_count: number;
      first_sample?: string;
      last_sample?: string;
    };
  };
  points: ValuationPoint[];
  events: Record<string, ValuationEvent>;
  basis: { status: string; policy_version: string; evidence?: string[] };
}
export interface ValuationSimulation {
  snapshot_id: string;
  result_kind: "personal_simulation";
  reference: ValuationReference;
  projections: {
    target_date: string;
    scenarios: Record<
      ValuationScenario,
      { target_price: number; price_space: number }
    >;
  }[];
}
const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const abort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
/**
 * The first read of a company can start a shared backend build (202 + job id).
 * The wait is bounded; leaving the screen does not cancel that build.
 */
export async function loadValuation(
  symbol: string,
  years: number,
  signal: AbortSignal,
): Promise<StockValuation | { status: "unsupported" }> {
  const path = `/valuation/${encoded(symbol)}/history?years=${years}`;
  const read = async (target: string) => {
    const response = await apiResponse(target, { signal, timeout: 60_000 });
    return { status: response.status, data: await response.json() };
  };
  let result = await read(`${path}&retry=true`);
  for (let attempt = 0; result.status === 202 && attempt < 100; attempt++) {
    await pause(3000, signal);
    const job = await read(`/valuation/jobs/${result.data.job_id}`);
    if (job.data.status === "failed") throw new Error("估值数据源暂不可用。");
    if (job.data.status === "complete") result = await read(path);
  }
  if (result.status === 202) throw new Error("估值计算超时，请稍后重试。");
  if (result.data.status === "unsupported") return result.data;
  if (
    result.data.symbol !== symbol.toUpperCase() ||
    !Array.isArray(result.data.points) ||
    !result.data.current ||
    !result.data.snapshot_id
  )
    throw new Error("估值数据格式无效，请重试。");
  return result.data;
}
export function projectionDates(asOf: string): string[] {
  const [year, month, day] = asOf.split("-").map(Number);
  return [3, 6, 9].map((months) => {
    const first = new Date(Date.UTC(year, month - 1 + months, 1));
    const last = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    first.setUTCDate(Math.min(day, last));
    return first.toISOString().slice(0, 10);
  });
}
export const simulateValuation = (
  snapshot: StockValuation,
  multiples: Multiples,
  growth: Multiples,
  signal: AbortSignal,
) =>
  apiRequest<ValuationSimulation>(
    `/valuation/${encoded(snapshot.symbol)}/simulate`,
    {
      method: "POST",
      signal,
      body: {
        snapshot_id: snapshot.snapshot_id,
        multiples,
        growth,
        target_dates: projectionDates(snapshot.as_of),
      },
    },
  );
export function validateValuationAssumptions(
  multiples: Multiples,
  growth: Multiples,
): boolean {
  return (
    valuationScenarios.every(
      (key) =>
        Number.isFinite(multiples[key]) &&
        multiples[key] > 0 &&
        multiples[key] <= 500 &&
        Number.isFinite(growth[key]) &&
        growth[key] > -1 &&
        growth[key] <= 5,
    ) &&
    multiples.conservative <= multiples.base &&
    multiples.base <= multiples.optimistic
  );
}

export type DimensionKey =
  | "profitability"
  | "growth"
  | "financial_health"
  | "cash_flow"
  | "valuation"
  | "shareholder_returns"
  | "risk_performance";
export type Rating =
  "strong" | "solid" | "mixed" | "weak" | "insufficient_data";
export interface AiFundamentalsResult {
  symbol: string;
  model_id: string;
  locale: string;
  generated_at: string;
  summary: string;
  dimensions: {
    key: DimensionKey;
    rating: Rating;
    headline: string;
    evidence: string[];
  }[];
  strengths: string[];
  concerns: string[];
  watch_items: string[];
}
/** Runs the reader's own model; only ever called from an explicit press. */
export async function aiFundamentals(
  symbol: string,
  body: { model: string; locale: string; regenerate: boolean },
  user: string,
  signal: AbortSignal,
): Promise<AiFundamentalsResult> {
  try {
    return await apiRequest<AiFundamentalsResult>(
      `/market/ai-fundamentals/${encoded(symbol)}`,
      {
        method: "POST",
        body,
        signal,
        authenticated: true,
        expectedUser: user,
        timeout: 130_000,
      },
    );
  } catch (error) {
    return coded(error, (e) =>
      e.status === 401 ? "Unauthorized" : (e.detail ?? "ai_unavailable"),
    );
  }
}

/** Kronos forecast (experimental): median candles plus a P10–P90 closing band. */
export interface KlineForecast {
  symbol: string;
  model: string;
  interval: "1d" | "1wk";
  horizon: number;
  samples: number;
  lookback: number;
  context_end: string;
  last_close: number;
  points: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    close_p10: number;
    close_p90: number;
    volume: number;
  }[];
  summary: {
    median_return: number;
    p10_return: number;
    p90_return: number;
    prob_up: number;
  };
}
export const FORECAST_HORIZON = 20;
export async function klineForecast(
  symbol: string,
  interval: string,
  user: string,
  signal: AbortSignal,
): Promise<KlineForecast> {
  try {
    const data = await apiRequest<KlineForecast>(
      `/market/forecast/${encoded(symbol)}?interval=${interval}&horizon=${FORECAST_HORIZON}`,
      { signal, authenticated: true, expectedUser: user, timeout: 130_000 },
    );
    if (data?.symbol !== symbol.toUpperCase() || !Array.isArray(data.points))
      throw new CodedError("unavailable");
    return data;
  } catch (error) {
    return coded(error, (e) =>
      e.detail === "forecast_not_configured"
        ? "not_configured"
        : e.status === 401
          ? "unauthorized"
          : "unavailable",
    );
  }
}
