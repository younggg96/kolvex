import { notFound, redirect } from "next/navigation";
import StockWorkspace from "@/components/decision/StockWorkspace";
import { validTicker } from "@/lib/decision";
import { isMarketIndex } from "@/lib/marketBenchmarks";

export default function MarketStockPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  if (!validTicker(ticker) && !isMarketIndex(ticker)) notFound();
  if (params.ticker !== ticker) redirect(`/dashboard/market/${encodeURIComponent(ticker)}`);
  return <StockWorkspace key={ticker} ticker={ticker} />;
}
