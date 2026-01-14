import { NextRequest, NextResponse } from "next/server";
import { KOLPost, KOLProfile as KOLProfileType } from "@/lib/kolPostsApi";
import { XhsPost } from "@/lib/xhsApi";

export const dynamic = "force-dynamic";

// Re-export KOLProfile from lib for backwards compatibility
export type KOLProfile = KOLProfileType;

// KOL Profile Detail response from backend
export interface KOLProfileDetail {
  profile: KOLProfile;
  recent_posts?: KOLPost[] | XhsPost[];
}

// Backend API base URL
const NEXT_PUBLIC_BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";

// GET - Fetch specific KOL profile
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const kolId = searchParams.get("kolId");
    const includeTweets = searchParams.get("include_tweets") === "true";
    const tweetLimit = searchParams.get("tweet_limit") || "10";
    const platform = searchParams.get("platform") || "twitter";

    if (!kolId) {
      return NextResponse.json({ error: "kolId is required" }, { status: 400 });
    }

    // Handle different platforms
    if (platform === "xiaohongshu") {
      // Fetch from Xiaohongshu API (now uses unified kol_profiles table)
      const response = await fetch(
        `${NEXT_PUBLIC_BACKEND_API_URL}/api/v1/xiaohongshu/kols/${kolId}?include_posts=${includeTweets}&post_limit=${tweetLimit}`,
        {
          headers: {
            accept: "application/json",
          },
          cache: "no-store",
        }
      );

      if (response.status === 404) {
        return NextResponse.json({ error: "KOL not found" }, { status: 404 });
      }

      if (!response.ok) {
        throw new Error(
          `Backend API responded with status: ${response.status}`
        );
      }

      const data = await response.json();

      // Transform Xiaohongshu response to match expected format
      // Backend now returns unified structure with field mapping
      const xhsProfile = data.profile;
      const transformedData: KOLProfileDetail = {
        profile: {
          id: xhsProfile.id || 0,
          platform: "xiaohongshu",
          platform_user_id: xhsProfile.user_id,
          username: xhsProfile.user_id,
          display_name: xhsProfile.nickname,
          description: xhsProfile.description,
          followers_count: xhsProfile.followers_count || 0,
          following_count: xhsProfile.following_count || 0,
          likes_count: xhsProfile.likes_count || 0,
          collected_count: xhsProfile.collected_count || 0,
          avatar_url: xhsProfile.avatar_url,
          banner_url: null,
          is_verified: xhsProfile.is_verified || false,
          verification_type: xhsProfile.verified_type,
          rest_id: xhsProfile.user_id,
          join_date: null,
          location: xhsProfile.location,
          website: xhsProfile.profile_url,
          profile_url: xhsProfile.profile_url,
          bio: xhsProfile.description,
          red_id: xhsProfile.red_id,
          created_at: xhsProfile.updated_at,
          updated_at: xhsProfile.updated_at,
        },
        recent_posts: data.recent_posts || [],
      };

      return NextResponse.json(transformedData);
    }

    // Default: Twitter KOL
    const response = await fetch(
      `${NEXT_PUBLIC_BACKEND_API_URL}/api/v1/kol-posts/profile/${kolId}?include_posts=${includeTweets}&post_limit=${tweetLimit}`,
      {
        headers: {
          accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (response.status === 404) {
      return NextResponse.json({ error: "KOL not found" }, { status: 404 });
    }

    if (!response.ok) {
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const data: KOLProfileDetail = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching KOL profile:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch KOL profile",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
