import { NextRequest, NextResponse } from "next/server";

// Backend API base URL
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tweet_id } = body;

    if (!tweet_id) {
      return NextResponse.json(
        { error: "tweet_id is required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_API_URL}/api/v1/ai/analyze-tweet-by-id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tweet_id: parseInt(tweet_id) }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze tweet",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

