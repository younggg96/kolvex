import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BACKEND_API_URL } from "@/lib/config/backend";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
// Error codes returned to the client; the panel shows them in the viewer's language.
const ERRORS: Record<string, string> = {
  tables_missing: "tables_missing",
  unavailable: "unavailable",
};

/**
 * GET → crawl list + limits. PUT → save limits. POST → add or enable/disable an account.
 * Admin rights are checked by the backend.
 */
async function proxy(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token)
      return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
    const path =
      request.method === "PUT" ? "/settings" : request.method === "POST" ? "/sources" : "";
    const body = request.method === "GET" ? undefined : await request.text();
    if (body && body.length > 2000)
      return NextResponse.json({ error: "invalid" }, { status: 413, headers });
    const response = await fetch(`${BACKEND_API_URL}/api/v1/admin/x-crawler${path}`, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return NextResponse.json(data, { headers });
    const detail = typeof data?.detail === "string" ? data.detail : "";
    const error =
      ERRORS[detail] ??
      (response.status === 403
        ? "forbidden"
        : response.status === 400 || response.status === 422
          ? "invalid"
          : response.status === 404
            ? "not_deployed"
            : "unavailable");
    return NextResponse.json({ error }, { status: response.status, headers });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
}

export const GET = proxy;
export const PUT = proxy;
export const POST = proxy;
