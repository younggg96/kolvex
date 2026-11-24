import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BACKEND_API_URL } from "@/lib/config/backend";

export const dynamic = "force-dynamic";
type Context = { params: { path: string[] } };

async function proxy(request: NextRequest, { params }: Context) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const path = params.path;
  const targetUrl = `${BACKEND_API_URL}/api/v1/trade-os/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  try {
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
    };

    let body: BodyInit | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (isMultipart) {
        body = await request.formData();
      } else {
        headers["Content-Type"] = "application/json";
        body = await request.text();
      }
    }

    const upstream = await fetch(targetUrl, {
      method: request.method,
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
      headers,
      body,
    });

    const data = await upstream.json().catch(() => ({}));

    if (upstream.status === 404 && (!data || data.detail === "Not Found")) {
      return NextResponse.json(
        { error: "trade_os_backend_unavailable" },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    return NextResponse.json(
      upstream.ok
        ? data
        : {
            error:
              upstream.status === 401
                ? "unauthorized"
                : typeof data.detail === "string"
                  ? data.detail
                  : typeof data.detail?.message === "string"
                    ? data.detail.message
                    : data.error || `Request failed with status ${upstream.status}`,
            // Validation errors name the field to fix (e.g. a scanner logic's parameter).
            ...(typeof data.detail?.field === "string" ? { field: data.detail.field } : {}),
          },
      { status: upstream.status },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.name === "TimeoutError" ? "backend_timeout" : "network_error" },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
