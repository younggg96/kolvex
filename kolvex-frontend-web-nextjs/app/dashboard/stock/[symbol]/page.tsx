import StockPageClient from "./StockPageClient";
import { getStockOverviewServer } from "@/lib/stockApi.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Metadata } from "next";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

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
 * Server-side check if stock is tracked
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
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { symbol: normalized, is_tracked: false, stock_id: null };
    }

    const res = await fetch(
      `${API_BASE_URL}${API_PREFIX}/stocks/tracked/check/${encodeURIComponent(
        normalized
      )}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}` },
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
