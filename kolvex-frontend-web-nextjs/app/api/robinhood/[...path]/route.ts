import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

// /connect blocks on the Robinhood device-approval workflow (waiting for the
// user to tap "Yes, it's me"). Default Vercel maxDuration on the Hobby plan
// is 10s, which is below our backend's 25s polling window. Bumping to 60s
// guarantees the backend response can reach the browser.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ path: string[] }> };

async function proxyRequest(
  request: NextRequest,
  path: string,
  options: {
    method: "GET" | "POST" | "DELETE";
    hasBody?: boolean;
  }
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

    // Forward the original query string (e.g. ?limit=100&offset=0) to the
    // backend - without this the orders endpoint always uses the defaults.
    const upstreamUrl = new URL(`${API_BASE_URL}/api/v1/robinhood${path}`);
    request.nextUrl.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.append(key, value);
    });

    const response = await fetch(upstreamUrl.toString(), fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || "Request failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error(`Robinhood API error [${path}]:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;

  switch (path[0]) {
    case "status":
      return proxyRequest(request, "/status", { method: "GET" });
    case "profile":
      return proxyRequest(request, "/profile", { method: "GET" });
    case "orders":
      return proxyRequest(request, "/orders", { method: "GET" });
    case "option-orders":
      return proxyRequest(request, "/option-orders", { method: "GET" });
    case "wash-sale-risk":
      return proxyRequest(request, "/wash-sale-risk", { method: "GET" });
    case "sell-performance":
      return proxyRequest(request, "/sell-performance", { method: "GET" });
    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;

  switch (path[0]) {
    case "connect":
      return proxyRequest(request, "/connect", {
        method: "POST",
        hasBody: true,
      });
    case "sync":
      return proxyRequest(request, "/sync", { method: "POST" });
    case "orders":
      if (path[1] === "analyze") {
        return proxyRequest(request, "/orders/analyze", {
          method: "POST",
          hasBody: true,
        });
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    case "reset-auth":
      return proxyRequest(request, "/reset-auth", { method: "POST" });
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
