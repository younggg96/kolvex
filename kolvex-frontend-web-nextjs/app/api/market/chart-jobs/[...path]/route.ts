import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const backend = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

async function proxy(request: NextRequest, { params }: { params: { path: string[] } }) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const timeout = AbortSignal.timeout(20_000);
  const signal = AbortSignal.any([request.signal, timeout]);
  try {
    const path = params.path.map(encodeURIComponent).join("/");
    const response = await fetch(`${backend}/api/v1/market/chart-jobs/${path}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
      signal,
    });
    const data = await response.json();
    return NextResponse.json(response.ok ? data : { error: typeof data.detail === "string" ? data.detail : data.error || "ai_jobs_unavailable" }, { status: response.status });
  } catch {
    return NextResponse.json({ error: "ai_jobs_unavailable" }, { status: timeout.aborted ? 504 : 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
