import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BACKEND_API_URL } from "@/lib/config/backend";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const ID = /^[a-z][a-z0-9_]{1,39}$/;
const ERRORS: Record<string, string> = {
  tables_missing: "数据库还没有机构名单表，请先执行迁移 20261117045338_institution_managers.sql。",
  id_taken: "这个 ID 已被使用。",
  cik_taken: "这个 CIK 已在名单中。",
  no_13f_filings: "SEC 上找不到这个 CIK 的 13F-HR 申报，不能加入。",
  sec_unavailable_or_unknown_cik:
    "SEC EDGAR 暂时读不到这个 CIK：可能 CIK 不存在，或 SEC 暂不可用。",
  manager_not_found: "名单中没有这家机构。",
  name_required: "英文名称不能为空。",
  nothing_to_update: "没有要保存的修改。",
};

/**
 * GET → full coverage list (including disabled); GET ?cik= → SEC lookup;
 * POST → add; PATCH ?id= → edit. Admin rights are checked by the backend.
 */
async function proxy(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token)
      return NextResponse.json({ error: "请先登录。" }, { status: 401, headers });
    const params = request.nextUrl.searchParams;
    let path = "";
    if (request.method === "GET" && params.has("cik")) {
      const cik = params.get("cik") ?? "";
      if (!/^\d{1,10}$/.test(cik))
        return NextResponse.json({ error: "CIK 只能是数字。" }, { status: 400, headers });
      path = `/lookup?cik=${cik}`;
    } else if (request.method === "PATCH") {
      const id = params.get("id") ?? "";
      if (!ID.test(id))
        return NextResponse.json({ error: "机构 ID 无效。" }, { status: 400, headers });
      path = `/${id}`;
    }
    const body = request.method === "GET" ? undefined : await request.text();
    const response = await fetch(`${BACKEND_API_URL}/api/v1/admin/institutions${path}`, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
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
          : response.status === 422
            ? "填写的内容不符合要求：ID 为 2–40 位小写字母、数字或下划线，并以字母开头。"
            : "机构名单服务暂不可用，请重试。");
    return NextResponse.json({ error }, { status: response.status, headers });
  } catch {
    return NextResponse.json({ error: "机构名单服务暂不可用，请重试。" }, { status: 503, headers });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
