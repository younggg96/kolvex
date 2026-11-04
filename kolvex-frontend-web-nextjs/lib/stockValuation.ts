export type ValuationScenario = "conservative" | "base" | "optimistic";
export const valuationScenarios: ValuationScenario[] = ["conservative", "base", "optimistic"];
export type Multiples = Record<ValuationScenario, number>;
export type ValuationPoint = {
  date: string; price: number; eps: number | null; pe: number | null; event_id: string; status: string;
  conservative: number | null; base: number | null; optimistic: number | null; premium_discount: number | null;
};
export type ValuationSource = { value: number; raw_value: number | null; filed: string; start: string; end: string; source_url: string; form: string };
export type ValuationEvent = { period_start: string | null; period_end: string | null; method: string | null; inputs: ValuationSource[]; status: string };
export type ValuationReference = { scenarios: Record<ValuationScenario, { reference_value: number; target_pe: number; comparison: { price_space: number; premium_discount: number } }> };
export interface StockValuation {
  symbol: string; as_of: string; currency: string; snapshot_id: string;
  current: ValuationEvent & { eps: number | null; price: number | null; price_date: string | null; pe: number | null; share_basis_status: string;
    reference: ValuationReference | null;
    calibration: { multiples: Multiples | null; percentile: number | null; sample_count: number; first_sample?: string; last_sample?: string } };
  points: ValuationPoint[]; events: Record<string, ValuationEvent>;
  basis: { status: string; policy_version: string; evidence?: string[] };
  supplements: { accepted: number; failures: { period_end: string; reason: string }[] };
}
export interface ValuationSimulation {
  snapshot_id: string; result_kind: "personal_simulation"; reference: ValuationReference;
  projections: { target_date: string; scenarios: Record<ValuationScenario, { target_price: number; price_space: number }> }[];
}

const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
  const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
  const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
  signal.addEventListener("abort", abort, { once: true });
});

export async function loadValuation(symbol: string, years: number, signal: AbortSignal, retry = false): Promise<StockValuation | { status: "unsupported" }> {
  const url = `/api/market/valuation/${encodeURIComponent(symbol)}/history?years=${years}${retry ? "&retry=true" : ""}`;
  const read = async (path: string) => {
    const response = await fetch(path, { signal });
    if (!response.ok) throw Object.assign(new Error("Valuation unavailable"), { status: response.status });
    return { response, data: await response.json() };
  };
  let result = await read(url);
  // Bounded wait; leaving the tab does not cancel the shared backend build.
  for (let attempt = 0; result.response.status === 202 && attempt < 100; attempt++) {
    await pause(3000, signal);
    const job = await read(`/api/market/valuation/jobs/${result.data.job_id}`);
    if (job.data.status === "failed") throw new Error("Valuation source unavailable");
    if (job.data.status === "complete") result = await read(url.replace("&retry=true", ""));
  }
  if (result.response.status === 202) throw new Error("Valuation build timed out");
  if (result.data.status === "unsupported") return result.data;
  if (result.data.symbol !== symbol.toUpperCase() || !Array.isArray(result.data.points) || !result.data.current || !result.data.snapshot_id)
    throw new Error("Invalid valuation response");
  return result.data;
}

export function projectionDates(asOf: string): string[] {
  const [year, month, day] = asOf.split("-").map(Number);
  return [3, 6, 9].map((months) => {
    const first = new Date(Date.UTC(year, month - 1 + months, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(day, last));
    return first.toISOString().slice(0, 10);
  });
}

export async function simulateValuation(symbol: string, snapshot: StockValuation, multiples: Multiples, growth: Multiples, signal: AbortSignal): Promise<ValuationSimulation> {
  const response = await fetch(`/api/market/valuation/${encodeURIComponent(symbol)}/simulate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ snapshot_id: snapshot.snapshot_id, multiples, growth, target_dates: projectionDates(snapshot.as_of) }),
  });
  if (!response.ok) throw Object.assign(new Error("Simulation unavailable"), { status: response.status });
  return response.json();
}

export function validateValuationAssumptions(multiples: Multiples, growth: Multiples): boolean {
  return valuationScenarios.every((key) => Number.isFinite(multiples[key]) && multiples[key] > 0 && multiples[key] <= 500 &&
    Number.isFinite(growth[key]) && growth[key] > -1 && growth[key] <= 5) &&
    multiples.conservative <= multiples.base && multiples.base <= multiples.optimistic;
}
