import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Backend API base URL
const NEXT_PUBLIC_BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8000";

export interface XhsPost {
  id: number;
  note_id: string;
  post_hash: string | null;
  title: string | null;
  content: string | null;
  note_type: string;
  permalink: string | null;
  // 作者信息
  author_name: string | null;
  author_id: string | null;
  author_avatar: string | null;
  // 媒体资源
  cover_url: string | null;
  image_urls: string[];
  video_url: string | null;
  // 互动数据
  like_count: number;
  collect_count: number;
  comment_count: number;
  share_count: number;
  // 标签
  tags: string[];
  search_keyword: string | null;
  // AI 分析结果
  ai_sentiment: string | null;
  ai_sentiment_confidence: number;
  ai_sentiment_reasoning: string | null;
  ai_tickers: string[];
  ai_tags: string[];
  ai_summary: string | null;
  ai_trading_signal: string | null;
  ai_is_stock_related: boolean;
  ai_stock_related_confidence: number;
  ai_stock_related_reason: string | null;
  ai_analyzed_at: string | null;
  ai_model: string | null;
  // 时间戳
  created_at: string | null;
  scraped_at: string | null;
  updated_at: string | null;
}

export interface XhsPostsResponse {
  success: boolean;
  data: XhsPost[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const keyword = searchParams.get("keyword") || "";
    const ticker = searchParams.get("ticker") || "";
    const sentiment = searchParams.get("sentiment") || "";
    const stockRelated = searchParams.get("stock_related");

    // Build query parameters
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("sort_by", "scraped_at");
    params.set("sort_desc", "true");

    if (keyword) params.set("keyword", keyword);
    if (ticker) params.set("ticker", ticker);
    if (sentiment) params.set("sentiment", sentiment);
    if (stockRelated !== null) params.set("stock_related", stockRelated);

    // Fetch data from backend API
    const response = await fetch(
      `${NEXT_PUBLIC_BACKEND_API_URL}/api/v1/xiaohongshu/posts?${params.toString()}`,
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

    const data: XhsPostsResponse = await response.json();

    // Transform response to match expected format
    return NextResponse.json({
      posts: data.data,
      total: data.pagination.total,
      has_more: data.pagination.has_more,
      offset: data.pagination.offset,
      limit: data.pagination.limit,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch XHS posts data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

