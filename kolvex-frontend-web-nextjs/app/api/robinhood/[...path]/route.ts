import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

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

    const response = await fetch(
      `${API_BASE_URL}/api/v1/robinhood${path}`,
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
