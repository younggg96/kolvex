import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ path: string[] }> };

async function proxyRequest(
  request: NextRequest,
  path: string,
  options: {
    method: "GET" | "POST" | "DELETE";
    hasBody?: boolean;
  },
) {
  const { method, hasBody = false } = options;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };

    const fetchOptions: RequestInit = { method, headers };
    if (hasBody && method !== "GET") {
      fetchOptions.body = await request.text();
    }

    const upstreamUrl = new URL(`${API_BASE_URL}/api/v1/plaid${path}`);
    request.nextUrl.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.append(key, value);
    });

    const response = await fetch(upstreamUrl.toString(), fetchOptions);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.error || "Plaid request failed" },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error(`Plaid API error [${path}]:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;

  switch (path[0]) {
    case "status":
      return proxyRequest(request, "/status", { method: "GET" });
    case "transactions":
      return proxyRequest(request, "/transactions", { method: "GET" });
    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;

  switch (path[0]) {
    case "link-token":
      return proxyRequest(request, "/link-token", { method: "POST" });
    case "exchange-token":
      return proxyRequest(request, "/exchange-token", {
        method: "POST",
        hasBody: true,
      });
    case "sync":
      return proxyRequest(request, "/sync", { method: "POST" });
    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;

  switch (path[0]) {
    case "disconnect":
      return proxyRequest(request, "/disconnect", { method: "DELETE" });
    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
