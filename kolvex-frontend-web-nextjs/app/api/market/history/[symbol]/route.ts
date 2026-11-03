/**
 * Market history API proxy route
 * Forwards requests to backend /api/v1/market/history/{symbol}
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: rawSymbol } = await params;
    let symbol: string;
    try {
      symbol = decodeURIComponent(rawSymbol).toUpperCase();
    } catch {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    }
    if (!/^[A-Z0-9.\-^=]{1,20}$/.test(symbol)) {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    }
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${API_BASE_URL}/api/v1/market/history/${encodeURIComponent(symbol)}${
      searchParams ? `?${searchParams}` : ""
    }`;

    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      // Cache validated responses below; upstream HTTP 200 may contain no bars.
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let detail = "API request failed";
      try {
        detail = JSON.parse(errorBody).detail || detail;
      } catch {
        detail = errorBody || detail;
      }
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    const data = await response.json();
    if (!Array.isArray(data.data) || !data.data.some((bar: { close?: number }) => typeof bar?.close === "number" && Number.isFinite(bar.close) && bar.close > 0)) {
      return NextResponse.json({ error: "History unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("Market history API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
