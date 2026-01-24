import { NextResponse } from "next/server";
import { quoteCache, CACHE_TTL, getCacheKey } from "@/lib/cache";

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";

// Major market indices with their Yahoo Finance symbols and display names
const MAJOR_INDICES = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "NASDAQ" },
  { symbol: "^DJI", name: "DOW 30" },
];

interface BackendQuote {
  symbol: string;
  name?: string;
  current_price?: number;
  change?: number;
  change_percent?: number;
}

interface IndexData {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  chartData?: number[];
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchHistoryData(symbol: string): Promise<number[]> {
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/market/history/${encodeURIComponent(symbol)}?period=5d&interval=1d`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || []).map((d: { close?: number }) => d.close || 0).filter((v: number) => v > 0);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const indicesData: IndexData[] = [];

    // Fetch all indices in parallel
    const fetchPromises = MAJOR_INDICES.map(async (index) => {
      const cacheKey = getCacheKey("index", index.symbol);
      const cached = quoteCache.get(cacheKey);

      if (cached) {
        return cached as IndexData;
      }

      try {
        // Fetch quote and history in parallel
        const [quoteResponse, chartData] = await Promise.all([
          fetch(
            `${BACKEND_API_URL}/api/v1/market/quote/${encodeURIComponent(index.symbol)}`
          ),
          fetchHistoryData(index.symbol),
        ]);

        if (!quoteResponse.ok) {
          throw new Error(`Backend returned ${quoteResponse.status}`);
        }

        const quoteData: BackendQuote = await quoteResponse.json();

        const indexData: IndexData = {
          symbol: index.symbol,
          name: index.name,
          value: quoteData.current_price ?? 0,
          change: quoteData.change ?? 0,
          changePercent: quoteData.change_percent ?? 0,
          chartData,
        };

        // Cache for 60 seconds
        quoteCache.set(cacheKey, indexData, CACHE_TTL.QUOTE);

        return indexData;
      } catch (error) {
        console.error(`Failed to fetch ${index.symbol}:`, error);
        // Return placeholder data on error
        return {
          symbol: index.symbol,
          name: index.name,
          value: 0,
          change: 0,
          changePercent: 0,
          chartData: [],
        };
      }
    });

    const results = await Promise.all(fetchPromises);
    indicesData.push(...results);

    return NextResponse.json(indicesData, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Error fetching market indices:", error);
    return NextResponse.json(
      { error: "Failed to fetch market indices" },
      { status: 500 }
    );
  }
}
