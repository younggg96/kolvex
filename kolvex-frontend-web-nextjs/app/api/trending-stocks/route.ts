import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";

export interface TopAuthor {
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  tweet_count: number;
  sentiment?: string | null;
}

export interface TrendingStock {
  ticker: string;
  company_name?: string | null;
  platform: string;
  mention_count: number;
  sentiment_score: number | null;
  trending_score: number | null;
  engagement_score: number | null;
  unique_authors_count: number;
  top_authors: TopAuthor[];
  last_seen_at: string | null;
  first_seen_at: string | null;
}

export interface TrendingStocksResponse {
  stocks: TrendingStock[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export type SortBy =
  | "trending_score"
  | "sentiment_score"
  | "mention_count"
  | "engagement_score";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");
    const sortBy = searchParams.get("sort_by") || "mention_count";
    const sortDirection = searchParams.get("sort_direction") || "desc";
    const minMentions = parseInt(searchParams.get("min_mentions") || "1");
    const query = searchParams.get("query");

    // 调用后端 API
    const backendUrl = new URL(`${API_BASE_URL}/api/v1/stocks/trending`);
    backendUrl.searchParams.set("page", String(page));
    backendUrl.searchParams.set("page_size", String(pageSize));
    backendUrl.searchParams.set("sort_by", sortBy);
    backendUrl.searchParams.set("sort_direction", sortDirection);
    backendUrl.searchParams.set("min_mentions", String(minMentions));
    if (query) {
      backendUrl.searchParams.set("query", query);
    }

    const response = await fetch(backendUrl.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data: TrendingStocksResponse = await response.json();

    return NextResponse.json({
      stocks: data.stocks,
      total: data.total,
      page: data.page,
      page_size: data.page_size,
      has_more: data.has_more,
    });
  } catch (error) {
    console.error("Error in trending stocks API:", error);
    return NextResponse.json(
      { error: "Internal server error", stocks: [], total: 0 },
      { status: 500 }
    );
  }
}
