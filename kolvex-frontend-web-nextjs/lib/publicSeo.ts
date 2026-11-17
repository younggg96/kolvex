import { formatOpinionDate } from "@/lib/opinionDates";
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
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: new URL(item.path, SITE_URL).toString(),
    })),
  };
}

export function plainExcerpt(text: string, limit = 150) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/[#*_`>\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

const SENTIMENT_LABEL: Record<string, string> = {
  bullish: "看多",
  bearish: "看空",
  neutral: "中性",
};

type PublicOpinion = {
  id?: string;
  ticker: string;
  company_name?: string | null;
  sentiment?: string | null;
  channel_title?: string | null;
  channel_url?: string | null;
  opinion_date?: string | null;
  video_url?: string | null;
  summary?: string | null;
  thesis?: string | null;
};

type OpinionCounts = {
  total_opinions: number;
  total_creators: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
};

export function sentimentLabel(sentiment?: string | null) {
  return (sentiment && SENTIMENT_LABEL[sentiment]) || "未标注";
}

/** Machine-readable `Comment` for one recorded creator opinion; every field comes from the record. */
function opinionComment(opinion: PublicOpinion) {
  const text = opinion.summary || opinion.thesis;
  return {
    "@type": "Comment",
    ...(text ? { text } : {}),
    ...(opinion.opinion_date ? { dateCreated: opinion.opinion_date } : {}),
    ...(opinion.channel_title
      ? {
          author: {
            "@type": "Person",
            name: opinion.channel_title,
            ...(opinion.channel_url ? { url: opinion.channel_url } : {}),
          },
        }
      : {}),
    ...(opinion.video_url ? { url: opinion.video_url, isBasedOn: opinion.video_url } : {}),
    about: {
      "@type": "Corporation",
      tickerSymbol: opinion.ticker,
      ...(opinion.company_name ? { name: opinion.company_name } : {}),
    },
    keywords: sentimentLabel(opinion.sentiment),
  };
}

/** Collection page whose list items are the creator opinions shown on the page. */
export function opinionCollectionData(
  name: string,
  path: string,
  opinions: PublicOpinion[],
  about?: Record<string, unknown>,
) {
  const url = new URL(path, SITE_URL).toString();
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url,
    inLanguage: "zh-CN",
    isAccessibleForFree: true,
    ...(about ? { about } : {}),
    publisher: { "@type": "Organization", name: "Kolvex", url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: opinions.length,
      itemListElement: opinions.map((opinion, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: opinionComment(opinion),
      })),
    },
  };
}

/**
 * One-paragraph answer for a stock page, built only from recorded counts.
 * Returns null when there is nothing recorded, so callers never show invented numbers.
 */
export function stockOpinionSummary(
  ticker: string,
  counts: OpinionCounts | null | undefined,
  latest: PublicOpinion | null | undefined,
  researchTotal: number,
  locale: "zh" | "en" = "zh",
) {
  if (locale === "en") {
    const parts: string[] = [];
    if (counts && counts.total_opinions > 0) {
      const creators =
        counts.total_creators > 0
          ? ` from ${counts.total_creators} ${counts.total_creators === 1 ? "creator" : "creators"}`
          : "";
      parts.push(
        `Kolvex has recorded ${counts.total_opinions} ${counts.total_opinions === 1 ? "opinion" : "opinions"} on ${ticker}${creators}: ${counts.bullish_count} bullish, ${counts.bearish_count} bearish, and ${counts.neutral_count} neutral.`,
      );
      if (latest?.opinion_date && latest.channel_title) {
        const date = formatOpinionDate(latest.opinion_date, "en-US");
        const direction =
          latest.sentiment === "bullish" ||
          latest.sentiment === "bearish" ||
          latest.sentiment === "neutral" ||
          latest.sentiment === "mixed"
            ? latest.sentiment
            : null;
        const byline = [date, direction].filter(Boolean).join(", ");
        parts.push(
          `The latest opinion comes from ${latest.channel_title}${byline ? ` (${byline})` : ""}.`,
        );
      }
    }
    if (researchTotal > 0)
      parts.push(
        `Published AI research on ${ticker}: ${researchTotal} ${researchTotal === 1 ? "report" : "reports"}.`,
      );
    return parts.length ? parts.join(" ") : null;
  }

  const parts: string[] = [];
  if (counts && counts.total_opinions > 0) {
    const creators =
      counts.total_creators > 0
        ? `${counts.total_creators} 位博主对 ${ticker} 的 `
        : `对 ${ticker} 的 `;
    parts.push(
      `Kolvex 共收录 ${creators}${counts.total_opinions} 条观点：看多 ${counts.bullish_count} 条、看空 ${counts.bearish_count} 条、中性 ${counts.neutral_count} 条。`,
    );
    if (latest?.opinion_date && latest.channel_title) {
      parts.push(
        `最近一条来自「${latest.channel_title}」（${latest.opinion_date}，${sentimentLabel(latest.sentiment)}）。`,
      );
    }
  }
  if (researchTotal > 0) parts.push(`另有 ${researchTotal} 篇已发布的 ${ticker} AI 研究报告。`);
  return parts.length ? parts.join("") : null;
}
