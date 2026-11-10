import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const response = await fetch(`${API}/api/v1/congress/trades${request.nextUrl.search}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return NextResponse.json(response.ok ? await response.json() : { error: "Congress trades unavailable" }, {
      status: response.ok || response.status < 500 ? response.status : 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Congress trades unavailable" }, { status: 503 });
  }
}
