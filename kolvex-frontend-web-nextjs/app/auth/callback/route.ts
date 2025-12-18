// Auth Callback Handler
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");

  // Get the stored redirect URL from cookie
  const redirectTo = request.cookies.get("auth_redirect_to")?.value || "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    // Exchange code for session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Auth callback error:", exchangeError);
      // Handle password recovery error
      if (type === "recovery") {
        return NextResponse.redirect(
          new URL("/auth/forgot-password?error=reset_link_expired", request.url)
        );
      }
      return NextResponse.redirect(
        new URL("/auth?error=verification_failed", request.url)
      );
    }

    // Handle password recovery - redirect to reset password page
    if (type === "recovery") {
      return NextResponse.redirect(new URL("/auth/reset-password", request.url));
    }

    // Regular login - redirect to stored URL or dashboard
    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    
    // Clear the redirect cookie
    response.cookies.delete("auth_redirect_to");
    
    return response;
  }

  // No code provided - redirect to auth page
  return NextResponse.redirect(new URL("/auth", request.url));
}
