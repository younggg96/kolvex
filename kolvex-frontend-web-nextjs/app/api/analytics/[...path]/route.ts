/**
 * Analytics API 代理路由
 * 将请求转发到后端 Python API
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathString = path.join("/");
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${BACKEND_URL}/api/v1/kol-tweets/analytics/${pathString}${
      searchParams ? `?${searchParams}` : ""
    }`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "API request failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

