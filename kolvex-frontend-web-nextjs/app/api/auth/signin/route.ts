import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";
const API_PREFIX = "/api/v1";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request", error_code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  const { email, password } = body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return NextResponse.json(
      { success: false, error: "Email and password are required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    // FastAPI and reverse proxies can return plain text or HTML on failure.
    // Never expose those bodies (which may contain tracebacks) to the browser.
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Sign in backend returned non-JSON:", { status: response.status });
      return NextResponse.json(
        {
          success: false,
          error: "The authentication backend failed. Please check the backend logs.",
          error_code: "BACKEND_INVALID_RESPONSE",
        },
        { status: 502 }
      );
    }
    if (!data || typeof data !== "object" || typeof data.success !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Invalid authentication response", error_code: "BACKEND_INVALID_RESPONSE" },
        { status: 502 }
      );
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Sign in API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Cannot reach the authentication backend. Please ensure it is running.",
        error_code: "BACKEND_UNAVAILABLE",
      },
      { status: 503 }
    );
  }
}
