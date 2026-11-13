import { NextResponse } from "next/server";

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

export async function GET(
  _request: Request,
  { params }: { params: { symbol: string } },
) {
  const symbol = params.symbol.toUpperCase();
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/market/fund-holdings/${encodeURIComponent(symbol)}`,
      { cache: "no-store", signal: AbortSignal.timeout(20_000) },
    );
    if (!response.ok) {
      return NextResponse.json({ error: "Holdings unavailable" }, { status: 502 });
    }
    const data = await response.json();
    if (!Array.isArray(data.holdings)) throw new Error("Invalid holdings response");
    // Fund filings change slowly; let the browser reuse a response for an hour.
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "Holdings unavailable" }, { status: 502 });
  }
}
