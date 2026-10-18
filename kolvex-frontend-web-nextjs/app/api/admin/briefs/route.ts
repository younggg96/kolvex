import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const API = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

async function forward(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return NextResponse.json({ error: "请先登录管理员账户。" }, { status: 401 });
    const params = request.nextUrl.searchParams;
    const method = request.method;
    let path = "/api/v1/admin/briefs";
    if (method === "POST" && params.get("validate") === "1") path += "/validate";
    if (method === "GET") {
      path += params.has("id") ? `/${encodeURIComponent(params.get("id")!)}` : `?page=${encodeURIComponent(params.get("page") || "1")}`;
    }
    let body: string | undefined;
    if (method === "POST") {
      const chunks: Uint8Array[] = [];
      let size = 0;
      const reader = request.body?.getReader();
      if (!reader) return NextResponse.json({ error: "JSON 不能为空。" }, { status: 400 });
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          return NextResponse.json({ error: "JSON 超过 2 MB，请缩小后重试。" }, { status: 413 });
        }
        chunks.push(chunk.value);
      }
      body = Buffer.concat(chunks).toString("utf8");
    }
    const response = await fetch(`${API}${path}`, {
      method, headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body, cache: "no-store", signal: AbortSignal.timeout(25000),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: typeof data.detail === "string" ? data.detail : "请求失败，请检查 JSON 或重新登录后重试。" }, { status: response.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "暂时无法连接简报服务，请重试。" }, { status: 503 });
  }
}
export const GET = forward;
export const POST = forward;
