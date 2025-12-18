import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface StockSearchResult {
  symbol: string;
  name?: string;
  sector?: string;
  exchange?: string;
  type: "equity" | "crypto" | "etf" | "index" | "mutualfund" | "currency" | "future";
  mention_count?: number;
}

export interface StockSearchResponse {
  results: StockSearchResult[];
  total: number;
  query: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query") || "";
    const limit = searchParams.get("limit") || "10";
    const includeCrypto = searchParams.get("include_crypto") || "false";
    const mode = searchParams.get("mode") || "search"; // "search" | "autocomplete" | "popular"
    const includeKolMentions = searchParams.get("include_kol_mentions") || "true";

    // 模式 1: 获取热门股票（无查询词）
    if (!query.trim() || mode === "popular") {
      const backendUrl = new URL(`${API_BASE_URL}/api/v1/stocks/popular`);
      backendUrl.searchParams.set("limit", limit);

      const response = await fetch(backendUrl.toString(), {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const data: StockSearchResponse = await response.json();
      return NextResponse.json(data);
    }

    // 模式 2: 自动补全（轻量级，不查询 KOL 提及）
    if (mode === "autocomplete") {
      const backendUrl = new URL(`${API_BASE_URL}/api/v1/stocks/autocomplete`);
      backendUrl.searchParams.set("q", query);
      backendUrl.searchParams.set("limit", limit);

      const response = await fetch(backendUrl.toString(), {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      // autocomplete 端点直接返回数组
      const results: StockSearchResult[] = await response.json();
      return NextResponse.json({
        results,
        total: results.length,
        query,
      });
    }

    // 模式 3: 完整搜索（包含 KOL 提及次数）
    const backendUrl = new URL(`${API_BASE_URL}/api/v1/stocks/search`);
    backendUrl.searchParams.set("query", query);
    backendUrl.searchParams.set("limit", limit);
    backendUrl.searchParams.set("include_crypto", includeCrypto);
    backendUrl.searchParams.set("include_kol_mentions", includeKolMentions);

    const response = await fetch(backendUrl.toString(), {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend API error:", errorText);
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data: StockSearchResponse = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in stock search API:", error);
    return NextResponse.json(
      { error: "Internal server error", results: [], total: 0, query: "" },
      { status: 500 }
    );
  }
}
