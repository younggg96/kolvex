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
 * GET → crawl list + limits. PUT → save limits. POST → add or enable/disable an account;
 * POST ?batch=1 → add or turn on many accounts at once.
 * DELETE ?creator=<username> → delete the creator's posts, media and profile and stop crawling.
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
    const batch = request.nextUrl.searchParams.get("batch") === "1";
    let path = "";
    if (request.method === "PUT") path = "/settings";
    else if (request.method === "POST") path = batch ? "/sources/batch" : "/sources";
    else if (request.method === "DELETE") {
      const creator = request.nextUrl.searchParams.get("creator") ?? "";
      if (!/^[a-z0-9_]{1,15}$/.test(creator))
        return NextResponse.json({ error: "invalid" }, { status: 400, headers });
      path = `/creators/${creator}`;
    }
    const body =
      request.method === "GET" || request.method === "DELETE" ? undefined : await request.text();
    // A batch holds up to 200 usernames.
    if (body && body.length > 8000)
      return NextResponse.json({ error: "invalid" }, { status: 413, headers });
    const response = await fetch(`${BACKEND_API_URL}/api/v1/admin/x-crawler${path}`, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
      // Deleting removes every post and media file of a creator.
      signal: AbortSignal.timeout(request.method === "DELETE" ? 60000 : 20000),
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
export const DELETE = proxy;
