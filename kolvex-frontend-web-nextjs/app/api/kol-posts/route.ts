/**
 * KOL Posts API 代理路由
 * 将请求转发到后端 Python API
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // 转发所有查询参数到后端
    const backendParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
      backendParams.set(key, value);
    });

    const response = await fetch(
      `${API_BASE_URL}/api/v1/kol-posts/?${backendParams.toString()}`,
      {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Backend API error", posts: [], total: 0, has_more: false },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching KOL posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOL posts", posts: [], total: 0, has_more: false },
      { status: 500 }
    );
  }
}

