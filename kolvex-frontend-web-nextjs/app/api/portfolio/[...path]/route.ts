import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

type RouteParams = { params: Promise<{ path: string[] }> };

/**
 * Proxy request to backend Portfolio API
 */
async function proxyRequest(
  request: NextRequest,
  path: string,
  options: {
    method: "GET" | "POST" | "PUT" | "DELETE";
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
      `${API_BASE_URL}/api/v1/portfolio${path}`,
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
    console.error(`Portfolio API error [${path}]:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET handler
 * - /api/portfolio/status -> GET /status
 * - /api/portfolio/holdings -> GET /holdings
 * - /api/portfolio/holdings/:userId -> GET /holdings/:userId (public, no auth)
 * - /api/portfolio/public-users -> GET /public-users (public, no auth)
 * - /api/portfolio/history -> GET /history (with period query param)
 * - /api/portfolio/history/status -> GET /history/status
 * - /api/portfolio/analysis/health -> GET /analysis/health
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
        // /api/portfolio/holdings - user's own holdings
        return proxyRequest(request, "/holdings", { method: "GET" });
      } else {
        // /api/portfolio/holdings/:userId - public holdings
        return proxyRequest(request, `/holdings/${path[1]}`, {
          method: "GET",
          requireAuth: false,
        });
      }

    case "public-users": {
      // /api/portfolio/public-users - get all public users (no auth)
      const limit = searchParams.get("limit") || "20";
      const offset = searchParams.get("offset") || "0";
      const sortBy = searchParams.get("sort_by") || "updated";
      const sortOrder = searchParams.get("sort_order") || "desc";
      return proxyRequest(
        request,
        `/public-users?limit=${limit}&offset=${offset}&sort_by=${sortBy}&sort_order=${sortOrder}`,
        { method: "GET", requireAuth: false }
      );
    }

    case "privacy-settings":
      // /api/portfolio/privacy-settings - get privacy settings
      return proxyRequest(request, "/privacy-settings", { method: "GET" });

    case "history": {
      // /api/portfolio/history -> GET /history
      // /api/portfolio/history/status -> GET /history/status
      if (path[1] === "status") {
        return proxyRequest(request, "/history/status", { method: "GET" });
      }
      const period = searchParams.get("period") || "1M";
      return proxyRequest(request, `/history?period=${period}`, { method: "GET" });
    }

    case "analysis":
      // /api/portfolio/analysis/health -> GET /analysis/health
      if (path[1] === "health") {
        return proxyRequest(request, "/analysis/health", { method: "GET" });
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/**
 * POST handler
 * - /api/portfolio/toggle-public -> POST /toggle-public
 * - /api/portfolio/positions/:id/visibility -> POST /positions/:id/visibility
 * - /api/portfolio/positions/visibility/batch -> POST /batch-toggle-position-visibility
 * - /api/portfolio/analysis -> POST /analysis (AI portfolio analysis)
 * - /api/portfolio/analysis/stock -> POST /analysis/stock (AI single stock analysis)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;

  // Route matching
  switch (path[0]) {
    case "toggle-public":
      return proxyRequest(request, "/toggle-public", {
        method: "POST",
        hasBody: true,
      });

    case "positions":
      // /api/portfolio/positions/visibility/batch -> POST /positions/visibility/batch
      // /api/portfolio/positions/:id/visibility -> POST /positions/:id/visibility
      if (path[1] === "visibility" && path[2] === "batch") {
        return proxyRequest(request, "/positions/visibility/batch", {
          method: "POST",
          hasBody: true,
        });
      } else if (path[2] === "visibility") {
        // path[1] is position ID
        const positionId = path[1];
        return proxyRequest(request, `/positions/${positionId}/visibility`, {
          method: "POST",
          hasBody: true,
        });
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    case "analysis":
      // /api/portfolio/analysis -> POST /analysis (full portfolio analysis)
      // /api/portfolio/analysis/stock -> POST /analysis/stock (single stock analysis)
      if (path.length === 1) {
        return proxyRequest(request, "/analysis", {
          method: "POST",
          hasBody: true,
        });
      } else if (path[1] === "stock") {
        return proxyRequest(request, "/analysis/stock", {
          method: "POST",
          hasBody: true,
        });
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/**
 * PUT handler
 * - /api/portfolio/privacy-settings -> PUT /privacy-settings
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;

  switch (path[0]) {
    case "privacy-settings":
      return proxyRequest(request, "/privacy-settings", {
        method: "PUT",
        hasBody: true,
      });

    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
