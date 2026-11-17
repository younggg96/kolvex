import { ResearchDetailView } from "@/components/public/ResearchDetailView";
import { notFound } from "next/navigation";
import { applyResearchTranslation, storedTranslation } from "@/lib/researchTranslation";
import { getPublicResearch } from "@/lib/publicContent";
import { publicResearchPath, publicStockPath } from "@/lib/publicRoutes";
import { readingMetadata, breadcrumbData, plainExcerpt } from "@/lib/publicSeo";
import { SITE_URL } from "@/lib/seo";
import { ReadingSchema } from "@/components/public/ReadingSchema";

type Props = { params: { id: string } };

// Render each report on first visit, then serve it from the ISR cache.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props) {
  const report = await getPublicResearch(params.id);
  if (!report) notFound();
  const title = `${report.ticker} 股票研究 — ${report.trade_date} | Kolvex`;
  const chinese = applyResearchTranslation(report, storedTranslation(report, "zh"));
  const description = plainExcerpt(
    chinese.full_signal ||
      chinese.investment_plan ||
      `${report.ticker} 已发布 AI 股票研究，阅读市场、基本面证据与多方讨论。`,
  );
  const metadata = readingMetadata(title, description, publicResearchPath(report.id));
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
      ...(report.published_at ? { publishedTime: report.published_at } : {}),
    },
  };
}

export default async function ResearchDetailPage({ params }: Props) {
  const report = await getPublicResearch(params.id);
  if (!report) notFound();
  const title = `${report.ticker} 股票研究`;
  const chinese = storedTranslation(report, "zh");
  const localized = applyResearchTranslation(report, chinese);
  const author = report.author?.full_name || report.author?.username || "Kolvex";
  return (
    <>
      <ReadingSchema
        data={breadcrumbData([
          { name: "股票研究", path: "/research" },
          { name: title, path: publicResearchPath(report.id) },
        ])}
      />
      <ReadingSchema
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: `${title} — ${report.trade_date}`,
          description: plainExcerpt(localized.full_signal || localized.investment_plan || title),
          mainEntityOfPage: `${SITE_URL}${publicResearchPath(report.id)}`,
          ...(report.published_at ? { datePublished: report.published_at } : {}),
          author: { "@type": report.author ? "Person" : "Organization", name: author },
          about: { "@type": "Corporation", tickerSymbol: report.ticker },
          genre: "AI 生成的股票研究",
          inLanguage: "zh-CN",
          isAccessibleForFree: true,
          publisher: { "@type": "Organization", name: "Kolvex", url: SITE_URL },
        }}
      />
      <ResearchDetailView
        author={author}
        chinese={chinese}
        report={{
          ticker: report.ticker,
          trade_date: report.trade_date,
          published_at: report.published_at,
          final_decision: report.final_decision,
          full_signal: report.full_signal,
          investment_plan: report.investment_plan,
          market_report: report.market_report,
          sentiment_report: report.sentiment_report,
          news_report: report.news_report,
          fundamentals_report: report.fundamentals_report,
          trader_plan: report.trader_plan,
          investment_debate: report.investment_debate,
          risk_debate: report.risk_debate,
        }}
      />
    </>
  );
}
