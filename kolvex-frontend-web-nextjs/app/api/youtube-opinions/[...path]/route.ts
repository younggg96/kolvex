import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

type RouteParams = { params: Promise<{ path: string[] }> };

function buildBackendUrl(path: string[], searchParams: string) {
  const pathString = path.join("/");
  return `${BACKEND_API_URL}/api/v1/youtube-opinions/${pathString}${
    searchParams ? `?${searchParams}` : ""
  }`;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function proxyJson(
  request: NextRequest,
  path: string[],
  method: "GET" | "POST" | "PATCH",
  requireAuth: boolean
) {
  const token = await getAccessToken();
  if (requireAuth && !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    buildBackendUrl(path, request.nextUrl.searchParams.toString()),
    {
      method,
      headers,
      body: method !== "GET" ? await request.text() : undefined,
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
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyJson(request, path, "GET", false);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyJson(request, path, "POST", true);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  if (path.length !== 2 || path[0] !== "creators") {
    return NextResponse.json({ error: "Unsupported path" }, { status: 400 });
  }
  return proxyJson(request, path, "PATCH", true);
}
