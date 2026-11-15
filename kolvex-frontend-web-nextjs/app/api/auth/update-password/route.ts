import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BACKEND_API_V1 } from "@/lib/config/backend";

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
        { status: 401 },
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ success: false, error: "Password is required" }, { status: 400 });
    }

    const response = await fetch(`${BACKEND_API_V1}/auth/update-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ password }),
    });

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
      { status: 500 },
    );
  }
}
