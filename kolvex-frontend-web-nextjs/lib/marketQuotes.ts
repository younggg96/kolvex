import { loadClientCache, peekClientCache, writeClientCache } from "./clientCache";
import type { StockQuote } from "./stockApi";

export function getCachedMarketQuotes(symbols: string[]) {
  const quotes: Record<string, StockQuote> = {};
  for (const symbol of symbols) {
    const quote = peekClientCache<StockQuote>(`/api/stocks?action=quote&symbol=${encodeURIComponent(symbol)}`);
    if (quote) quotes[symbol] = quote;
  }
  return quotes;
}

/** Keep slow or unavailable symbols from holding up an entire coverage list. */
export async function loadMarketQuotes(
  symbols: string[],
  signal: AbortSignal,
  onBatch: (quotes: Record<string, StockQuote>) => void,
  force = false,
) {
  const requested = [...new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean))];
  const quotes = getCachedMarketQuotes(requested);
  if (!signal.aborted && Object.keys(quotes).length) onBatch(quotes);
  const fresh = new Set(force ? [] : requested.filter(symbol => peekClientCache(`/api/stocks?action=quote&symbol=${encodeURIComponent(symbol)}`, true)));
  const missing = requested.filter(symbol => !fresh.has(symbol));
  const batches: string[][] = [];
  for (let index = 0; index < missing.length; index += 5) batches.push(missing.slice(index, index + 5));
  let next = 0;
  async function worker() {
    while (!signal.aborted && next < batches.length) {
      const batch = batches[next++];
      try {
        const key = `/api/stocks?action=multiple&symbols=${encodeURIComponent([...batch].sort().join(","))}`;
        const data = await loadClientCache<StockQuote[]>(key, async requestSignal => {
          const response = await fetch(key, { signal: requestSignal });
          const result = await response.json();
          if (!response.ok || !Array.isArray(result) || !result.length) throw new Error("Quotes unavailable");
          return result;
        }, { ttl: 15_000, maxAge: 60_000, force, signal });
        const received: Record<string, StockQuote> = {};
        for (const quote of data as StockQuote[]) {
          if (quote && batch.includes(quote.symbol) && Number.isFinite(quote.price) && quote.price > 0) {
            received[quote.symbol] = quote;
            fresh.add(quote.symbol);
            writeClientCache(`/api/stocks?action=quote&symbol=${encodeURIComponent(quote.symbol)}`, quote, 15_000, 60_000);
          }
        }
        if (signal.aborted) return;
        Object.assign(quotes, received);
        if (Object.keys(received).length) onBatch(received);
      } catch {
        if (signal.aborted) return;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));
  return { quotes, unavailable: requested.some(symbol => !fresh.has(symbol)) };
}
