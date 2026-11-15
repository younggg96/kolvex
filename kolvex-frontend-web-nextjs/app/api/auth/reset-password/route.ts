import { NextRequest, NextResponse } from "next/server";
import { BACKEND_API_V1 } from "@/lib/config/backend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    // 获取重定向 URL - 必须指向 callback 来处理 PKCE code
    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const redirectUrl = `${origin}/auth/callback?type=recovery`;

    const response = await fetch(`${BACKEND_API_V1}/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        redirect_url: redirectUrl,
      }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Reset password API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        error_code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
