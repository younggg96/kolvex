import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BACKEND_API_URL } from "@/lib/config/backend";

export const dynamic = "force-dynamic";
type Context = { params: { path: string[] } };

/** Read-only proxy to /api/v1/market-risk/*; the backend requires a signed-in user. */
export async function GET(request: NextRequest, { params }: Context) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const target = `${BACKEND_API_URL}/api/v1/market-risk/${params.path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  try {
    const upstream = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await upstream.json().catch(() => ({}));
    if (upstream.ok) {
      return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
    }
    const code = typeof data.detail?.code === "string" ? data.detail.code : undefined;
    return NextResponse.json(
      {
        error: upstream.status === 401 ? "unauthorized" : code || `status_${upstream.status}`,
        ...(code ? { code } : {}),
      },
      { status: upstream.status === 404 ? 503 : upstream.status },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.name === "TimeoutError" ? "backend_timeout" : "network_error" },
      { status: 502 },
    );
  }
}
