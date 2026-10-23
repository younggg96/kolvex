/**
 * Market performance API proxy route
 * Forwards requests to backend /api/v1/market/performance
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";

const SYMBOL_PATTERN = /^[A-Z0-9.\-^=]{1,20}$/;
const MAX_SYMBOLS = 80;

export async function GET(request: NextRequest) {
  // Accept both repeated (`?symbols=NVDA&symbols=MU`) and comma-separated input.
  const rawSymbols = request.nextUrl.searchParams
    .getAll("symbols")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const symbols: string[] = [];
  const seen = new Set<string>();
  for (const symbol of rawSymbols) {
    if (!SYMBOL_PATTERN.test(symbol)) {
      return NextResponse.json(
        { error: `Invalid symbol: ${symbol}` },
        { status: 400 }
      );
    }
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    symbols.push(symbol);
  }

  if (!symbols.length) {
    return NextResponse.json(
      { error: "No symbols provided" },
      { status: 400 }
    );
  }

  if (symbols.length > MAX_SYMBOLS) {
    return NextResponse.json(
      { error: `Too many symbols (max ${MAX_SYMBOLS})` },
      { status: 400 }
    );
  }

  const searchParams = new URLSearchParams();
  for (const symbol of symbols) searchParams.append("symbols", symbol);

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/market/performance?${searchParams.toString()}`,
      {
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 60 },
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(28000)]),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let detail = "Market performance unavailable";
      try {
        const parsed = JSON.parse(errorBody) as {
          detail?: unknown;
          error?: unknown;
        };
        if (typeof parsed.detail === "string" && parsed.detail) {
          detail = parsed.detail;
        } else if (typeof parsed.error === "string" && parsed.error) {
          detail = parsed.error;
        }
      } catch {
        if (errorBody) detail = errorBody;
      }
      return NextResponse.json(
        { error: detail },
        { status: 503 }
      );
    }

    const data: unknown = await response.json();
    const stocks = (data as { stocks?: unknown } | null)?.stocks;
    if (!stocks || typeof stocks !== "object" || Array.isArray(stocks)) {
      return NextResponse.json(
        { error: "Invalid market performance response" },
        { status: 503 }
      );
    }

    return NextResponse.json({ stocks });
  } catch (error) {
    console.error("Market performance API error:", error);
    return NextResponse.json(
      { error: "Market performance unavailable" },
      { status: 503 }
    );
  }
}
