import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EmailConfigError, sendBriefTest, sendBriefToSubscribers } from "@/lib/server/briefEmail";

export const dynamic = "force-dynamic";

/** POST ?id=<brief id>&mode=test|all — admin only (the backend enforces it on every call). */
export async function POST(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const mode = request.nextUrl.searchParams.get("mode");
  if (!id || (mode !== "test" && mode !== "all")) return NextResponse.json({ error: "参数无效。" }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || !session.user.email) return NextResponse.json({ error: "请先登录管理员账户。" }, { status: 401 });
  try {
    const result = mode === "test"
      ? await sendBriefTest(id, session.access_token, session.user.email)
      : await sendBriefToSubscribers(id, session.access_token);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof EmailConfigError ? 503 : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "发送失败，请重试。" }, { status });
  }
}
