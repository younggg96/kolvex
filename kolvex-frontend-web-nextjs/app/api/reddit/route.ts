import { NextRequest, NextResponse } from "next/server";
import { mockSocialPosts, mockCreators, mockUserData } from "@/lib/mockData";

export interface RedditComment {
  score: number;
  comment_id: string;
  body: string;
  created_utc: number;
  author: string;
}

export interface RedditPost {
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
  // Legacy fields
  user_id?: string;
  username?: string;
  user_avatar_url?: string;
  title?: string;
  selftext?: string;
  subreddit?: string;
  score?: number;
  permalink?: string;
  url?: string;
  num_comments?: number;
  created_utc?: string;
  top_comments?: RedditComment[];
}

export interface RedditPostsResponse {
  count: number;
  posts: RedditPost[];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sentiment = searchParams.get("sentiment");
    const marketRelated = searchParams.get("market_related");

    // Filter Reddit posts
    let filteredPosts = mockSocialPosts.filter((p) => p.platform === "REDDIT");

    // Apply filters
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

    // Transform to Reddit post format
    const posts: RedditPost[] = paginatedPosts.map((post) => {
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
        // Legacy field mappings
        user_id: post.creator_id,
        username: creator?.display_name || "",
        user_avatar_url: creator?.avatar_url || "",
        title: post.title || post.content.split("\n")[0] || "",
        selftext: post.content,
        subreddit: post.platform_metadata?.subreddit || "wallstreetbets",
        score: post.likes_count || 0,
        permalink: post.content_url,
        url: post.content_url,
        num_comments: post.comments_count || 0,
        created_utc: post.published_at,
        top_comments: [],
        // User interaction data
        user_liked: mockUserData.likes.has(post.post_id),
        user_favorited: mockUserData.favorites.has(post.post_id),
        user_tracked: mockUserData.trackedKols.has(post.creator_id),
        total_likes: 0,
        total_favorites: 0,
      };
    });

    const response: RedditPostsResponse = {
      count: total,
      posts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch Reddit posts data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
