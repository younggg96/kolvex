import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const API = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";
const headers = { "Cache-Control": "private, no-store" };
const SESSIONS = new Set(["pre", "intraday", "post"]);
const ERRORS: Record<string, string> = {
  options_data_not_configured: "后端还没有配置 Alpaca API Key。",
  run_in_progress: "已有一次运行正在进行，请等它结束。",
};

/** GET → status and recent runs; POST ?session= → start a manual run. Admin rights are checked by the backend. */
async function proxy(request: NextRequest) {
  const session = request.nextUrl.searchParams.get("session");
  if (request.method === "POST" && (!session || !SESSIONS.has(session)))
    return NextResponse.json({ error: "无效的运行时点。" }, { status: 400, headers });
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session: auth } } = await supabase.auth.getSession();
    if (!auth?.access_token) return NextResponse.json({ error: "请先登录。" }, { status: 401, headers });
    const path = request.method === "POST" ? `run?session=${session}` : "status";
    const response = await fetch(`${API}/api/v1/admin/options-activity/${path}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${auth.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return NextResponse.json(data, { headers });
    const detail = typeof data?.detail === "string" ? data.detail : "";
    const error = ERRORS[detail] ?? (response.status === 403 ? "需要管理员权限。" : response.status === 404 ? "后端还没有这个接口，请重启后端。" : "期权异动服务暂不可用，请重试。");
    return NextResponse.json({ error }, { status: response.status, headers });
  } catch {
    return NextResponse.json({ error: "期权异动服务暂不可用，请重试。" }, { status: 503, headers });
  }
}

export const GET = proxy;
export const POST = proxy;
