import { notFound, redirect } from "next/navigation";
import StockWorkspace from "@/components/decision/StockWorkspace";
import { validTicker } from "@/lib/decision";
import { isMarketIndex } from "@/lib/marketBenchmarks";
import { stockObservationReturnHref } from "@/lib/stockDiscovery";

export default function MarketStockPage({ params, searchParams }: { params: { ticker: string }; searchParams?: Record<string, string | string[] | undefined> }) {
  // Encoded index symbols can reach dynamic params unchanged (for example %5EVIX).
  let decodedTicker: string;
  try {
    decodedTicker = decodeURIComponent(params.ticker);
  } catch {
    notFound();
  }
  const ticker = decodedTicker.toUpperCase();
  if (!validTicker(ticker) && !isMarketIndex(ticker)) notFound();
  if (decodedTicker !== ticker) redirect(`/dashboard/market/${encodeURIComponent(ticker)}`);
  const returnHref = stockObservationReturnHref(typeof searchParams?.from === "string" ? searchParams.from : undefined);
  return <StockWorkspace key={ticker} ticker={ticker} returnHref={returnHref} initialInsight={searchParams?.insight === "creators" ? "creators" : undefined} />;
}
