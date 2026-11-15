import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { DISABLED_PRODUCT_REDIRECT, isProductRouteDisabled } from "@/lib/productFeatures";
import { PAGINATED_PUBLIC_PATH, publicPage, publicPagePath } from "@/lib/publicRoutes";

// Anonymous, ISR-cached reading pages: no session work, so crawlers cost no auth round trip.
const PUBLIC_READING_PATH = /^\/(?:research|creators|stocks|share\/creators)(?:\/|$)/;

export async function middleware(request: NextRequest) {
  if (isProductRouteDisabled(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL(DISABLED_PRODUCT_REDIRECT, request.url));
  }

  const { pathname, searchParams } = request.nextUrl;
  if (PUBLIC_READING_PATH.test(pathname)) {
    // Legacy `?page=N` links move to the cacheable `/page/N` path.
    const page =
      searchParams.has("page") && PAGINATED_PUBLIC_PATH.test(pathname)
        ? publicPage(searchParams.get("page") ?? undefined)
        : null;
    if (page)
      return NextResponse.redirect(new URL(publicPagePath(pathname, page), request.url), 308);
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/ — route handlers read the session themselves (createServerSupabaseClient can
     *   persist refreshed cookies there), so a per-call Auth round trip here only doubles
     *   the CPU cost of every client fetch and poll.
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|robots\\.txt$|llms\\.txt$|sitemap\\.xml$|opengraph-image$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
