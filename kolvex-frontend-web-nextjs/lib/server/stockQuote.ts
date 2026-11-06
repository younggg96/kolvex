import { CACHE_TTL, getCacheKey, quoteCache } from "@/lib/cache";

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";

export interface BackendQuote {
  symbol: string;
  name?: string;
  current_price?: number;
  change?: number;
  change_percent?: number;
  open?: number;
  day_high?: number;
  day_low?: number;
  volume?: number;
  avg_volume?: number;
  market_cap?: number;
  previous_close?: number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  market_time?: number;
  market_state?: string;
  quote_source?: string;
  exchange_timezone_name?: string;
  pre_market_price?: number;
  pre_market_time?: number;
  post_market_price?: number;
  post_market_time?: number;
}

export function transformQuote(quote: BackendQuote) {
  return {
    symbol: quote.symbol,
    name: quote.name || quote.symbol,
    price: quote.current_price ?? 0,
    change: quote.change ?? 0,
    changePercent: quote.change_percent ?? 0,
    open: quote.open,
    high: quote.day_high,
    low: quote.day_low,
    volume: quote.volume,
    avgVolume: quote.avg_volume,
    marketCap: quote.market_cap,
    previousClose: quote.previous_close,
    week52High: quote.fifty_two_week_high,
    week52Low: quote.fifty_two_week_low,
    marketTime: quote.market_time,
    updatedAt: typeof quote.market_time === "number" && Number.isFinite(quote.market_time) && quote.market_time > 0
      ? new Date(quote.market_time * 1000).toISOString() : undefined,
    marketState: quote.market_state,
    source: quote.quote_source,
    exchangeTimezone: quote.exchange_timezone_name,
    preMarketPrice: quote.pre_market_price,
    preMarketTime: quote.pre_market_time,
    postMarketPrice: quote.post_market_price,
    postMarketTime: quote.post_market_time,
  };
}

export type ServerQuote = ReturnType<typeof transformQuote>;

/** Single quote through the shared in-memory cache; throws when the backend has no usable price. */
export async function loadQuote(symbol: string, timeoutMs = 20_000): Promise<ServerQuote> {
  const key = getCacheKey("quote", symbol);
  const cached = quoteCache.get<ServerQuote>(key);
  if (cached) return cached;
  const response = await fetch(`${BACKEND_API_URL}/api/v1/market/quote/${encodeURIComponent(symbol)}`, {
    // force-dynamic does not stop Next's Data Cache, which never expires here.
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  const data: BackendQuote = await response.json();
  if (typeof data.current_price !== "number" || !Number.isFinite(data.current_price) || data.current_price <= 0) {
    throw new Error("Market price unavailable");
  }
  const quote = transformQuote(data);
  quoteCache.set(key, quote, CACHE_TTL.QUOTE);
  return quote;
}
