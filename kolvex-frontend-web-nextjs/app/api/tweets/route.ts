import { NextRequest, NextResponse } from "next/server";

// Backend API base URL
// Using 127.0.0.1 instead of localhost to avoid Node.js IPv6 resolution issues
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

export interface Tweet {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  tweet_text: string;
  created_at: string;
  permalink: string;
  media_urls: {
    type: string;
    url: string;
    poster: string;
  }[];
  is_repost: boolean;
  original_author: string;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  bookmark_count: number;
  views_count: number;
  scraped_at: string;
  sentiment: {
    value: string;
    confidence: number;
    reasoning: string;
  };
  tickers: string[];
  tags: string[];
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

export interface TweetsResponse {
  tweets: Tweet[];
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

    // Calculate page and page_size for the backend API
    const page = Math.floor(offset / limit) + 1;
    const pageSize = limit;

    // Fetch data from backend API
    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/kol-tweets/?page=${page}&page_size=${pageSize}`,
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
        error: "Failed to fetch tweets data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
