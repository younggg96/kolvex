/** Resolve post-login destinations to local pages, avoiding auth redirect loops. */
export function getAuthRedirect(value?: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  try {
    const base = "https://kolvex.app";
    const url = new URL(value, base);
    if (
      url.origin !== base ||
      url.pathname === "/auth" ||
      url.pathname.startsWith("/auth/")
    ) {
      return "/dashboard";
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return "/dashboard";
  }
}
