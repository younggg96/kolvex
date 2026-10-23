import type { StockQuote } from "./stockApi";

/** Keep slow or unavailable symbols from holding up an entire coverage list. */
export async function loadMarketQuotes(
  symbols: string[],
  signal: AbortSignal,
  onBatch: (quotes: Record<string, StockQuote>) => void,
) {
  const requested = [...new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean))];
  const batches: string[][] = [];
  for (let index = 0; index < requested.length; index += 5) batches.push(requested.slice(index, index + 5));
  const quotes: Record<string, StockQuote> = {};
  let next = 0;
  async function worker() {
    while (!signal.aborted && next < batches.length) {
      const batch = batches[next++];
      try {
        const response = await fetch(`/api/stocks?action=multiple&symbols=${encodeURIComponent(batch.join(","))}`, { signal });
        const data: unknown = await response.json();
        if (!response.ok || !Array.isArray(data)) continue;
        const received: Record<string, StockQuote> = {};
        for (const quote of data as StockQuote[]) {
          if (quote && batch.includes(quote.symbol) && Number.isFinite(quote.price) && quote.price > 0) received[quote.symbol] = quote;
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
  return { quotes, unavailable: requested.some(symbol => !quotes[symbol]) };
}
