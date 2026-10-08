import { notFound, redirect } from "next/navigation";
import StockWorkspace from "@/components/decision/StockWorkspace";
import { validTicker } from "@/lib/decision";

export default function StockPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  if (!validTicker(ticker)) notFound();
  if (params.ticker !== ticker) redirect(`/dashboard/research/${ticker}`);
  return <StockWorkspace key={ticker} ticker={ticker} />;
}
