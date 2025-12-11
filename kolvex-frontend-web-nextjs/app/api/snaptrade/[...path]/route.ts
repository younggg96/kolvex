import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type RouteParams = { params: Promise<{ path: string[] }> };

/**
 * Proxy request to backend SnapTrade API
 */
async function proxyRequest(
  request: NextRequest,
  path: string,
  options: {
    method: "GET" | "POST" | "DELETE";
    requireAuth?: boolean;
    hasBody?: boolean;
  }
) {
  const { method, requireAuth = true, hasBody = false } = options;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add auth header if required
    if (requireAuth) {
      const supabase = await createServerSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    // Build request options
    const fetchOptions: RequestInit = { method, headers };
    if (hasBody && method !== "GET") {
      fetchOptions.body = await request.text();
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v1/snaptrade${path}`,
      fetchOptions
    );

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
    console.error(`SnapTrade API error [${path}]:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET handler
 * - /api/snaptrade/status -> GET /status
 * - /api/snaptrade/holdings -> GET /holdings
 * - /api/snaptrade/holdings/:userId -> GET /holdings/:userId (public, no auth)
 * - /api/snaptrade/public-users -> GET /public-users (public, no auth)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  const { searchParams } = new URL(request.url);

  // Route matching
  switch (path[0]) {
    case "status":
      return proxyRequest(request, "/status", { method: "GET" });

    case "holdings":
      if (path.length === 1) {
        // /api/snaptrade/holdings - user's own holdings
        return proxyRequest(request, "/holdings", { method: "GET" });
      } else {
        // /api/snaptrade/holdings/:userId - public holdings
        return proxyRequest(request, `/holdings/${path[1]}`, {
          method: "GET",
          requireAuth: false,
        });
      }

    case "public-users": {
      // /api/snaptrade/public-users - get all public users (no auth)
      const limit = searchParams.get("limit") || "20";
      const offset = searchParams.get("offset") || "0";
      return proxyRequest(
        request,
        `/public-users?limit=${limit}&offset=${offset}`,
        { method: "GET", requireAuth: false }
      );
    }

    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/**
 * POST handler
 * - /api/snaptrade/connect -> POST /connect
 * - /api/snaptrade/sync/accounts -> POST /sync/accounts
 * - /api/snaptrade/sync/positions -> POST /sync/positions
 * - /api/snaptrade/toggle-public -> POST /toggle-public
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;

  // Route matching
  switch (path[0]) {
    case "connect": {
      const { searchParams } = new URL(request.url);
      const redirectUri = searchParams.get("redirect_uri");
      const endpoint = redirectUri
        ? `/connect?redirect_uri=${encodeURIComponent(redirectUri)}`
        : "/connect";
      return proxyRequest(request, endpoint, { method: "POST" });
    }

    case "sync":
      if (path[1] === "accounts") {
        return proxyRequest(request, "/sync/accounts", { method: "POST" });
      } else if (path[1] === "positions") {
        return proxyRequest(request, "/sync/positions", { method: "POST" });
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    case "toggle-public":
      return proxyRequest(request, "/toggle-public", {
        method: "POST",
        hasBody: true,
      });

    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/**
 * DELETE handler
 * - /api/snaptrade/disconnect -> DELETE /disconnect
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;

  switch (path[0]) {
    case "disconnect":
      return proxyRequest(request, "/disconnect", { method: "DELETE" });

    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
