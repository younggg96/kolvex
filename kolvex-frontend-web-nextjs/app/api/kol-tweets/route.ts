import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("page_size") || "20";
    const category = searchParams.get("category");
    const username = searchParams.get("username");
    const search = searchParams.get("search");

    const backendParams = new URLSearchParams();
    backendParams.set("page", page);
    backendParams.set("page_size", pageSize);
    if (category) backendParams.set("category", category);
    if (username) backendParams.set("username", username);
    if (search) backendParams.set("search", search);

    const response = await fetch(
      `${API_BASE_URL}/api/v1/kol-tweets/?${backendParams.toString()}`,
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
    console.error("Error fetching KOL tweets:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOL tweets", tweets: [], total: 0, has_more: false },
      { status: 500 }
    );
  }
}

