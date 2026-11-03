import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: { path: string[] } };

async function proxy(request: NextRequest, { params }: Context) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const path = params.path;
  const allowed =
    (path.length === 1 &&
      ["account", "commands", "reviews"].includes(path[0])) ||
    (path.length === 2 && ["quote", "reviews"].includes(path[0]));
  if (!allowed)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const upstream = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080"}/api/v1/paper-trading/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`,
      {
        method: request.method,
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: request.method === "POST" ? await request.text() : undefined,
      },
    );
    // Old running backends return FastAPI's generic 404 for every new route.
    // Surface an actionable configuration error rather than an order failure.
    if (upstream.status === 404) {
      return NextResponse.json(
        { error: "paper_backend_outdated" },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const data = await upstream.json();
    return NextResponse.json(
      upstream.ok
        ? data
        : {
            error:
              upstream.status === 401
                ? "unauthorized"
                : typeof data.detail === "string"
                  ? data.detail
                  : "invalid_order",
          },
      {
        status: upstream.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch {
    return NextResponse.json({ error: "backend_unavailable" }, { status: 502 });
  }
}
export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
