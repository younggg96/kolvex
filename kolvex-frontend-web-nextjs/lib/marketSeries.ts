import { loadClientCache } from "./clientCache";
import type { MarketInstrument } from "./marketBenchmarks";
import { MARKET_RANGES, observationRange, type MarketObservation } from "./marketObservations";
import { loadMarketObservations } from "./marketObservationsApi";
import { loadStockTrend } from "./stockTrends";

export type MarketRangeKey = (typeof MARKET_RANGES)[number]["key"];

export const marketSeriesKey = (symbol: string, range: MarketRangeKey) => `/market-series/${symbol}/${range}`;

/** One range of one instrument, shared by the trend cards and the comparison chart. */
export function loadMarketSeries(instrument: MarketInstrument, range: MarketRangeKey, options: { force?: boolean; signal?: AbortSignal } = {}): Promise<MarketObservation[]> {
  const spec = MARKET_RANGES.find(item => item.key === range)!;
  const force = options.force ?? false;
  return loadClientCache(marketSeriesKey(instrument.symbol, range), async signal => {
    const history = instrument.source === "fred"
      ? await loadMarketObservations(instrument.symbol, signal, force)
      : await loadStockTrend(instrument.symbol, instrument.daily
        ? { period: range === "1D" ? "5d" : spec.period, interval: "1d" }
        : { period: spec.period, interval: spec.interval }, signal, force);
    return instrument.daily || ["1Y", "QTD", "YTD"].includes(range) ? observationRange(history, range) : history;
  }, { ttl: instrument.daily ? 5 * 60_000 : 60_000, maxAge: 5 * 60_000, force, signal: options.signal });
}
