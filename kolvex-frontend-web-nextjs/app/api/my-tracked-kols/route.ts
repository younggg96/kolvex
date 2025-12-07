import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Backend API base URL
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:8000";

export type Platform = "TWITTER" | "REDDIT" | "YOUTUBE" | "REDNOTE";

export interface TrackedKOL {
  id: string;
  user_id: string;
  kol_id: string;
  platform: Platform;
  notify: boolean;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  creator_avatar_url?: string | null;
  creator_username?: string;
  creator_verified?: boolean;
  creator_bio?: string | null;
  creator_followers_count?: number;
  creator_category?: string | null;
  creator_influence_score?: number;
  creator_trending_score?: number;
}

export interface CreateTrackedKOLInput {
  kol_id: string;
  platform: Platform;
  notify?: boolean;
}

export interface UpdateTrackedKOLInput {
  notify?: boolean;
}

// GET - 获取当前用户追踪的所有 KOL（包含 KOL 详细信息）
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", details: "Please login to view tracked KOLs" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform") as Platform | null;

    // Get tracked KOLs from database
    let query = supabase
      .from("kol_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (platform) {
      query = query.eq("platform", platform);
    }

    const { data: subscriptions, error: dbError } = await query;

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error(dbError.message);
    }

    // Fetch KOL profiles from backend to enrich the data
    let kolProfiles: Map<string, any> = new Map();
    
    try {
      const response = await fetch(
        `${BACKEND_API_URL}/api/v1/kol-tweets/profiles`,
        {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );

      if (response.ok) {
        const data = await response.json();
        const profiles = data.profiles || [];
        profiles.forEach((profile: any) => {
          kolProfiles.set(profile.username, profile);
        });
      }
    } catch (fetchError) {
      console.error("Error fetching KOL profiles:", fetchError);
      // Continue without profile data
    }

    // Enrich subscriptions with profile data
    const enrichedKOLs: TrackedKOL[] = (subscriptions || []).map((sub: any) => {
      const profile = kolProfiles.get(sub.kol_id);
      
      // Calculate influence score if we have profile data
      let influenceScore = 0;
      let trendingScore = 0;
      
      if (profile) {
        const followersCount = profile.followers_count || 0;
        const postsCount = profile.posts_count || 0;
        const followerScore = Math.min(followersCount / 10000000, 1) * 50;
        const postScore = Math.min(postsCount / 50000, 1) * 30;
        const verificationBonus = profile.is_verified ? 20 : 0;
        influenceScore = Math.round((followerScore + postScore + verificationBonus) * 10) / 10;
        trendingScore = Math.round(Math.random() * 50 + 25);
      }

      return {
        id: sub.id,
        user_id: sub.user_id,
        kol_id: sub.kol_id,
        platform: sub.platform,
        notify: sub.notify,
        created_at: sub.created_at,
        updated_at: sub.updated_at || sub.created_at,
        creator_name: profile?.display_name || profile?.username || sub.kol_id,
        creator_avatar_url: profile?.avatar_url || null,
        creator_username: profile?.username || sub.kol_id,
        creator_verified: profile?.is_verified || false,
        creator_bio: profile?.bio || null,
        creator_followers_count: profile?.followers_count || 0,
        creator_category: null, // Could be enhanced later
        creator_influence_score: influenceScore,
        creator_trending_score: trendingScore,
      };
    });

    return NextResponse.json({
      count: enrichedKOLs.length,
      tracked_kols: enrichedKOLs,
    });
  } catch (error) {
    console.error("My tracked KOLs GET error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST - 添加新的追踪 KOL
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: CreateTrackedKOLInput = await request.json();

    if (!body.kol_id || !body.platform) {
      return NextResponse.json(
        { error: "Missing required fields: kol_id and platform" },
        { status: 400 }
      );
    }

    // Check if already tracking
    const { data: existing } = await supabase
      .from("kol_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("kol_id", body.kol_id)
      .eq("platform", body.platform)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Already tracking this KOL" },
        { status: 409 }
      );
    }

    // Add to tracked KOLs
    const { data: newSub, error: insertError } = await supabase
      .from("kol_subscriptions")
      .insert({
        user_id: user.id,
        kol_id: body.kol_id,
        platform: body.platform,
        notify: body.notify ?? true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(insertError.message);
    }

    // Try to fetch KOL profile from backend
    let profile = null;
    try {
      const response = await fetch(
        `${BACKEND_API_URL}/api/v1/kol-tweets/profile/${body.kol_id}?include_tweets=false`,
        {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );
      if (response.ok) {
        const data = await response.json();
        profile = data.profile;
      }
    } catch (fetchError) {
      console.error("Error fetching profile:", fetchError);
    }

    return NextResponse.json(
      {
        id: newSub.id,
        user_id: newSub.user_id,
        kol_id: newSub.kol_id,
        platform: newSub.platform,
        notify: newSub.notify,
        created_at: newSub.created_at,
        updated_at: newSub.updated_at || newSub.created_at,
        creator_name: profile?.display_name || profile?.username || body.kol_id,
        creator_avatar_url: profile?.avatar_url || null,
        creator_username: profile?.username || body.kol_id,
        creator_verified: profile?.is_verified || false,
        creator_bio: profile?.bio || null,
        creator_followers_count: profile?.followers_count || 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("My tracked KOLs POST error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH - 更新追踪的 KOL（主要是通知设置）
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: UpdateTrackedKOLInput & { kol_id: string; platform: Platform } =
      await request.json();

    if (!body.kol_id || !body.platform) {
      return NextResponse.json(
        { error: "Missing required fields: kol_id and platform" },
        { status: 400 }
      );
    }

    // Update subscription
    const { data: updated, error: updateError } = await supabase
      .from("kol_subscriptions")
      .update({ notify: body.notify ?? true })
      .eq("user_id", user.id)
      .eq("kol_id", body.kol_id)
      .eq("platform", body.platform)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Tracked KOL not found" },
          { status: 404 }
        );
      }
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      id: updated.id,
      user_id: updated.user_id,
      kol_id: updated.kol_id,
      platform: updated.platform,
      notify: updated.notify,
      updated_at: updated.updated_at || new Date().toISOString(),
    });
  } catch (error) {
    console.error("My tracked KOLs PATCH error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE - 取消追踪 KOL
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    let kol_id = searchParams.get("kol_id");
    let platform = searchParams.get("platform") as Platform | null;

    // If not in query params, try body
    if (!kol_id || !platform) {
      try {
        const body = await request.json();
        kol_id = body.kol_id;
        platform = body.platform;
      } catch (e) {
        // Body parsing failed, continue with query params
      }
    }

    if (!kol_id || !platform) {
      return NextResponse.json(
        { error: "Missing required fields: kol_id and platform" },
        { status: 400 }
      );
    }

    // Delete subscription
    const { error: deleteError } = await supabase
      .from("kol_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("kol_id", kol_id)
      .eq("platform", platform);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      throw new Error(deleteError.message);
    }

    return NextResponse.json({
      success: true,
      message: "Successfully untracked KOL",
    });
  } catch (error) {
    console.error("My tracked KOLs DELETE error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
