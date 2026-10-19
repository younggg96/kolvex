import Link from "next/link";
import { BarChart3, CheckCircle2, DollarSign, Newspaper, TrendingUp, Users } from "lucide-react";
import CompanyLogo from "@/components/ui/company-logo";
import HeaderBackButton from "@/components/layout/HeaderBackButton";
import { DecisionBadge } from "@/components/trading-analysis/badges";
import { REPORT_READER_GRID, REPORT_READER_CONCLUSION, REPORT_READER_NAV } from "@/components/trading-analysis/reader-styles";
import { publicCopy } from "@/lib/publicCopy";
import { notFound } from "next/navigation";
import { getPublicResearch } from "@/lib/publicContent";
import { publicResearchPath, publicStockPath } from "@/lib/publicRoutes";
import { readingMetadata, breadcrumbData, plainExcerpt } from "@/lib/publicSeo";
import { SITE_URL } from "@/lib/seo";
import { MarkdownBody } from "@/components/trading-analysis/markdown";
import { ReadingHeading, ReadingDate } from "@/components/public/ReadingElements";
import { ReadingSchema } from "@/components/public/ReadingSchema";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props) {
  const report = await getPublicResearch(params.id);
  if (!report) notFound();
  const title = `${report.ticker} 股票研究 — ${report.trade_date} | Kolvex`;
  const description = plainExcerpt(report.full_signal || report.investment_plan || `${report.ticker} 已发布 AI 股票研究，阅读市场、基本面证据与多方讨论。`);
  const metadata = readingMetadata(title, description, publicResearchPath(report.id));
  return { ...metadata, openGraph: { ...metadata.openGraph, type: "article", ...(report.published_at ? { publishedTime: report.published_at } : {}) } };
}

export default async function ResearchDetailPage({ params }: Props) {
  const report = await getPublicResearch(params.id);
  if (!report) notFound();
  const title = `${report.ticker} 股票研究`;
  const sections = [
    ["conclusion", "研究结论", report.full_signal || report.final_decision],
    ["investment", "投资计划", report.investment_plan],
    ["market", "市场分析", report.market_report],
    ["sentiment", "情绪分析", report.sentiment_report],
    ["news", "新闻分析", report.news_report],
    ["fundamentals", "基本面分析", report.fundamentals_report],
    ["trader", "交易计划", report.trader_plan],
  ].filter((section): section is string[] => !!section[2]);
  const debates = [
    { title: "投资讨论", data: report.investment_debate, labels: { judge_decision: "研究裁决", bull_history: "看多理由", bear_history: "看空理由" } },
    { title: "风险讨论", data: report.risk_debate, labels: { judge_decision: "风险裁决", aggressive_history: "积极观点", conservative_history: "谨慎观点", neutral_history: "中性观点" } },
  ];
  const sectionIcons = { conclusion: CheckCircle2, investment: DollarSign, market: BarChart3, sentiment: Users, news: Newspaper, fundamentals: DollarSign, trader: TrendingUp };
  const author = report.author?.full_name || report.author?.username || "Kolvex";
  return <>
    <ReadingSchema data={breadcrumbData([{ name: "股票研究", path: "/research" }, { name: title, path: publicResearchPath(report.id) }])} />
    <ReadingSchema data={{
      "@context": "https://schema.org", "@type": "Article", headline: `${title} — ${report.trade_date}`,
      description: plainExcerpt(report.full_signal || report.investment_plan || title),
      mainEntityOfPage: `${SITE_URL}${publicResearchPath(report.id)}`,
      ...(report.published_at ? { datePublished: report.published_at } : {}),
      author: { "@type": report.author ? "Person" : "Organization", name: author },
      publisher: { "@type": "Organization", name: "Kolvex", url: SITE_URL },
    }} />
    <div className="mb-6 flex items-center gap-2"><HeaderBackButton href="/research" label="返回股票研究" /><nav aria-label="面包屑" className="flex flex-wrap gap-3 text-xs text-muted-foreground"><Link href="/research" className="hover:underline">股票研究</Link><span aria-hidden="true">/</span><Link href={publicStockPath(report.ticker)} className="hover:underline">{report.ticker}</Link></nav></div>
    <div className="mb-8 border-b border-border pb-6">
      <ReadingHeading title={title} icon={<CompanyLogo symbol={report.ticker} size="lg" />}>分析日期：<ReadingDate value={report.trade_date} />。AI 生成的已发布研究，阅读时请留意数据时点。</ReadingHeading>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-muted-foreground"><DecisionBadge decision={report.final_decision} t={publicCopy} /><span>发布者：{author}</span>{report.published_at && <span>发布时间：<ReadingDate value={report.published_at} /></span>}</div>
    </div>
    <div className={REPORT_READER_GRID}>
      {sections.length > 0 && <nav aria-label="报告目录" className="min-w-0 lg:sticky lg:top-6 lg:self-start"><div className="flex gap-1 overflow-x-auto border-b border-border pb-3 lg:flex-col lg:gap-2 lg:border-b-0 lg:pb-0">{sections.map(([id, heading]) => <a key={id} href={`#${id}`} className={REPORT_READER_NAV}>{heading}</a>)}</div></nav>}
    <article className="min-w-0 space-y-12">
      {sections.map(([id, heading, content]) => {
        const Icon = sectionIcons[id as keyof typeof sectionIcons];
        return <section key={id} id={id} className={id === "conclusion" ? REPORT_READER_CONCLUSION : "scroll-mt-6 border-t border-border pt-6"}><h2 className="mb-6 flex items-center gap-2 text-xl font-semibold"><Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />{heading}</h2><MarkdownBody content={content} /></section>;
      })}
      {debates.map(({ title: heading, data, labels }) => data && <section key={heading} className="space-y-5 border-t border-border pt-8"><h2 className="text-xl font-semibold">{heading}</h2>{Object.entries(labels).map(([key, label]) => {
        const content = (data as unknown as Record<string, string>)[key];
        return content ? <details key={key} open={key === "judge_decision"} className="border-b border-border pb-5"><summary className="cursor-pointer py-3 font-medium">{label}</summary><MarkdownBody content={content} /></details> : null;
      })}</section>)}
      {!sections.length && !report.investment_debate && !report.risk_debate && <p className="text-muted-foreground">该报告未提供正文。</p>}
    </article>
    </div>
    <div className="mt-12 border-t border-border pt-8"><Link href={publicStockPath(report.ticker)} className="inline-block py-3 text-positive underline underline-offset-4">阅读 {report.ticker} 的博主观点与更多研究</Link></div>
  </>;
}
