import { notFound, redirect } from "next/navigation";
import StockWorkspace from "@/components/decision/StockWorkspace";
import { validTicker } from "@/lib/decision";
import { isMarketIndex } from "@/lib/marketBenchmarks";

export default function MarketStockPage({ params }: { params: { ticker: string } }) {
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
  return <StockWorkspace key={ticker} ticker={ticker} />;
}
