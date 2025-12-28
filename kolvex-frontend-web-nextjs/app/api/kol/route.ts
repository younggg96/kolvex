import { NextRequest, NextResponse } from "next/server";
import { KOLTweet } from "@/lib/kolTweetsApi";
import { XhsPost } from "@/lib/xhsApi";

export const dynamic = "force-dynamic";

// KOL Profile from backend API (Twitter)
export interface KOLProfile {
  id: number;
  username: string;
  display_name: string | null;
  description: string | null;
  category: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  avatar_url: string | null;
  banner_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  verification_type: string | null;
  rest_id: string | null;
  join_date: string | null;
  location: string | null;
  website: string | null;
  bio: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// KOL Profile Detail response from backend
export interface KOLProfileDetail {
  profile: KOLProfile;
  recent_tweets?: KOLTweet[];
  recent_posts?: XhsPost[];
}

// Backend API base URL
const NEXT_PUBLIC_BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8000";

// GET - Fetch specific KOL profile
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const kolId = searchParams.get("kolId");
    const includeTweets = searchParams.get("include_tweets") === "true";
    const tweetLimit = searchParams.get("tweet_limit") || "10";
    const platform = searchParams.get("platform") || "TWITTER";

    if (!kolId) {
      return NextResponse.json(
        { error: "kolId is required" },
        { status: 400 }
      );
    }

    // Handle different platforms
    if (platform === "REDNOTE") {
      // Fetch from Xiaohongshu API
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
        throw new Error(`Backend API responded with status: ${response.status}`);
      }

      const data = await response.json();

      // Transform Xiaohongshu response to match expected format
      const xhsProfile = data.profile;
      const transformedData: KOLProfileDetail = {
        profile: {
          id: xhsProfile.id || 0,
          username: xhsProfile.user_id,
          display_name: xhsProfile.nickname,
          description: xhsProfile.description,
          category: xhsProfile.category,
          followers_count: xhsProfile.followers_count || 0,
          following_count: xhsProfile.following_count || 0,
          posts_count: xhsProfile.notes_count || 0,
          avatar_url: xhsProfile.avatar_url,
          banner_url: null,
          is_active: true,
          is_verified: xhsProfile.is_verified || false,
          verification_type: xhsProfile.verified_type,
          rest_id: xhsProfile.user_id,
          join_date: null,
          location: xhsProfile.location,
          website: xhsProfile.profile_url,
          bio: xhsProfile.description,
          created_at: xhsProfile.scraped_at,
          updated_at: xhsProfile.updated_at,
        },
        recent_posts: data.recent_posts || [],
      };

      return NextResponse.json(transformedData);
    }

    // Default: Twitter KOL
    const response = await fetch(
      `${NEXT_PUBLIC_BACKEND_API_URL}/api/v1/kol-tweets/profile/${kolId}?include_tweets=${includeTweets}&tweet_limit=${tweetLimit}`,
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
