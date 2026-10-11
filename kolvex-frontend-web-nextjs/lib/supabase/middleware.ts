import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseUrl, supabaseAnonKey } from "./config";
import { getAuthRedirect } from "./redirect";

const protectedRoutes = ["/dashboard", "/config"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const previousCookies = response.cookies.getAll();
        response = NextResponse.next({ request: { headers: request.headers } });
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });

  // Validate the user with Auth; never authorize from an unverified session cookie.
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Redirects must carry every refreshed cookie, including chunked tokens.
  const redirectWithSession = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  };

  if (!user && isProtectedRoute) {
    const redirectUrl = new URL("/auth", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname + request.nextUrl.search);
    return redirectWithSession(redirectUrl);
  }

  // Callback and password recovery routes must remain accessible with a session.
  if (user && pathname === "/auth") {
    const target = getAuthRedirect(request.nextUrl.searchParams.get("redirectTo"));
    return redirectWithSession(new URL(target, request.url));
  }

  return response;
}
