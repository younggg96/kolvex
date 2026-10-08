import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

type RouteParams = { params: Promise<{ ticker: string }> };

async function proxy(request: NextRequest, { params }: RouteParams, method: "GET" | "PUT") {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticker } = await params;
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/chart-drawings/${encodeURIComponent(ticker)}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: method === "PUT" ? await request.text() : undefined,
        cache: "no-store",
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.error || "Backend request failed" },
        { status: response.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Chart drawings API error:", error);
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}

export function GET(request: NextRequest, context: RouteParams) {
  return proxy(request, context, "GET");
}

export function PUT(request: NextRequest, context: RouteParams) {
  return proxy(request, context, "PUT");
}
