import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/kol-tweets/stats`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching KOL stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOL stats", total_tweets: 0, total_kols: 0, categories: [] },
      { status: 500 }
    );
  }
}

