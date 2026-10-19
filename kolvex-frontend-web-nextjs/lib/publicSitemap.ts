import type { MetadataRoute } from "next";
import { getPublicOpinions, getPublicResearchList } from "@/lib/publicContent";
import { SITE_URL } from "@/lib/seo";
import { creatorSharePath } from "@/lib/creatorSharing";
import { PUBLIC_PAGE_SIZE, publicPagePath, publicResearchPath, publicStockPath, validChannelId, validTicker } from "@/lib/publicRoutes";

export async function buildPublicSitemap(): Promise<MetadataRoute.Sitemap> {
  const urls = new Map<string, MetadataRoute.Sitemap[number]>();
  const add = (path: string, modified?: string | null) => {
    const url = new URL(path, SITE_URL).toString();
    const date = modified ? new Date(modified) : null;
    urls.set(url, { url, ...(date && !Number.isNaN(date.getTime()) ? { lastModified: date } : {}) });
  };
  ["/", "/contact", "/privacy", "/terms", "/research", "/creators", "/stocks"].forEach((path) => add(path));
  const [opinions, first] = await Promise.all([getPublicOpinions(), getPublicResearchList(0, 100)]);
  const creators = (opinions?.creators || []).filter((creator) => validChannelId(creator.channel_id) && creator.total_opinions > 0);
  const stocks = (opinions?.stocks || []).filter((stock) => validTicker(stock.ticker) && stock.total_opinions > 0);
  creators.forEach((creator) => add(creatorSharePath(creator.channel_id), creator.latest_opinion_at));
  stocks.forEach((stock) => add(publicStockPath(stock.ticker), stock.latest_opinion_at));
  const paginate = (path: string, total: number) => {
    for (let page = 2; page <= Math.ceil(total / PUBLIC_PAGE_SIZE); page++) add(publicPagePath(path, page));
  };
  paginate("/research", first.total);
  paginate("/creators", creators.length);
  paginate("/stocks", stocks.length);
  stocks.forEach((stock) => paginate(publicStockPath(stock.ticker), stock.total_opinions));
  let batch = first;
  for (let offset = 0; ; offset += 100) {
    if (offset) batch = await getPublicResearchList(offset, 100);
    batch.items.forEach((report) => {
      add(publicResearchPath(report.id), report.published_at);
      if (!stocks.some((stock) => stock.ticker === report.ticker)) add(publicStockPath(report.ticker));
    });
    if (offset + 100 >= batch.total) break;
    if (!batch.items.length) throw new Error("Public research sitemap pagination is incomplete");
  }
  // Fail visibly rather than emit an invalid oversized sitemap.
  if (urls.size > 50_000) throw new Error("Public sitemap needs to be split into multiple sitemaps");
  return Array.from(urls.values());
}
