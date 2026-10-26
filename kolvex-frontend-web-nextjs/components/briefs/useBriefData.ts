"use client";

import { useEffect } from "react";
import { useCachedResource } from "@/hooks/useCachedResource";

class BriefRequestError extends Error {
  constructor(public status: number) { super("Brief unavailable"); }
}

/** Recent briefs survive navigation; focus revalidates only after the freshness window. */
export function useBriefData<T>(path: string) {
  const resource = useCachedResource<T>(`/api/briefs${path}`, async signal => {
    const response = await fetch(`/api/briefs${path}`, { cache: "no-store", signal });
    if (!response.ok) throw new BriefRequestError(response.status);
    return response.json();
  }, { ttl: 60_000, timeout: 20_000 });
  const revalidate = resource.revalidate;
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") revalidate(); };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh); };
  }, [revalidate]);
  return { data: resource.data ?? null, loading: resource.loading, error: resource.error ? resource.error instanceof BriefRequestError ? resource.error.status : 503 : null, retry: resource.refresh };
}
