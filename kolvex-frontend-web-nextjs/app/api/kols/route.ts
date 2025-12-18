import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

// Platform type matching the database
export type Platform = "TWITTER" | "REDDIT" | "YOUTUBE" | "REDNOTE";

export interface Kol {
  id: string;
  platform: Platform;
  kol_id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  verified: boolean;
  category: string | null;
  influence_score: number;
  total_posts_count: number;
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
  | "trending_score"
  | "followers_count";

export interface KolsResponse {
  count: number;
  kols: Kol[];
}

// Backend API base URL
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const platform = searchParams.get("platform") as Platform | null;
    const sortBy = (searchParams.get("sort_by") || "followers_count") as SortBy;
    const sortDirection = searchParams.get("sort_direction") || "desc";

    // Map frontend sort fields to backend fields
    const sortFieldMap: Record<string, string> = {
      influence_score: "followers_count", // Use followers_count as proxy for influence
      total_posts_count: "posts_count",
      trending_score: "followers_count",
      followers_count: "followers_count",
    };

    const backendSortField = sortFieldMap[sortBy] || "followers_count";

    // Fetch KOL profiles from backend API
    const backendUrl = `${BACKEND_API_URL}/api/v1/kol-tweets/profiles?sort_by=${backendSortField}&sort_order=${sortDirection}`;

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    const profiles = data.profiles || [];

    // Get current user's tracked KOLs if authenticated
    let trackedKolIds = new Set<string>();
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: subscriptions } = await supabase
          .from("kol_subscriptions")
          .select("kol_id")
          .eq("user_id", user.id);

        if (subscriptions) {
          trackedKolIds = new Set(subscriptions.map((s: any) => s.kol_id));
        }
      }
    } catch (authError) {
      // User not authenticated, continue without tracking info
      console.log("User not authenticated for tracking info");
    }

    // Filter by platform if specified
    let filteredProfiles = profiles;
    if (platform) {
      filteredProfiles = profiles.filter((p: any) => {
        // Currently only TWITTER is supported from backend
        return platform === "TWITTER";
      });
    }

    // Calculate influence and trending scores based on available data
    const kolsWithScores = filteredProfiles.map(
      (profile: any, index: number) => {
        const followersCount = profile.followers_count || 0;
        const postsCount = profile.posts_count || 0;

        // Calculate influence score (0-100 scale)
        // Based on followers, posts count, and verification status
        const followerScore = Math.min(followersCount / 10000000, 1) * 50; // Max 50 from followers
        const postScore = Math.min(postsCount / 50000, 1) * 30; // Max 30 from posts
        const verificationBonus = profile.is_verified ? 20 : 0; // Bonus for verification
        const influenceScore =
          Math.round((followerScore + postScore + verificationBonus) * 10) / 10;

        // Calculate trending score (simplified)
        const trendingScore = Math.round(Math.random() * 50 + 25); // Placeholder - would need real engagement data

        return {
          id: profile.id.toString(),
          platform: "TWITTER" as Platform,
          kol_id: profile.username,
          username: profile.username,
          display_name: profile.display_name || profile.username,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          followers_count: followersCount,
          verified: profile.is_verified || false,
          category: null, // Could be added later based on bio/content analysis
          influence_score: influenceScore,
          total_posts_count: postsCount,
          last_post_at: profile.updated_at,
          trending_score: trendingScore,
          metadata: {
            following_count: profile.following_count,
            location: profile.location,
            website: profile.website,
            join_date: profile.join_date,
            verification_type: profile.verification_type,
          },
          created_at: profile.created_at,
          updated_at: profile.updated_at,
          user_tracked: trackedKolIds.has(profile.username),
        };
      }
    );

    // Sort kols
    kolsWithScores.sort((a: Kol, b: Kol) => {
      let aVal: number = 0;
      let bVal: number = 0;

      switch (sortBy) {
        case "influence_score":
          aVal = a.influence_score;
          bVal = b.influence_score;
          break;
        case "trending_score":
          aVal = a.trending_score;
          bVal = b.trending_score;
          break;
        case "followers_count":
          aVal = a.followers_count;
          bVal = b.followers_count;
          break;
        case "total_posts_count":
          aVal = a.total_posts_count;
          bVal = b.total_posts_count;
          break;
        default:
          aVal = a.influence_score;
          bVal = b.influence_score;
      }

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });

    // Paginate
    const total = kolsWithScores.length;
    const paginatedKols = kolsWithScores.slice(offset, offset + limit);

    const responseData: KolsResponse = {
      count: total,
      kols: paginatedKols,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch kols data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

