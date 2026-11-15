import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { BACKEND_API_URL } from "@/lib/config/backend";

export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = ["/api/v1/admin/users/"];

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

    const response = await fetch(`${BACKEND_API_URL}${path}`, {
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
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin proxy error:", error);
    return NextResponse.json({ error: "Admin proxy failed" }, { status: 500 });
  }
}
