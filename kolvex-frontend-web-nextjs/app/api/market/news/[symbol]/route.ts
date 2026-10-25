import { NextResponse } from "next/server";

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

export async function GET(
  _request: Request,
  { params }: { params: { symbol: string } },
) {
  const symbol = params.symbol.toUpperCase();
  if (!/^[A-Z0-9.^-]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/market/news/${encodeURIComponent(symbol)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok) {
      return NextResponse.json({ error: "News unavailable" }, { status: response.status });
    }
    const data = await response.json();
    if (!Array.isArray(data.news)) throw new Error("Invalid news response");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "News unavailable" }, { status: 502 });
  }
}
