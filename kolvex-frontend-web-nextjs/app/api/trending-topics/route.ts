import { NextRequest, NextResponse } from "next/server";
import { mockTrendingTopics, Platform } from "@/lib/mockData";

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const platform = searchParams.get("platform") as Platform | null;
    const topicType = searchParams.get("topic_type") as string | null;
    const sortBy = (searchParams.get("sort_by") as SortBy) || "trending_score";
    const sortDirection = searchParams.get("sort_direction") || "desc";

    // Filter topics
    let filteredTopics = [...mockTrendingTopics];

    if (platform) {
      filteredTopics = filteredTopics.filter((t) => t.platform === platform);
    }

    if (topicType) {
      filteredTopics = filteredTopics.filter((t) => t.topic_type === topicType);
    }

    // Sort topics
    filteredTopics.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortDirection === "asc"
        ? aVal > bVal
          ? 1
          : -1
        : aVal > bVal
        ? -1
        : 1;
    });

    // Paginate
    const total = filteredTopics.length;
    const paginatedTopics = filteredTopics.slice(offset, offset + limit);

    return NextResponse.json({
      topics: paginatedTopics,
      count: paginatedTopics.length,
      total,
    });
  } catch (error) {
    console.error("Error in trending topics API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
