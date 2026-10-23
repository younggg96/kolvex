import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const API = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    const response = await fetch(`${API}/api/v1/market/indicators`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store", signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) return NextResponse.json({ error: "Economic indicators unavailable" }, { status: response.status === 401 ? 401 : 503, headers });
    const data = await response.json();
    if (!Array.isArray(data?.indicators)) throw new Error("Invalid snapshot");
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json({ error: "Economic indicators unavailable" }, { status: 503, headers });
  }
}
