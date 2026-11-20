import { NextRequest, NextResponse } from "next/server";
import { BACKEND_API_V1 } from "@/lib/config/backend";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return NextResponse.json({ detail: { code: "sign_in" } }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get("validate") === "true" ? "?validate=true" : "";
    const options: RequestInit & { duplex: "half" } = {
      method: "POST",
      body: request.body,
      duplex: "half",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "text/csv; charset=utf-8",
      },
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]),
    };
    const upstream = await fetch(`${BACKEND_API_V1}/admin/fear-greed${query}`, options);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ detail: { code: "unavailable" } }, { status: 503 });
  }
}
