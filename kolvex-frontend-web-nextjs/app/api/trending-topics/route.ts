import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export type Platform = "TWITTER" | "REDDIT" | "YOUTUBE" | "REDNOTE";

export interface TrendingTopic {
  id: string;
  topic: string;
  topic_type: string;
  platform: Platform;
  trending_score: number;
  engagement_score: number;
  mention_count: number;
  related_tickers: string[] | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export type SortBy =
  | "trending_score"
  | "engagement_score"
  | "mention_count"
  | "last_seen_at";

// Backend API base URL
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const platform = searchParams.get("platform") as Platform | null;
    const topicType = searchParams.get("topic_type") as string | null;
    const sortBy = (searchParams.get("sort_by") as SortBy) || "trending_score";
    const sortDirection = searchParams.get("sort_direction") || "desc";

    // For now, return empty array since we don't have trending topics in backend yet
    // This can be connected to real data when the backend endpoint is available
    
    // Try to fetch from backend if available
    try {
      const response = await fetch(
        `${BACKEND_API_URL}/api/trending-topics?limit=${limit}&offset=${offset}`,
        {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (fetchError) {
      // Backend not available, return empty data
      console.log("Trending topics backend not available");
    }

    // Return empty response when backend is not available
    return NextResponse.json({
      topics: [],
      count: 0,
      total: 0,
    });
  } catch (error) {
    console.error("Error in trending topics API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
