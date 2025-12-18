import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseUrl, supabaseAnonKey } from "./config";

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/community",
  "/config",
];

// Routes that should redirect to dashboard if user is already authenticated
const authRoutes = ["/auth"];

// Public routes that don't require authentication
const publicRoutes = ["/", "/privacy", "/terms", "/contact"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value,
          ...options,
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value: "",
          ...options,
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({
          name,
          value: "",
          ...options,
        });
      },
    },
  });

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Check if the current route is protected
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if the current route is an auth route (login/signup)
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // If user is not authenticated and trying to access a protected route
  if (!user && isProtectedRoute) {
    const redirectUrl = new URL("/auth", request.url);
    // Store the original URL (including query params) to redirect back after login
    const originalUrl = pathname + request.nextUrl.search;
    redirectUrl.searchParams.set("redirectTo", originalUrl);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is authenticated and trying to access auth routes, redirect to dashboard
  if (user && isAuthRoute) {
    // Check if there's a redirectTo parameter
    const redirectTo = request.nextUrl.searchParams.get("redirectTo");
    const targetUrl = redirectTo || "/dashboard";
    return NextResponse.redirect(new URL(targetUrl, request.url));
  }

  return response;
}

