/**
 * Stock Screener API proxy route
 * Forwards authenticated requests to the backend Python API.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

function buildUrl(path: string[], searchParams: string): string {
  const pathString = path.join("/");
  const url = `${BACKEND_API_URL}/api/v1/stocks/screener/${pathString}${
    searchParams ? `?${searchParams}` : ""
  }`;
  return url;
}

async function getAuthHeader(): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token
      ? `Bearer ${session.access_token}`
      : null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const authHeader = await getAuthHeader();
    const { path } = await params;
    const searchParams = request.nextUrl.searchParams.toString();
    const url = buildUrl(path, searchParams);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers["Authorization"] = authHeader;

    const response = await fetch(url, { headers, cache: "no-store" });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let errorDetail = "API request failed";
      try {
        const parsed = JSON.parse(errorBody);
        errorDetail = parsed.detail || errorDetail;
      } catch {
        errorDetail = errorBody || errorDetail;
      }
      return NextResponse.json(
        { error: errorDetail },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Stock Screener API error:", error);
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
    const authHeader = await getAuthHeader();
    const { path } = await params;
    const searchParams = request.nextUrl.searchParams.toString();
    const url = buildUrl(path, searchParams);

    let body: string | undefined;
    try {
      const json = await request.json();
      body = JSON.stringify(json);
    } catch {
      // No body
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers["Authorization"] = authHeader;

    const response = await fetch(url, {
      method: "POST",
      headers,
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
      return NextResponse.json(
        { error: errorDetail },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Stock Screener API POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const authHeader = await getAuthHeader();
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path } = await params;
    const url = buildUrl(path, "");

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
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
      return NextResponse.json(
        { error: errorDetail },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Stock Screener API DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
