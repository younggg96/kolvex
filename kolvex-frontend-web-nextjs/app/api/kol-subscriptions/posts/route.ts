import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Backend API base URL
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const platform = searchParams.get("platform"); // Optional platform filter

    // Get current user and their subscriptions
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", tweets: [], total: 0, has_more: false },
        { status: 401 }
      );
    }

    // Fetch user's KOL subscriptions
    let subscriptionsQuery = supabase
      .from("kol_subscriptions")
      .select("kol_id, platform")
      .eq("user_id", user.id);

    // Filter by platform if provided
    if (platform) {
      subscriptionsQuery = subscriptionsQuery.eq("platform", platform);
    }

    const { data: subscriptions, error: subError } = await subscriptionsQuery;

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return NextResponse.json(
        {
          error: "Failed to fetch subscriptions",
          tweets: [],
          total: 0,
          has_more: false,
        },
        { status: 500 }
      );
    }

    // If no subscriptions, return empty result
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        tweets: [],
        total: 0,
        page: 1,
        page_size: limit,
        has_more: false,
      });
    }

    // Extract unique kol_ids (usernames)
    const kolIds = [...new Set(subscriptions.map((s) => s.kol_id))];

    // Calculate page for backend API
    const page = Math.floor(offset / limit) + 1;

    // Fetch tweets from backend API with multiple usernames
    const usernamesParam = kolIds.join(",");
    const backendUrl = `${BACKEND_API_URL}/api/v1/kol-tweets/?page=${page}&page_size=${limit}&usernames=${encodeURIComponent(
      usernamesParam
    )}`;

    const response = await fetch(backendUrl, {
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Backend API responded with status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch tracked KOL posts",
        details: error instanceof Error ? error.message : "Unknown error",
        tweets: [],
        total: 0,
        has_more: false,
      },
      { status: 500 }
    );
  }
}
