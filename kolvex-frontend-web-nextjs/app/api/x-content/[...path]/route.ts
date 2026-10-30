import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const backend =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";
type Context = { params: { path: string[] } };

async function proxy(request: NextRequest, { params }: Context) {
  const path = params.path.join("/");
  const allowed =
    request.method === "GET"
      ? ["creators", "posts"]
      : ["creators", "validate", "upload"];
  if (!allowed.includes(path))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (request.method === "POST") {
      const supabase = await createServerSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    const body = request.method === "POST" ? await request.text() : undefined;
    if (body && new TextEncoder().encode(body).length > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Import exceeds 2 MB" },
        { status: 413 },
      );
    }
    const response = await fetch(
      `${backend}/api/v1/x-content/${path}?${request.nextUrl.searchParams}`,
      {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      },
    );
    const data = await response.json();
    return NextResponse.json(
      response.ok ? data : { error: data.detail || "X content request failed" },
      { status: response.status },
    );
  } catch {
    return NextResponse.json(
      { error: "X content service is unavailable" },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
