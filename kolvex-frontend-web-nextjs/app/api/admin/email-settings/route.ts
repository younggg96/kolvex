import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const API = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";
const KINDS = new Set(["daily_brief", "holdings_change"]);
const ACTIONS = new Set(["test", "preview", "draft", "send"]);

async function forward(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return NextResponse.json({ error: "请先登录管理员账户。" }, { status: 401 });
    const params = request.nextUrl.searchParams;
    const kind = params.get("kind");
    const action = params.get("action") ?? (request.method === "POST" ? "test" : "");
    const draftId = params.get("draft") ?? "";
    let path = "/api/v1/admin/email-settings";
    if (action === "creators") {
      path += "/creators";
    } else if (action === "approve" || action === "reject") {
      if (!/^[0-9a-f-]{36}$/.test(draftId)) return NextResponse.json({ error: "草稿无效。" }, { status: 400 });
      path += `/drafts/${draftId}/${action}`;
    } else if (request.method !== "GET" || action === "draft") {
      if (!kind || !KINDS.has(kind)) return NextResponse.json({ error: "未知邮件类型。" }, { status: 400 });
      if (action && !ACTIONS.has(action)) return NextResponse.json({ error: "未知操作。" }, { status: 400 });
      path += `/${kind}`;
      if (action) path += `/${action}`;
    }
    const response = await fetch(`${API}${path}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: request.method === "GET" ? undefined : await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: typeof data.detail === "string" ? data.detail : "请求失败" }, { status: response.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "暂时无法连接邮件设置服务，请重试。" }, { status: 503 });
  }
}
export const GET = forward;
export const PUT = forward;
export const POST = forward;
