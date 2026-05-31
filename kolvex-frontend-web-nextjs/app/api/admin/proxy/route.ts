import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

const ALLOWED_PREFIXES = ["/api/v1/scheduler/"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const method = String(body.method || "POST").toUpperCase();
    const path = String(body.path || "");

    if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return NextResponse.json({ error: "Unsupported proxy path" }, { status: 400 });
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: method === "GET" ? undefined : JSON.stringify(body.body || {}),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.error || "Backend request failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin proxy error:", error);
    return NextResponse.json({ error: "Admin proxy failed" }, { status: 500 });
  }
}
