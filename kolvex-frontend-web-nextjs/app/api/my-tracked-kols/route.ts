import { NextRequest, NextResponse } from "next/server";
import { mockCreators, mockUserData, Platform } from "@/lib/mockData";

export interface TrackedKOL {
  user_id: string;
  kol_id: string;
  platform: Platform;
  notify: boolean;
  updated_at: string;
  creator_name?: string;
  creator_avatar_url?: string;
  creator_username?: string;
  creator_verified?: boolean;
  creator_bio?: string;
  creator_followers_count?: number;
  creator_category?: string;
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

const MOCK_USER_ID = "mock-user-123";

// GET - 获取当前用户追踪的所有 KOL
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform") as Platform | null;

    // Get tracked KOL IDs
    const trackedKolIds = Array.from(mockUserData.trackedKols);

    // Filter by platform if specified
    let filteredCreators = mockCreators.filter((c) => 
      trackedKolIds.includes(c.creator_id)
    );

    if (platform) {
      filteredCreators = filteredCreators.filter((c) => c.platform === platform);
    }

    // Transform to tracked KOL format
    const enrichedKOLs: TrackedKOL[] = filteredCreators.map((creator) => ({
      user_id: MOCK_USER_ID,
      kol_id: creator.creator_id,
      platform: creator.platform,
      notify: true,
      updated_at: new Date().toISOString(),
      creator_name: creator.display_name,
      creator_avatar_url: creator.avatar_url || "",
      creator_username: creator.username || "",
      creator_verified: creator.verified,
      creator_bio: creator.bio || "",
      creator_followers_count: creator.followers_count,
      creator_category: creator.category || "",
      creator_influence_score: creator.influence_score,
      creator_trending_score: creator.trending_score,
    }));

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
    const body: CreateTrackedKOLInput = await request.json();

    if (!body.kol_id || !body.platform) {
      return NextResponse.json(
        { error: "Missing required fields: kol_id and platform" },
        { status: 400 }
      );
    }

    // Check if already tracking
    if (mockUserData.trackedKols.has(body.kol_id)) {
      return NextResponse.json(
        { error: "Already tracking this KOL" },
        { status: 409 }
      );
    }

    // Add to tracked KOLs
    mockUserData.trackedKols.add(body.kol_id);

    // Get creator info
    const creator = mockCreators.find((c) => c.creator_id === body.kol_id);

    return NextResponse.json(
      {
        user_id: MOCK_USER_ID,
        kol_id: body.kol_id,
        platform: body.platform,
        notify: body.notify ?? true,
        updated_at: new Date().toISOString(),
        creator_name: creator?.display_name || body.kol_id,
        creator_avatar_url: creator?.avatar_url || null,
        creator_username: creator?.username || "",
        creator_verified: creator?.verified || false,
        creator_bio: creator?.bio || null,
        creator_followers_count: creator?.followers_count || 0,
        creator_category: creator?.category || null,
        creator_influence_score: creator?.influence_score || 0,
        creator_trending_score: creator?.trending_score || 0,
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
    const body: UpdateTrackedKOLInput & { kol_id: string; platform: Platform } =
      await request.json();

    if (!body.kol_id || !body.platform) {
      return NextResponse.json(
        { error: "Missing required fields: kol_id and platform" },
        { status: 400 }
      );
    }

    if (!mockUserData.trackedKols.has(body.kol_id)) {
      return NextResponse.json(
        { error: "Tracked KOL not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user_id: MOCK_USER_ID,
      kol_id: body.kol_id,
      platform: body.platform,
      notify: body.notify ?? true,
      updated_at: new Date().toISOString(),
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
    const searchParams = request.nextUrl.searchParams;
    let kol_id = searchParams.get("kol_id");
    let platform = searchParams.get("platform") as Platform | null;

    // If not in query params, try body
    if (!kol_id || !platform) {
      const body: { kol_id: string; platform: Platform } = await request.json();
      kol_id = body.kol_id;
      platform = body.platform;
    }

    if (!kol_id || !platform) {
      return NextResponse.json(
        { error: "Missing required fields: kol_id and platform" },
        { status: 400 }
      );
    }

    // Remove from tracked KOLs
    mockUserData.trackedKols.delete(kol_id);

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
