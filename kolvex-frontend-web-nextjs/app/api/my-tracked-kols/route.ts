import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Backend API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

export type Platform = "TWITTER" | "REDDIT" | "YOUTUBE" | "REDNOTE";

export interface TrackedKOL {
  id: string;
  user_id: string;
  kol_id: string;
  platform: Platform;
  notify: boolean;
  created_at: string;
  updated_at: string;
  kol_name?: string;
  kol_avatar_url?: string | null;
  kol_username?: string;
  kol_verified?: boolean;
  kol_bio?: string | null;
  kol_followers_count?: number;
  kol_category?: string | null;
  kol_influence_score?: number;
  kol_trending_score?: number;
}

export interface CreateTrackedKOLInput {
  kol_id: string;
  platform: Platform;
  notify?: boolean;
}

export interface UpdateTrackedKOLInput {
  notify?: boolean;
}

// GET - 获取当前用户追踪的所有 KOL
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform");

    const url = new URL(`${API_BASE_URL}${API_PREFIX}/kol-subscriptions/tracked`);
    if (platform) {
      url.searchParams.set("platform", platform);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Failed to fetch tracked KOLs" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
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
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateTrackedKOLInput = await request.json();

    if (!body.kol_id || !body.platform) {
      return NextResponse.json(
        { error: "Missing required fields: kol_id and platform" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${API_BASE_URL}${API_PREFIX}/kol-subscriptions/tracked`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kol_id: body.kol_id,
          platform: body.platform,
          notify: body.notify ?? true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Failed to track KOL" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
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
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdateTrackedKOLInput & { kol_id: string; platform: Platform } =
      await request.json();

    if (!body.kol_id || !body.platform) {
      return NextResponse.json(
        { error: "Missing required fields: kol_id and platform" },
        { status: 400 }
      );
    }

    const url = new URL(`${API_BASE_URL}${API_PREFIX}/kol-subscriptions/tracked`);
    url.searchParams.set("kol_id", body.kol_id);
    url.searchParams.set("platform", body.platform);

    const response = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notify: body.notify }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Failed to update tracked KOL" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
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
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      } catch {
        // Body parsing failed, continue with query params
      }
    }

    if (!kol_id || !platform) {
      return NextResponse.json(
        { error: "Missing required fields: kol_id and platform" },
        { status: 400 }
      );
    }

    const url = new URL(`${API_BASE_URL}${API_PREFIX}/kol-subscriptions/tracked`);
    url.searchParams.set("kol_id", kol_id);
    url.searchParams.set("platform", platform);

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Failed to untrack KOL" },
        { status: response.status }
      );
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
