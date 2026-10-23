/**
 * Actual recent stock performance (today / 5 days / 1 month).
 * Mirrors lib/marketQuotes.ts: batching keeps slow symbols from holding up a
 * whole directory list, and a short per-symbol cache makes revisits instant.
 */

export interface StockPerformance {
  symbol: string;
  as_of: string;
  price: number;
  previous_close: number | null;
  change_1d_percent: number | null;
  change_5d_percent: number | null;
  change_1mo_percent: number | null;
}

const ENDPOINT = "/api/market/performance";
const CACHE_TTL_MS = 60_000;
const BATCH_SIZE = 24;
const CONCURRENCY = 2;
const BATCH_RETRY_DELAY_MS = 700;

type CacheEntry = { value: StockPerformance; expires: number };

const performanceCache = new Map<string, CacheEntry>();

function normalizeSymbols(symbols: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of symbols) {
    const symbol = raw.trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    normalized.push(symbol);
  }
  return normalized;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Only accept well-formed entries; `{"symbol":"BADX","error":"..."}` is skipped. */
function parseStockPerformance(value: unknown): StockPerformance | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.error) return null;
  const symbol =
    typeof record.symbol === "string" ? record.symbol.trim().toUpperCase() : "";
  const asOf = typeof record.as_of === "string" ? record.as_of : "";
  const price = finiteOrNull(record.price);
  if (!symbol || !asOf || price === null) return null;
  return {
    symbol,
    as_of: asOf,
    price,
    previous_close: finiteOrNull(record.previous_close),
    change_1d_percent: finiteOrNull(record.change_1d_percent),
    change_5d_percent: finiteOrNull(record.change_5d_percent),
    change_1mo_percent: finiteOrNull(record.change_1mo_percent),
  };
}

function inRequestOrder(
  ordered: string[],
  values: Record<string, StockPerformance>,
): Record<string, StockPerformance> {
  const result: Record<string, StockPerformance> = {};
  for (const symbol of ordered) {
    const value = values[symbol];
    if (value) result[symbol] = value;
  }
  return result;
}

/** Fresh cached performance for the requested tickers (in request order). */
export function getCachedStockPerformance(
  symbols: string[],
): Record<string, StockPerformance> {
  const now = Date.now();
  const result: Record<string, StockPerformance> = {};
  for (const symbol of normalizeSymbols(symbols)) {
    const entry = performanceCache.get(symbol);
    if (!entry) continue;
    if (entry.expires <= now) {
      performanceCache.delete(symbol);
      continue;
    }
    result[symbol] = entry.value;
  }
  return result;
}

export function clearStockPerformanceCache(): void {
  performanceCache.clear();
}

/**
 * Load performance for the requested tickers.
 *
 * Fresh cache entries are returned without a network request. Missing symbols
 * are fetched in batches of at most 24 (one backend bulk download) with 2
 * concurrent workers, so the server-side yfinance work stays serialized and
 * the earliest (top-row) tickers resolve first. A batch that fails (for
 * example a 503 after the proxy timeout) is retried once before being
 * skipped. `onBatch` fires with each batch of newly received entries as it
 * arrives. The resolved record follows the input ticker order. Only a total
 * failure with nothing loaded rejects.
 */
export async function loadStockPerformance(
  symbols: string[],
  {
    signal,
    onBatch,
  }: {
    signal: AbortSignal;
    onBatch?: (batch: Record<string, StockPerformance>) => void;
  },
): Promise<Record<string, StockPerformance>> {
  const requested = normalizeSymbols(symbols);
  const loaded = getCachedStockPerformance(requested);
  if (signal.aborted) return loaded;

  const missing = requested.filter((symbol) => !loaded[symbol]);
  if (!missing.length) return inRequestOrder(requested, loaded);

  const batches: string[][] = [];
  for (let index = 0; index < missing.length; index += BATCH_SIZE) {
    batches.push(missing.slice(index, index + BATCH_SIZE));
  }

  let next = 0;
  let failures = 0;

  function delay(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }

  /** One batch request with a single retry; returns parsed entries or null. */
  async function requestBatch(batch: string[]) {
    const searchParams = new URLSearchParams();
    for (const symbol of batch) searchParams.append("symbols", symbol);
    const url = `${ENDPOINT}?${searchParams.toString()}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (signal.aborted) return null;
      try {
        const response = await fetch(url, { signal });
        if (response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          const stocks = (payload as { stocks?: unknown } | null)?.stocks;
          if (stocks && typeof stocks === "object" && !Array.isArray(stocks)) {
            const received: Record<string, StockPerformance> = {};
            const expires = Date.now() + CACHE_TTL_MS;
            for (const symbol of batch) {
              const entry = parseStockPerformance(
                (stocks as Record<string, unknown>)[symbol],
              );
              if (!entry) continue;
              received[symbol] = entry;
              performanceCache.set(symbol, { value: entry, expires });
            }
            if (Object.keys(received).length) return received;
          }
        }
      } catch {
        if (signal.aborted) return null;
      }
      if (attempt === 0) await delay(BATCH_RETRY_DELAY_MS);
    }
    return null;
  }

  async function worker() {
    while (!signal.aborted && next < batches.length) {
      const batch = batches[next++];
      const received = await requestBatch(batch);
      if (signal.aborted) return;
      if (!received) {
        failures += 1;
        continue;
      }
      Object.assign(loaded, received);
      onBatch?.(received);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker),
  );

  const result = inRequestOrder(requested, loaded);
  if (!signal.aborted && failures > 0 && !Object.keys(result).length) {
    throw new Error("Stock performance unavailable");
  }
  return result;
}
