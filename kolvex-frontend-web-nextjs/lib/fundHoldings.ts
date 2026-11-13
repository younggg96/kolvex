import { loadClientCache } from "./clientCache";

export type FundHolding = { symbol: string | null; name: string | null; weight: number };

/** Top holdings by weight (0–1), largest first. Empty for funds that do not publish equity holdings. */
export function loadFundHoldings(symbol: string, options: { force?: boolean; signal?: AbortSignal } = {}) {
  const key = `fund-holdings:${symbol.toUpperCase()}`;
  return loadClientCache<FundHolding[]>(key, async signal => {
    const response = await fetch(`/api/market/fund-holdings/${encodeURIComponent(symbol)}`, { signal });
    if (!response.ok) throw Object.assign(new Error("Holdings unavailable"), { status: response.status });
    const data = await response.json();
    if (!Array.isArray(data?.holdings)) throw new Error("Invalid holdings response");
    return (data.holdings as FundHolding[])
      .filter(item => item && Number.isFinite(item.weight) && item.weight > 0 && (item.symbol || item.name))
      .sort((a, b) => b.weight - a.weight);
  }, { ttl: 60 * 60_000, ...options });
}
