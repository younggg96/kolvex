import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
const API =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_API_URL ||
  "http://localhost:8080";
export async function marketEventsProxy(request: NextRequest, admin = false) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token)
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    const url = new URL(
      `${API}/api/v1/${admin ? "admin/market-events" : "market/events"}`,
    );
    if (admin && request.method === "GET")
      url.searchParams.set(
        "page",
        request.nextUrl.searchParams.get("page") || "1",
      );
    if (
      admin &&
      request.method === "POST" &&
      request.nextUrl.searchParams.get("validate") === "1"
    )
      url.pathname += "/validate";
    let body: string | undefined;
    if (request.method === "POST") {
      const reader = request.body?.getReader();
      if (!reader)
        return NextResponse.json({ error: "JSON 不能为空。" }, { status: 400 });
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1024 * 1024) {
          await reader.cancel();
          return NextResponse.json(
            { error: "JSON 超过 1 MB。" },
            { status: 413 },
          );
        }
        chunks.push(chunk.value);
      }
      body = Buffer.concat(chunks).toString("utf8");
    }
    const response = await fetch(url, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    const data = await response.json();
    return NextResponse.json(
      response.ok
        ? data
        : {
            error:
              typeof data.detail === "string"
                ? data.detail
                : "事件请求失败，请重试。",
          },
      {
        status: response.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "事件服务暂不可用，请重试。" },
      { status: 503 },
    );
  }
}
