import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  DISABLED_PRODUCT_REDIRECT,
  isProductRouteDisabled,
} from "@/lib/productFeatures";

export async function middleware(request: NextRequest) {
  if (isProductRouteDisabled(request.nextUrl.pathname)) {
    return NextResponse.redirect(
      new URL(DISABLED_PRODUCT_REDIRECT, request.url),
    );
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
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
