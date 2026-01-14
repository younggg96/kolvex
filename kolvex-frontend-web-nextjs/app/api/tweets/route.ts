import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Backend API base URL
// Using 127.0.0.1 instead of localhost to avoid Node.js IPv6 resolution issues
const NEXT_PUBLIC_BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";

export interface Post {
  id: number;
  platform: string;
  platform_post_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  author_platform_id: string;
  title: string;
  content: string;
  post_type: string;
  created_at: string;
  permalink: string;
  cover_url: string;
  media_urls: {
    type: string;
    url: string;
    poster: string;
  }[];
  video_url: string;
  is_repost: boolean;
  original_author: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  bookmark_count: number;
  views_count: number;
  collect_count: number;
  share_count: number;
  tags: string[];
  search_keyword: string;
  scraped_at: string;
  sentiment: {
    value: string;
    confidence: number;
    reasoning: string;
  };
  tickers: string[];
  trading_signal: {
    action: string;
    tickers: string[];
    confidence: number;
  };
  summary: string;
  is_stock_related: {
    is_related: boolean;
    confidence: number;
    reason: string;
  };
  ai_analyzed_at: string;
  ai_model: string;
}

export interface PostsResponse {
  posts: Post[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const platform = searchParams.get("platform") || "twitter"; // 默认只获取 Twitter

    // Calculate page and page_size for the backend API
    const page = Math.floor(offset / limit) + 1;
    const pageSize = limit;

    // Fetch data from backend API with platform filter
    const response = await fetch(
      `${NEXT_PUBLIC_BACKEND_API_URL}/api/v1/kol-posts/?page=${page}&page_size=${pageSize}&platform=${platform}`,
      {
        headers: {
          accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch posts data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
