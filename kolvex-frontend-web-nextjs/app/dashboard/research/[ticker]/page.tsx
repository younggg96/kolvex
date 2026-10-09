import { notFound, redirect } from "next/navigation";
import { validTicker } from "@/lib/decision";

export default function StockPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  if (!validTicker(ticker)) notFound();
  redirect(`/dashboard/market/${ticker}`);
}
