import { loadClientCache } from "./clientCache";
import type { MarketObservation } from "./marketObservations";

export function marketObservationsKey(symbol: string) {
  return `/api/market/observations/${encodeURIComponent(symbol)}`;
}

export function loadMarketObservations(symbol: string, signal: AbortSignal, force = false): Promise<MarketObservation[]> {
  const key = marketObservationsKey(symbol);
  return loadClientCache(key, async requestSignal => {
    const response = await fetch(key, { signal: requestSignal });
    if (!response.ok) throw Object.assign(new Error("Observations unavailable"), { status: response.status });
    const data = await response.json();
    if (!Array.isArray(data.history)) throw new Error("Invalid observations");
    return data.history;
  }, { ttl: 5 * 60_000, maxAge: 15 * 60_000, force, signal });
}
