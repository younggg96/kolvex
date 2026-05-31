import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const NEXT_PUBLIC_BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

/**
 * POST /api/admin/actions - Trigger admin actions
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    // Map action to backend endpoint
    const actionEndpoints: Record<string, string> = {
      "scrape-twitter": "/api/v1/admin/actions/scrape-twitter",
      "scrape-xiaohongshu": "/api/v1/admin/actions/scrape-xiaohongshu",
      "scrape-youtube": "/api/v1/admin/actions/scrape-youtube",
      "options-flow-scan": "/api/v1/admin/actions/options-flow-scan",
      "analyze-news": "/api/v1/admin/actions/analyze-news",
      "analyze-posts": "/api/v1/admin/actions/analyze-posts",
      "analyze-all-posts": "/api/v1/admin/actions/analyze-all-posts",
      "sync-investors": "/api/v1/admin/actions/sync-investors",
      "sync-holdings": "/api/v1/admin/actions/sync-holdings",
      "fetch-news": "/api/v1/admin/actions/fetch-news",
      "portfolio-snapshot": "/api/v1/admin/actions/portfolio-snapshot",
    };

    const endpoint = actionEndpoints[action];
    if (!endpoint) {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }

    // Build query string from params
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const url = `${NEXT_PUBLIC_BACKEND_API_URL}${endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to execute action" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Failed to execute action" },
      { status: 500 }
    );
  }
}
