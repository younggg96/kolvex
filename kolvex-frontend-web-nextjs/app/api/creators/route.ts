import { NextRequest, NextResponse } from "next/server";
import { mockCreators, mockUserData, Platform } from "@/lib/mockData";

export interface Creator {
  id: string;
  platform: Platform;
  creator_id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  verified: boolean;
  category: string | null;
  influence_score: number;
  total_posts_count: number;
  avg_engagement_rate: number;
  last_post_at: string | null;
  trending_score: number;
  metadata: any;
  created_at: string;
  updated_at: string;
  user_tracked?: boolean;
}

export type SortBy =
  | "influence_score"
  | "total_posts_count"
  | "avg_engagement_rate"
  | "trending_score"
  | "followers_count";

export interface CreatorsResponse {
  count: number;
  creators: Creator[];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const platform = searchParams.get("platform") as Platform | null;
    const category = searchParams.get("category");
    const sortBy = (searchParams.get("sort_by") || "influence_score") as SortBy;
    const sortDirection = searchParams.get("sort_direction") || "desc";
    const verified = searchParams.get("verified");

    // Filter creators
    let filteredCreators = [...mockCreators];

    if (platform) {
      filteredCreators = filteredCreators.filter((c) => c.platform === platform);
    }

    if (category) {
      filteredCreators = filteredCreators.filter((c) => c.category === category);
    }

    if (verified === "true") {
      filteredCreators = filteredCreators.filter((c) => c.verified);
    }

    // Sort creators
    filteredCreators.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortDirection === "asc" 
        ? (aVal > bVal ? 1 : -1) 
        : (aVal > bVal ? -1 : 1);
    });

    // Paginate
    const total = filteredCreators.length;
    const paginatedCreators = filteredCreators.slice(offset, offset + limit);

    // Add user tracking status
    const creators: Creator[] = paginatedCreators.map((creator) => ({
      ...creator,
      user_tracked: mockUserData.trackedKols.has(creator.creator_id),
    }));

    const response: CreatorsResponse = {
      count: total,
      creators,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch creators data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
