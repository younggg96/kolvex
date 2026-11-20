import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BACKEND_API_URL } from "@/lib/config/backend";

export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function sessionToken(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/** Forwards to FastAPI /api/v1/shares…; the backend owns every rule and error code. */
export async function forwardShare(
  path: string,
  init: RequestInit & { token: string | null },
): Promise<NextResponse> {
  const { token, ...rest } = init;
  try {
    const upstream = await fetch(`${BACKEND_API_URL}/api/v1/shares${path}`, {
      ...rest,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await upstream.json().catch(() => ({}));
    if (upstream.ok)
      return NextResponse.json(data, { status: upstream.status, headers: PRIVATE_HEADERS });
    const error = typeof data?.detail === "string" ? data.detail : "unavailable";
    return NextResponse.json(
      { error },
      { status: upstream.status >= 500 ? 503 : upstream.status, headers: PRIVATE_HEADERS },
    );
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
}
