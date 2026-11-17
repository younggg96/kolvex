import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BACKEND_API_URL } from "@/lib/config/backend";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const ERRORS: Record<string, string> = {
  worker_not_configured: "后端还没有配置 YOUTUBE_IMPORT_WORKER_TOKEN。",
  tables_missing: "数据库还没有自动导入的表，请先执行迁移 20261116150000_youtube_auto_import.sql。",
  run_in_progress: "已有一次导入在排队或运行，请等它结束。",
};

/** GET → schedule, worker and recent runs; POST → queue a run now. Admin rights are checked by the backend. */
async function proxy(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token)
      return NextResponse.json({ error: "请先登录。" }, { status: 401, headers });
    const path = request.method === "POST" ? "run" : "status";
    const response = await fetch(`${BACKEND_API_URL}/api/v1/admin/youtube-auto-import/${path}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return NextResponse.json(data, { headers });
    const detail = typeof data?.detail === "string" ? data.detail : "";
    const error =
      ERRORS[detail] ??
      (response.status === 403
        ? "需要管理员权限。"
        : response.status === 404
          ? "后端还没有这个接口，请重启后端。"
          : "自动导入服务暂不可用，请重试。");
    return NextResponse.json({ error }, { status: response.status, headers });
  } catch {
    return NextResponse.json({ error: "自动导入服务暂不可用，请重试。" }, { status: 503, headers });
  }
}

export const GET = proxy;
export const POST = proxy;
