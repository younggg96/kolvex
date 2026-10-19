import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep pages crawlable so crawlers can read their noindex directives.
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
