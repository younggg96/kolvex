/**
 * Research workspaces API proxy.
 * Forwards authenticated requests to /api/v1/research-workspaces on the backend.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

type Context = { params: Promise<{ path?: string[] }> };

async function getAuthHeader(): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : null;
  } catch {
    return null;
  }
}

async function forward(request: NextRequest, context: Context, method: string) {
  const authHeader = await getAuthHeader();
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { path = [] } = await context.params;
  const suffix = path.map(encodeURIComponent).join("/");
  const query = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_API_URL}/api/v1/research-workspaces${suffix ? `/${suffix}` : ""}${query ? `?${query}` : ""}`;

  let body: string | undefined;
  if (method === "POST" || method === "PATCH") {
    body = await request.text().catch(() => undefined);
  }

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: body || undefined,
      cache: "no-store",
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const detail =
        data && typeof data === "object" && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : "request_failed";
      return NextResponse.json({ error: detail }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("[ResearchWorkspaces Proxy]", method, url, error);
    return NextResponse.json({ error: "backend_unreachable" }, { status: 502 });
  }
}

export function GET(request: NextRequest, context: Context) {
  return forward(request, context, "GET");
}

export function POST(request: NextRequest, context: Context) {
  return forward(request, context, "POST");
}

export function PATCH(request: NextRequest, context: Context) {
  return forward(request, context, "PATCH");
}

export function DELETE(request: NextRequest, context: Context) {
  return forward(request, context, "DELETE");
}
