/**
 * Options Flow API proxy route
 * Forwards requests to the backend Python API
 */

import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

function buildUrl(path: string[], searchParams: string): string {
  const pathString = path.join("/");
  return `${API_BASE_URL}/api/v1/options-flow/${pathString}${
    searchParams ? `?${searchParams}` : ""
  }`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const searchParams = request.nextUrl.searchParams.toString();
    const url = buildUrl(path, searchParams);

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let errorDetail = "API request failed";
      try {
        const parsed = JSON.parse(errorBody);
        errorDetail = parsed.detail || errorDetail;
      } catch {
        errorDetail = errorBody || errorDetail;
      }
      console.error(`Options Flow API [${response.status}]:`, errorDetail);
      return NextResponse.json(
        { error: errorDetail },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Options Flow API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const searchParams = request.nextUrl.searchParams.toString();
    const url = buildUrl(path, searchParams);

    let body: string | undefined;
    try {
      const json = await request.json();
      body = JSON.stringify(json);
    } catch {
      // No request body
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let errorDetail = "API request failed";
      try {
        const parsed = JSON.parse(errorBody);
        errorDetail = parsed.detail || errorDetail;
      } catch {
        errorDetail = errorBody || errorDetail;
      }
      console.error(`Options Flow API POST [${response.status}]:`, errorDetail);
      return NextResponse.json(
        { error: errorDetail },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Options Flow API POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
