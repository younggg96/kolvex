import { NextRequest, NextResponse } from "next/server";
import { BACKEND_API_V1 } from "@/lib/config/backend";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const language = request.headers.get("Accept-Language") || "zh";
  const english = language.toLowerCase().startsWith("en");

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return NextResponse.json(
        { detail: english ? "Sign in as an administrator." : "请先登录管理员账户。" },
        { status: 401 },
      );
    }
    const upstream = await fetch(
      `${BACKEND_API_V1}/admin/person-updates/${encodeURIComponent(params.id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}`, "Accept-Language": language },
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      },
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/plain",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: english ? "Could not reach the updates service." : "无法连接动态服务。" },
      { status: 503 },
    );
  }
}
