import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, redirectTo } = body;

    if (!provider) {
      return NextResponse.json(
        { success: false, error: "Provider is required" },
        { status: 400 }
      );
    }

    // 获取重定向 URL
    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const callbackUrl = `${origin}/auth/callback`;

    const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/oauth/url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider,
        redirect_url: callbackUrl,
      }),
    });

    const data = await response.json();
    
    // Create response with cookie to store redirectTo
    const jsonResponse = NextResponse.json(data, { status: response.status });
    
    // Store the redirectTo URL in a cookie for the callback to use
    if (redirectTo) {
      jsonResponse.cookies.set("auth_redirect_to", redirectTo, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 10, // 10 minutes
        path: "/",
      });
    }
    
    return jsonResponse;
  } catch (error) {
    console.error("OAuth API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

