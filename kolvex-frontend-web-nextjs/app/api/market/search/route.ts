import { NextRequest, NextResponse } from "next/server";
import { BACKEND_API_URL } from "@/lib/config/backend";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 50);
  if (!q) return NextResponse.json({ results: [] });
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/market/search?q=${encodeURIComponent(q)}`,
      {
        cache: "no-store",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(8_000)]),
      },
    );
    if (!response.ok) throw new Error("unavailable");
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ results: [], error: "Search unavailable" }, { status: 503 });
  }
}
