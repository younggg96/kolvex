import { NextResponse } from "next/server";
import { BACKEND_API_URL } from "@/lib/config/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/v1/news/feed`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("News unavailable");
    const data = await response.json();
    if (!Array.isArray(data.articles) || typeof data.fetched_at !== "string")
      throw new Error("Invalid feed");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "News unavailable" }, { status: 502 });
  }
}
