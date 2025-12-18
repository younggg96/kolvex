import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          error_code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${API_BASE_URL}${API_PREFIX}/auth/update-password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ password }),
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Update password API error:", error);
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
