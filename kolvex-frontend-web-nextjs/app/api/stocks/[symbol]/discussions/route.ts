import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const searchParams = request.nextUrl.searchParams;

    const backendParams = new URLSearchParams();
    const page = searchParams.get("page");
    const pageSize = searchParams.get("page_size");
    const sortBy = searchParams.get("sort_by");
    const sortDirection = searchParams.get("sort_direction");

    if (page) backendParams.set("page", page);
    if (pageSize) backendParams.set("page_size", pageSize);
    if (sortBy) backendParams.set("sort_by", sortBy);
    if (sortDirection) backendParams.set("sort_direction", sortDirection);

    const query = backendParams.toString();
    const response = await fetch(
      `${API_BASE_URL}/api/v1/stocks/${ticker}/discussions${query ? `?${query}` : ""}`,
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
    console.error("Error fetching stock discussions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch stock discussions",
        ticker: "",
        total_tweets: 0,
        total_kols: 0,
        kols: [],
        tweets: [],
        has_more: false,
      },
      { status: 500 }
    );
  }
}

