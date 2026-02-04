import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

// GET - Fetch all tracking requests (admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const platform = searchParams.get("platform");
    const limit = searchParams.get("limit") || "50";
    const offset = searchParams.get("offset") || "0";

    let url = `${API_BASE_URL}/api/v1/kol-posts/tracking-requests/admin?limit=${limit}&offset=${offset}`;
    if (status) {
      url += `&status=${status}`;
    }
    if (platform) {
      url += `&platform=${platform}`;
    }

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || `Backend API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching admin tracking requests:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch tracking requests",
        requests: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}
