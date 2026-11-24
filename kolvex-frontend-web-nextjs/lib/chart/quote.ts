import type { StockQuote } from "../stockApi";

const positive = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export type ChartSession = "regular" | "pre" | "post" | "overnight";

export function sessionLabel(
  session: ChartSession,
  locale?: string,
  delayMinutes?: number | null,
): string {
  if (session === "overnight" && positive(delayMinutes ?? undefined)) {
    return locale?.startsWith("zh")
      ? `夜盘 · 延迟 ${delayMinutes} 分钟`
      : `Overnight · ${delayMinutes}m delayed`;
  }
  if (locale === "zh") {
    switch (session) {
      case "pre":
        return "盘前";
      case "post":
        return "盘后";
      case "overnight":
        return "夜盘";
      default:
        return "盘中";
    }
  }
  switch (session) {
    case "pre":
      return "Pre-market";
    case "post":
      return "After hours";
    case "overnight":
      return "Overnight";
    default:
      return "Regular";
  }
}

/** Session prices must keep their own source timestamp and comparison baseline. */
export function latestChartQuote(quote: StockQuote | null | undefined, includeExtended = true) {
  if (!quote || !positive(quote.price)) return null;
  let price = quote.price;
  let time = positive(quote.marketTime) ? quote.marketTime : undefined;
  let session: ChartSession = "regular";
  // A bare extended-hours value can belong to yesterday. Only use it when its
  // matching observation is provably newer than the regular-session quote.
  if (time && includeExtended) {
    for (const candidate of [
      { price: quote.preMarketPrice, time: quote.preMarketTime, session: "pre" as const },
      { price: quote.postMarketPrice, time: quote.postMarketTime, session: "post" as const },
      {
        price: quote.overnightMarketPrice,
        time: quote.overnightMarketTime,
        session: "overnight" as const,
      },
    ]) {
      if (positive(candidate.price) && positive(candidate.time) && candidate.time > time) {
        price = candidate.price;
        time = candidate.time;
        session = candidate.session;
      }
    }
  }
  const baseline = session === "regular" ? quote.previousClose : quote.price;
  const change = session === "regular" ? quote.change : baseline ? price - baseline : undefined;
  const changePercent =
    session === "regular" && Number.isFinite(quote.changePercent)
      ? quote.changePercent
      : positive(baseline)
        ? ((price - baseline) / baseline) * 100
        : null;
  return {
    price,
    time,
    session,
    change,
    changePercent,
    regularPrice: quote.price,
    delayMinutes: session === "overnight" ? quote.overnightMarketDelayMinutes : undefined,
  };
}
