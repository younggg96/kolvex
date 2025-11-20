import { NextRequest, NextResponse } from "next/server";
import { mockTrendingTickers, Platform } from "@/lib/mockData";

export interface TrendingTicker {
  id: string;
  ticker: string;
  company_name: string;
  platform: Platform;
  trending_score: number;
  sentiment_score: number;
  mention_count: number;
  engagement_score: number;
  unique_authors_count?: number;
  price_change_24h: number | null;
  last_seen_at: string;
  first_seen_at: string;
  created_at: string;
  updated_at: string;
  current_price?: number;
  price_change?: number;
  price_change_percent?: number;
}

export type TrendingTickerWithPrice = TrendingTicker & {
  current_price: number;
  price_change: number;
  price_change_percent: number;
};

export type SortBy =
  | "trending_score"
  | "sentiment_score"
  | "mention_count"
  | "engagement_score"
  | "last_seen_at";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const platform = searchParams.get("platform") as Platform | null;
    const sortBy = (searchParams.get("sort_by") as SortBy) || "trending_score";
    const sortDirection = searchParams.get("sort_direction") || "desc";

    // Filter tickers
    let filteredTickers = [...mockTrendingTickers];

    if (platform) {
      filteredTickers = filteredTickers.filter((t) => t.platform === platform);
    }

    // Sort tickers
    filteredTickers.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortDirection === "asc" 
        ? (aVal > bVal ? 1 : -1) 
        : (aVal > bVal ? -1 : 1);
    });

    // Paginate
    const paginatedTickers = filteredTickers.slice(offset, offset + limit);

    return NextResponse.json({
      tickers: paginatedTickers,
      count: paginatedTickers.length,
    });
  } catch (error) {
    console.error("Error in trending tickers API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
