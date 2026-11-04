import { NextRequest, NextResponse } from "next/server";
import { isMarketDiscovery } from "@/lib/marketDiscovery";

export const maxDuration = 30;
export const dynamic = "force-dynamic";
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/market/discovery`, {
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(28_000)]),
    });
    if (!response.ok) throw new Error("Discovery unavailable");
    const data: unknown = await response.json();
    if (!isMarketDiscovery(data)) throw new Error("Invalid discovery response");
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json({ error: "Stock discovery unavailable" }, { status: 503, headers });
  }
}
