import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, display_name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // 获取重定向 URL
    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const redirectUrl = `${origin}/auth/callback`;

    const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        name,
        display_name,
        redirect_url: redirectUrl,
      }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Sign up API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        error_code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
