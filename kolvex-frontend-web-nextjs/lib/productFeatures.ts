export const DISABLED_PRODUCT_ROUTE_PREFIXES = [
  "/dashboard/analytics",
  "/dashboard/social",
  "/dashboard/stocks",
  "/dashboard/investors",
  "/dashboard/kol",
] as const;

export const DISABLED_PRODUCT_REDIRECT = "/dashboard/portfolio";

export function isProductRouteDisabled(pathname: string): boolean {
  return DISABLED_PRODUCT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
