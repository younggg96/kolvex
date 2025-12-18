import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const backendParams = new URLSearchParams();
    const page = searchParams.get("page");
    const pageSize = searchParams.get("page_size");
    const ticker = searchParams.get("ticker");
    const tag = searchParams.get("tag");

    if (page) backendParams.set("page", page);
    if (pageSize) backendParams.set("page_size", pageSize);
    if (ticker) backendParams.set("ticker", ticker.toUpperCase());
    if (tag) backendParams.set("tag", tag);

    const query = backendParams.toString();
    const response = await fetch(
      `${API_BASE_URL}/api/v1/news/${query ? `?${query}` : ""}`,
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
    console.error("Error fetching news:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch news",
        articles: [],
        total: 0,
        has_more: false,
      },
      { status: 500 }
    );
  }
}
