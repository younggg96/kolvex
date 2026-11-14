import { buildPublicSitemap } from "@/lib/publicSitemap";

// Cached like the reading pages (its reads revalidate every 600s); web publishing changes revalidate it at once via PUBLIC_CONTENT_TAG.
export const revalidate = 600;

export default buildPublicSitemap;
