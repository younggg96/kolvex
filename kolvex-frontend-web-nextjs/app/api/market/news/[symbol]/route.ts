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
      { next: { revalidate: 300 } },
    );
    if (!response.ok) {
      return NextResponse.json({ error: "News unavailable" }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ error: "News unavailable" }, { status: 502 });
  }
}
