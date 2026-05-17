import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Method = "GET" | "POST";

async function proxyRootRequest(request: NextRequest, method: Method) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const upstreamUrl = new URL(`${API_BASE_URL}/api/v1/quant-strategies`);
    const response = await fetch(upstreamUrl.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: method === "GET" ? undefined : await request.text(),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || "Request failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return proxyRootRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return proxyRootRequest(request, "POST");
}
