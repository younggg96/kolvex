import { NextResponse } from "next/server";
import { mergeNews, normalizeNews, parseNewsSymbols } from "@/lib/newsFeed";

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";
// Render each request dynamically while allowing the explicit upstream fetch cache.
export const revalidate = 0;

export async function GET(request: Request) {
  const symbols = parseNewsSymbols(new URL(request.url).searchParams.get("symbols"));
  if (!symbols) return NextResponse.json({ error: "Provide one to four valid symbols" }, { status: 400 });
  const results = await Promise.allSettled(symbols.map(async symbol => {
    const response = await fetch(`${BACKEND_API_URL}/api/v1/market/news/${encodeURIComponent(symbol)}`, {
      next: { revalidate: 60 }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("News unavailable");
    const data = await response.json();
    if (!Array.isArray(data.news)) throw new Error("Invalid news response");
    return normalizeNews(data.news, symbol);
  }));
  const unavailable = symbols.filter((_, index) => results[index].status === "rejected");
  if (unavailable.length === symbols.length) {
    return NextResponse.json({ error: "News unavailable" }, { status: 502 });
  }
  return NextResponse.json({
    articles: mergeNews(...results.flatMap(result => result.status === "fulfilled" ? [result.value] : [])),
    unavailable,
    checked_at: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
