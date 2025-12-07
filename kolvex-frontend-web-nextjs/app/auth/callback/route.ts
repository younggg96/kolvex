// Auth Callback Handler
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabaseClient();
    // Exchange code for session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Auth callback error:", exchangeError);
      return NextResponse.redirect(
        new URL("/auth?error=verification_failed", request.url)
      );
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Regular login or returning user - redirect to dashboard
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
