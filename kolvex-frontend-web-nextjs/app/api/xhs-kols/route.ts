import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Platform, Kol, KolsResponse, SortBy } from "../kols/route";

export const dynamic = "force-dynamic";

// Backend API base URL
const NEXT_PUBLIC_BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";

// 统一使用小写平台名称: xiaohongshu

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sortBy = (searchParams.get("sort_by") || "followers_count") as SortBy;
    const sortDirection = searchParams.get("sort_direction") || "desc";
    const category = searchParams.get("category");

    // Map frontend sort fields to backend fields
    const sortFieldMap: Record<string, string> = {
      influence_score: "followers_count",
      total_posts_count: "notes_count",
      trending_score: "likes_count",
      followers_count: "followers_count",
    };

    const backendSortField = sortFieldMap[sortBy] || "followers_count";

    // Build backend URL with query params
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      sort_by: backendSortField,
      sort_desc: (sortDirection === "desc").toString(),
    });

    if (category) {
      params.set("category", category);
    }

    // Fetch XHS KOL profiles from backend API
    const backendUrl = `${NEXT_PUBLIC_BACKEND_API_URL}/api/v1/xiaohongshu/kols?${params}`;

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    const xhsKols = data.data || [];
    const pagination = data.pagination || {};

    // Get current user's tracked KOLs if authenticated
    let trackedKolIds = new Set<string>();
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // 使用小写平台名称查询
        const { data: subscriptions } = await supabase
          .from("kol_subscriptions")
          .select("kol_id")
          .eq("user_id", user.id)
          .eq("platform", "xiaohongshu");

        if (subscriptions) {
          trackedKolIds = new Set(subscriptions.map((s: any) => s.kol_id));
        }
      }
    } catch (authError) {
      // User not authenticated, continue without tracking info
      console.log("User not authenticated for tracking info");
    }

    // Transform XHS KOL data to match the Kol interface
    const kolsWithScores: Kol[] = xhsKols.map((kol: any) => {
      const followersCount = kol.followers_count || 0;
      const notesCount = kol.notes_count || 0;
      const likesCount = kol.likes_count || 0;

      // Calculate influence score (0-100 scale)
      const followerScore = Math.min(followersCount / 10000000, 1) * 50;
      const noteScore = Math.min(notesCount / 1000, 1) * 30;
      const verificationBonus = kol.is_verified ? 20 : 0;
      const influenceScore =
        Math.round((followerScore + noteScore + verificationBonus) * 10) / 10;

      // Calculate trending score based on likes
      const trendingScore = Math.min(likesCount / 1000000, 100);

      return {
        id: kol.id?.toString() || kol.user_id,
        platform: "xiaohongshu" as Platform,
        kol_id: kol.user_id,
        username: kol.red_id || kol.user_id,
        display_name: kol.nickname || kol.red_id || kol.user_id,
        avatar_url: kol.avatar_url,
        bio: kol.description,
        followers_count: followersCount,
        verified: kol.is_verified || false,
        category: kol.category,
        influence_score: influenceScore,
        total_posts_count: notesCount,
        last_post_at: kol.updated_at,
        trending_score: trendingScore,
        metadata: {
          following_count: kol.following_count,
          likes_count: likesCount,
          collected_count: kol.collected_count,
          location: kol.location,
          gender: kol.gender,
          verified_type: kol.verified_type,
          verified_info: kol.verified_info,
          tags: kol.tags,
          profile_url: kol.profile_url,
        },
        created_at: kol.scraped_at,
        updated_at: kol.updated_at,
        user_tracked: trackedKolIds.has(kol.user_id),
      };
    });

    // Sort kols (already sorted from backend, but apply frontend sort logic for consistency)
    kolsWithScores.sort((a: Kol, b: Kol) => {
      let aVal: number = 0;
      let bVal: number = 0;

      switch (sortBy) {
        case "influence_score":
          aVal = a.influence_score;
          bVal = b.influence_score;
          break;
        case "trending_score":
          aVal = a.trending_score;
          bVal = b.trending_score;
          break;
        case "followers_count":
          aVal = a.followers_count;
          bVal = b.followers_count;
          break;
        case "total_posts_count":
          aVal = a.total_posts_count;
          bVal = b.total_posts_count;
          break;
        default:
          aVal = a.influence_score;
          bVal = b.influence_score;
      }

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });

    const responseData: KolsResponse = {
      count: pagination.total || kolsWithScores.length,
      kols: kolsWithScores,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch XHS KOLs data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
