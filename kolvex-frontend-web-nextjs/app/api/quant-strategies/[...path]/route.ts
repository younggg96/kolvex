import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ path: string[] }> };
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function proxyRequest(request: NextRequest, path: string, method: Method) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const upstreamUrl = new URL(`${API_BASE_URL}/api/v1/quant-strategies${path}`);
    request.nextUrl.searchParams.forEach((value, key) =>
      upstreamUrl.searchParams.append(key, value)
    );
    const response = await fetch(upstreamUrl.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: method === "GET" || method === "DELETE" ? undefined : await request.text(),
    });
    if (response.status === 204) return new NextResponse(null, { status: 204 });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || "Request failed" },
        { status: response.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function pathFor(parts: string[]) {
  return parts.length ? `/${parts.join("/")}` : "";
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyRequest(request, pathFor(path), "GET");
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyRequest(request, pathFor(path), "POST");
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyRequest(request, pathFor(path), "PATCH");
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyRequest(request, pathFor(path), "PUT");
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxyRequest(request, pathFor(path), "DELETE");
}
