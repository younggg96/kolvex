import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const API = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const params = request.nextUrl.searchParams;
    const id = params.get("id");
    const calendar = params.get("calendar") === "1";
    const url = new URL(`${API}/api/v1/briefs${calendar ? "/calendar" : id ? `/${encodeURIComponent(id)}` : ""}`);
    if (calendar) {
      url.searchParams.set("month", params.get("month") || "");
    } else if (!id) {
      url.searchParams.set("page", params.get("page") || "1");
      if (params.has("date")) url.searchParams.set("date", params.get("date")!);
      if (params.has("type")) url.searchParams.set("type", params.get("type")!);
    }
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store", signal: AbortSignal.timeout(25000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Brief service unavailable" }, { status: 503 });
  }
}
