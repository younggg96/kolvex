import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SentimentType = "bullish" | "bearish";

interface TopAuthor {
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  tweet_count: number;
  sentiment?: string | null;
}

interface TrendingStock {
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

interface TrendingStocksResponse {
  stocks: TrendingStock[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// Helper function to determine sentiment type from score
function getSentimentType(score: number | null | undefined): SentimentType | null {
  if (score === null || score === undefined || score === 0) return null;
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return null;
}

// Filter stocks by sentiment type
function filterBySentiment(
  stocks: TrendingStock[],
  sentiment: SentimentType
): TrendingStock[] {
  return stocks.filter((stock) => {
    const stockSentiment = getSentimentType(stock.sentiment_score);
    return stockSentiment === sentiment;
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sentiment: string }> }
) {
  try {
    const { sentiment } = await params;

    // Validate sentiment parameter
    const validSentiments: SentimentType[] = ["bullish", "bearish"];
    if (!validSentiments.includes(sentiment as SentimentType)) {
      return NextResponse.json(
        { error: "Invalid sentiment. Must be bullish or bearish." },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");
    const sortBy = searchParams.get("sort_by") || "sentiment_score";
    const sortDirection =
      searchParams.get("sort_direction") ||
      (sentiment === "bearish" ? "asc" : "desc");
    const query = searchParams.get("query");

    // Fetch more data from backend to filter by sentiment
    // We request more items because we'll filter some out
    const fetchMultiplier = 3;
    const backendPageSize = pageSize * fetchMultiplier;

    const backendUrl = new URL(`${API_BASE_URL}/api/v1/stocks/trending`);
    backendUrl.searchParams.set("page", "1");
    backendUrl.searchParams.set("page_size", String(backendPageSize * page));
    backendUrl.searchParams.set("sort_by", sortBy);
    backendUrl.searchParams.set("sort_direction", sortDirection);
    backendUrl.searchParams.set("min_mentions", "1");
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

    // Filter by sentiment
    const filteredStocks = filterBySentiment(
      data.stocks,
      sentiment as SentimentType
    );

    // Paginate the filtered results
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedStocks = filteredStocks.slice(startIndex, endIndex);
    const hasMore = endIndex < filteredStocks.length;

    return NextResponse.json({
      stocks: paginatedStocks,
      total: filteredStocks.length,
      page,
      page_size: pageSize,
      has_more: hasMore,
      sentiment,
    });
  } catch (error) {
    console.error("Error in sentiment stocks API:", error);
    return NextResponse.json(
      { error: "Internal server error", stocks: [], total: 0 },
      { status: 500 }
    );
  }
}

