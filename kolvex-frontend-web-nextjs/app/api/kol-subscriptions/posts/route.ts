import { NextRequest, NextResponse } from "next/server";
import { mockSocialPosts, mockCreators, mockUserData, Platform } from "@/lib/mockData";

export interface SocialPost {
  post_id: string;
  platform: string;
  creator_id: string;
  creator_name: string;
  creator_avatar_url: string | null;
  content: string;
  content_url: string;
  published_at: string;
  media_urls: string[] | null;
  likes_count: number | null;
  ai_summary: string | null;
  ai_sentiment: "negative" | "neutral" | "positive" | string | null;
  ai_tags: string[] | null;
  is_market_related: boolean | null;
  user_liked?: boolean;
  user_favorited?: boolean;
  user_tracked?: boolean;
  total_likes?: number;
  total_favorites?: number;
}

export interface SubscribedPostsResponse {
  count: number;
  posts: SocialPost[];
  subscriptions_count: number;
  kol_ids: string[];
}

// GET - 获取订阅的 KOL 的帖子
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform") as Platform | null;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sentiment = searchParams.get("sentiment");
    const marketRelated = searchParams.get("market_related");

    // Get tracked KOL IDs
    const kolIds = Array.from(mockUserData.trackedKols);

    if (kolIds.length === 0) {
      return NextResponse.json({
        count: 0,
        posts: [],
        subscriptions_count: 0,
        kol_ids: [],
      });
    }

    // Filter posts from tracked KOLs
    let filteredPosts = mockSocialPosts.filter((p) => kolIds.includes(p.creator_id));

    // Apply filters
    if (platform) {
      filteredPosts = filteredPosts.filter((p) => p.platform === platform);
    }

    if (sentiment) {
      filteredPosts = filteredPosts.filter((p) => p.ai_sentiment === sentiment);
    }

    if (marketRelated === "true") {
      filteredPosts = filteredPosts.filter((p) => p.is_market_related);
    }

    // Sort by published date
    filteredPosts.sort((a, b) => 
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

    // Paginate
    const total = filteredPosts.length;
    const paginatedPosts = filteredPosts.slice(offset, offset + limit);

    // Enrich with creator and interaction data
    const enrichedPosts: SocialPost[] = paginatedPosts.map((post) => {
      const creator = mockCreators.find((c) => c.creator_id === post.creator_id);
      return {
        ...post,
        creator_name: creator?.display_name || "",
        creator_avatar_url: creator?.avatar_url || "",
        creator_username: creator?.username || "",
        creator_verified: creator?.verified || false,
        creator_bio: creator?.bio || null,
        creator_followers_count: creator?.followers_count || 0,
        creator_category: creator?.category || null,
        creator_influence_score: creator?.influence_score || 0,
        creator_trending_score: creator?.trending_score || 0,
        user_liked: mockUserData.likes.has(post.post_id),
        user_favorited: mockUserData.favorites.has(post.post_id),
        user_tracked: true,
        total_likes: 0,
        total_favorites: 0,
      };
    });

    const response: SubscribedPostsResponse = {
      count: total,
      posts: enrichedPosts,
      subscriptions_count: kolIds.length,
      kol_ids: kolIds,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("KOL subscriptions posts GET error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
