import { publicPageMetadata, SITE_URL } from "@/lib/seo";

export function readingMetadata(title: string, description: string, path: string) {
  const metadata = publicPageMetadata(title, description, path);
  return { ...metadata, openGraph: { ...metadata.openGraph, locale: "zh_CN" } };
}

export function breadcrumbData(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Kolvex", path: "/" }, ...items].map((item, i) => ({
      "@type": "ListItem", position: i + 1, name: item.name,
      item: new URL(item.path, SITE_URL).toString(),
    })),
  };
}

export function plainExcerpt(text: string, limit = 150) {
  return text.replace(/<[^>]*>/g, "").replace(/[#*_`>\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, limit);
}
