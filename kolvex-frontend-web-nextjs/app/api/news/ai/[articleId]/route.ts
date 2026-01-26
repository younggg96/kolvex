import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

// GET: 获取新闻 AI 分析结果
export async function GET(
  request: NextRequest,
  { params }: { params: { articleId: string } }
) {
  try {
    const articleId = params.articleId;

    const response = await fetch(
      `${API_BASE_URL}/api/v1/news/ai/${articleId}`,
      {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching news AI analysis:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}

// POST: 执行新闻 AI 分析
export async function POST(
  request: NextRequest,
  { params }: { params: { articleId: string } }
) {
  try {
    const articleId = params.articleId;
    const searchParams = request.nextUrl.searchParams;
    const force = searchParams.get("force") === "true";

    const response = await fetch(
      `${API_BASE_URL}/api/v1/news/ai/analyze/${articleId}?force=${force}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error analyzing news:", error);
    return NextResponse.json(
      { success: false, error: "Failed to analyze news" },
      { status: 500 }
    );
  }
}
