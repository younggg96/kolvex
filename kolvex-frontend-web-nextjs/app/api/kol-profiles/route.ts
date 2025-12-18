import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");

    const query = category ? `?category=${category}` : "";

    const response = await fetch(
      `${API_BASE_URL}/api/v1/kol-tweets/profiles${query}`,
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
    console.error("Error fetching KOL profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOL profiles", profiles: [], total: 0 },
      { status: 500 }
    );
  }
}

