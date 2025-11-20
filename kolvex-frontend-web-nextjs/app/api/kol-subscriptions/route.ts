import { NextRequest, NextResponse } from "next/server";
import { mockUserData, Platform } from "@/lib/mockData";

const MOCK_USER_ID = "mock-user-123";

// GET - 查询当前用户的订阅列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform") as Platform | null;

    // Get all tracked KOLs
    const subscriptions = Array.from(mockUserData.trackedKols).map((kol_id) => ({
      user_id: MOCK_USER_ID,
      kol_id,
      platform: "TWITTER" as Platform, // Default platform
      notify: true,
      updated_at: new Date().toISOString(),
    }));

    // Filter by platform if specified
    const filteredSubs = platform 
      ? subscriptions.filter((s) => s.platform === platform)
      : subscriptions;

    return NextResponse.json({
      success: true,
      data: filteredSubs,
      count: filteredSubs.length,
    });
  } catch (error) {
    console.error("KOL subscriptions GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - 订阅新的 KOL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, kol_id, notify = true } = body;

    if (!platform || !kol_id) {
      return NextResponse.json(
        {
          error: "Validation error",
          message: "platform and kol_id are required",
        },
        { status: 400 }
      );
    }

    // Check if already subscribed
    if (mockUserData.trackedKols.has(kol_id)) {
      return NextResponse.json(
        {
          error: "Already subscribed",
          message: "You are already subscribed to this KOL",
        },
        { status: 409 }
      );
    }

    // Add subscription
    mockUserData.trackedKols.add(kol_id);

    return NextResponse.json(
      {
        success: true,
        message: "Successfully subscribed to KOL",
        data: {
          user_id: MOCK_USER_ID,
          kol_id,
          platform,
          notify,
          updated_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("KOL subscriptions POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - 取消订阅 KOL
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { kol_id } = body;

    if (!kol_id) {
      return NextResponse.json(
        {
          error: "Validation error",
          message: "kol_id is required",
        },
        { status: 400 }
      );
    }

    // Remove subscription
    mockUserData.trackedKols.delete(kol_id);

    return NextResponse.json({
      success: true,
      message: "Successfully unsubscribed from KOL",
    });
  } catch (error) {
    console.error("KOL subscriptions DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - 更新订阅设置（如通知开关）
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { kol_id, notify } = body;

    if (!kol_id || notify === undefined) {
      return NextResponse.json(
        {
          error: "Validation error",
          message: "kol_id and notify are required",
        },
        { status: 400 }
      );
    }

    if (!mockUserData.trackedKols.has(kol_id)) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Successfully updated subscription",
      data: {
        user_id: MOCK_USER_ID,
        kol_id,
        notify,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("KOL subscriptions PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
