import { NextRequest, NextResponse } from "next/server";

// Backend API base URL
// Using 127.0.0.1 instead of localhost to avoid Node.js IPv6 resolution issues
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

export interface Tweet {
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
  ai_analysis: string | null;
  ai_sentiment: "negative" | "neutral" | "positive" | string | null;
  ai_tags: string[] | null;
  ai_analyzed_at: string | null;
  ai_model: string | null;
  is_market_related: boolean | null;
  user_tracked?: boolean;
}

export interface TweetsResponse {
  count: number;
  tweets: Tweet[];
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

    console.log(data);
    // Transform backend data to frontend format
    const tweets: Tweet[] = data.tweets.map((tweet: any) => {
      return {
        post_id: tweet.id.toString(),
        platform: "TWITTER",
        creator_id: tweet.username,
        creator_name: tweet.display_name || tweet.username,
        creator_avatar_url: tweet.avatar_url,
        content: tweet.tweet_text,
        content_url: tweet.permalink,
        published_at: tweet.created_at,
        media_urls: tweet.media_urls || [],
        likes_count: tweet.like_count,
        ai_summary: tweet.summary || tweet.summary_en || null,
        ai_analysis: tweet.sentiment?.reasoning || null,
        ai_sentiment: tweet.sentiment?.value || tweet.sentiment || "neutral",
        ai_tags: [...(tweet.tags || []), ...(tweet.tickers || [])],
        ai_analyzed_at: tweet.ai_analyzed_at,
        ai_model: tweet.ai_model,
        is_market_related: true,
        user_tracked: false,
      };
    });

    const result: TweetsResponse = {
      count: data.total,
      tweets,
    };

    return NextResponse.json(result);
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
