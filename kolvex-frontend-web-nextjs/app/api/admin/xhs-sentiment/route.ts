import { NextRequest, NextResponse } from "next/server";
import { BACKEND_API_V1 } from "@/lib/config/backend";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
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
    const action = request.nextUrl.searchParams.get("validate") === "1" ? "/validate" : "";
    const options: RequestInit & { duplex: "half" } = {
      method: "POST",
      body: request.body,
      duplex: "half",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "Accept-Language": language,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    };
    const upstream = await fetch(`${BACKEND_API_V1}/admin/xhs-sentiment${action}`, options);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/plain",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: english ? "Could not reach the import service." : "无法连接小红书情绪导入服务。" },
      { status: 503 },
    );
  }
}
