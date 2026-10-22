import type { Metadata } from "next";

// Keep canonical URLs on the production origin, including on preview deployments.
export const SITE_URL = "https://kolvex.app";
export const SITE_TITLE = "Kolvex — AI Stock Research & Creator Insights";
export const SITE_DESCRIPTION =
  "Connect creator stock opinions, market context and AI research in one workspace. Trace ideas to their sources and follow what changes.";

export function publicPageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const url = new URL(path, SITE_URL).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Kolvex",
      type: "website",
      locale: "en_US",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Kolvex — connected stock research" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}
