import { cache } from "react";
import { BACKEND_API_URL } from "@/lib/config/backend";
import { isShareId, type ContentShare } from "@/lib/contentShare";
import { PUBLIC_CONTENT_REVALIDATE_SECONDS } from "@/lib/publicContent";

/** Anonymous read: signed-in-only shares come back as a teaser (`locked`). */
export const getPublicShare = cache(async (id: string): Promise<ContentShare | null> => {
  if (!isShareId(id)) return null;
  const response = await fetch(`${BACKEND_API_URL}/api/v1/shares/${id}`, {
    next: { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS, tags: [`share:${id}`] },
    credentials: "omit",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404 || response.status === 422) return null;
  if (!response.ok) throw new Error("Share is unavailable");
  return response.json();
});
