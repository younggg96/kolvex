import StockPageClient from "./StockPageClient";
import { getStockOverviewServer } from "@/lib/stockApi.server";
import { headers } from "next/headers";
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

/**
 * Server-side check if stock is tracked via internal API route
 */
async function checkStockTrackedServer(symbol: string): Promise<{
  symbol: string;
  is_tracked: boolean;
  stock_id: string | null;
}> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return { symbol: normalized, is_tracked: false, stock_id: null };
  }

  try {
    // Get the host from headers for internal API call
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

    const res = await fetch(
      `${protocol}://${host}/api/tracked-stocks/check/${encodeURIComponent(
        normalized
      )}`,
      {
        cache: "no-store",
        headers: {
          cookie: headersList.get("cookie") || "",
        },
      }
    );

    if (!res.ok) {
      return { symbol: normalized, is_tracked: false, stock_id: null };
    }

    const json = await res.json();
    return {
      symbol: json.symbol?.toUpperCase?.() || normalized,
      is_tracked: Boolean(json.is_tracked),
      stock_id: json.stock_id ?? null,
    };
  } catch {
    return { symbol: normalized, is_tracked: false, stock_id: null };
  }
}

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
