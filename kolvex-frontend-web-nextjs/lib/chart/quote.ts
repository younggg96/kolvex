import type { StockQuote } from "../stockApi";

const positive = (value: number | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

/** Session prices must keep their own source timestamp and comparison baseline. */
export function latestChartQuote(quote: StockQuote | null | undefined, includeExtended = true) {
  if (!quote || !positive(quote.price)) return null;
  let price = quote.price;
  let time = positive(quote.marketTime) ? quote.marketTime : undefined;
  let session: "regular" | "pre" | "post" = "regular";
  // A bare extended-hours value can belong to yesterday. Only use it when its
  // matching observation is provably newer than the regular-session quote.
  if (time && includeExtended) {
    for (const candidate of [
      { price: quote.preMarketPrice, time: quote.preMarketTime, session: "pre" as const },
      { price: quote.postMarketPrice, time: quote.postMarketTime, session: "post" as const },
    ]) {
      if (positive(candidate.price) && positive(candidate.time) && candidate.time > time) {
        price = candidate.price;
        time = candidate.time;
        session = candidate.session;
      }
    }
  }
  const baseline = session === "regular" ? quote.previousClose : quote.price;
  const changePercent = session === "regular" && Number.isFinite(quote.changePercent) ? quote.changePercent
    : positive(baseline) ? (price - baseline) / baseline * 100 : null;
  return { price, time, session, changePercent, regularPrice: quote.price };
}
