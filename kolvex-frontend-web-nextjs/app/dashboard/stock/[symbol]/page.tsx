import StockPageClient from "./StockPageClient";
import { getStockOverviewServer } from "@/lib/stockApi.server";
import { checkStockTrackedServer } from "@/lib/trackedStockApi.server";
import { Metadata } from "next";

interface StockPageProps {
  params: {
    symbol: string;
  };
}

export async function generateMetadata({
  params,
}: StockPageProps): Promise<Metadata> {
  const { symbol } = await params;
  return {
    title: `${symbol} - Stock - Kolvex`,
    description: `View stock information for ${symbol}`,
    openGraph: {
      title: `${symbol} - Stock - Kolvex`,
      description: `View stock information for ${symbol}`,
      type: "website",
    },
    twitter: {
      title: `${symbol} - Stock - Kolvex`,
      description: `View stock information for ${symbol}`,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function StockPage({ params }: StockPageProps) {
  const symbol = params.symbol.toUpperCase();

  const [initialOverview, initialTracked] = await Promise.all([
    getStockOverviewServer(symbol),
    checkStockTrackedServer(symbol),
  ]);

  return (
    <StockPageClient
      symbol={symbol}
      initialOverview={initialOverview}
      initialTracked={{
        is_tracked: initialTracked.is_tracked,
        stock_id: initialTracked.stock_id,
      }}
    />
  );
}
