import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";
type RouteParams = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, path: string, method: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const query = request.nextUrl.searchParams.toString();
  const target = `${API_BASE_URL}/api/v1/ibkr/${path}${query ? `?${query}` : ""}`;
  const response = await fetch(target, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: method === "POST" ? await request.text() : undefined,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  return NextResponse.json(
    response.ok ? body : { error: body.detail || "IBKR request failed" },
    { status: response.status },
  );
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, path.join("/"), "GET");
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, path.join("/"), "POST");
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, path.join("/"), "DELETE");
}
