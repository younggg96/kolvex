import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("page_size") || "20";

    const response = await fetch(
      `${API_BASE_URL}/api/v1/kol-tweets/user/${encodeURIComponent(username)}?page=${page}&page_size=${pageSize}`,
      {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching user tweets:", error);
    return NextResponse.json(
      { error: "Failed to fetch user tweets", tweets: [], total: 0, has_more: false },
      { status: 500 }
    );
  }
}

