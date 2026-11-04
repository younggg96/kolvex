import { peekClientCache, writeClientCache } from "./clientCache";
import type { StockQuote } from "./stockApi";

export const quoteKey = (symbol: string) => `/api/stocks?action=quote&symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`;
const timestamp = (value?: number) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
// Quote lists can outgrow the general-purpose read cache. Retain a short, bounded
// observation ledger so eviction cannot let a late response roll prices back.
const observations = new Map<string, { quote: StockQuote; at: number }>();

/** Late batches must not roll a newer regular or extended-session observation back. */
export function publishQuote(incoming: StockQuote): StockQuote {
  const key = quoteKey(incoming.symbol);
  const known = observations.get(key);
  const saved = peekClientCache<StockQuote>(key) ?? (known && Date.now() - known.at < 60_000 ? known.quote : undefined);
  let quote = saved && timestamp(saved.marketTime) > timestamp(incoming.marketTime) ? { ...saved } : { ...incoming };
  for (const session of ["pre", "post"] as const) {
    const timeKey = `${session}MarketTime` as const;
    const priceKey = `${session}MarketPrice` as const;
    const newest = saved && timestamp(saved[timeKey]) > timestamp(incoming[timeKey]) ? saved : incoming;
    quote = { ...quote, [timeKey]: newest[timeKey], [priceKey]: newest[priceKey] };
  }
  if (typeof window !== "undefined") {
    observations.delete(key);
    if (observations.size >= 500) observations.delete(observations.keys().next().value!);
    observations.set(key, { quote, at: Date.now() });
  }
  writeClientCache(key, quote, 15_000, 60_000);
  return quote;
}
