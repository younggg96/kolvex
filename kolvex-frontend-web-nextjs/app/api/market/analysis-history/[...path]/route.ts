import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
const backend = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";
async function proxy(request: NextRequest, context: { params: { path: string[] } }) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const path = context.params.path.map(encodeURIComponent).join("/");
    const response = await fetch(`${backend}/api/v1/market/analysis-history/${path}${request.nextUrl.search}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: request.method === "PATCH" ? await request.text() : undefined,
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(response.ok ? data : { error: data.detail || "analysis_history_unavailable" }, { status: response.status });
  } catch {
    return NextResponse.json({ error: "analysis_history_unavailable" }, { status: 502 });
  }
}
export const GET = proxy;
export const PATCH = proxy;
