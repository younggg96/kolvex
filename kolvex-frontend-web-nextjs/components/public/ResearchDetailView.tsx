"use client";

import Link from "next/link";
import { BarChart3, CheckCircle2, DollarSign, Newspaper, TrendingUp, Users } from "lucide-react";
import HeaderBackButton from "@/components/layout/HeaderBackButton";
import { DecisionBadge } from "@/components/trading-analysis/badges";
import {
  REPORT_READER_GRID,
  REPORT_READER_CONCLUSION,
  REPORT_READER_NAV,
} from "@/components/trading-analysis/reader-styles";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { applyResearchTranslation } from "@/lib/researchTranslation";
import { chineseTextLanguage } from "@/lib/contentLanguage";
import type { ResearchTranslation, TradingAnalysis } from "@/lib/tradingAnalysisApi";
import { publicStockPath } from "@/lib/publicRoutes";
import { MarkdownBody } from "@/components/trading-analysis/markdown";
import { ReadingHeading, ReadingDate, ReadingQuotesIcon } from "./ReadingElements";

export function ResearchDetailView({
  report: original,
  author,
  chinese,
}: {
  report: Pick<
    TradingAnalysis,
    | "ticker"
    | "trade_date"
    | "published_at"
    | "final_decision"
    | "full_signal"
    | "investment_plan"
    | "market_report"
    | "sentiment_report"
    | "news_report"
    | "fundamentals_report"
    | "trader_plan"
    | "investment_debate"
    | "risk_debate"
  >;
  author: string;
  chinese: ResearchTranslation | null;
}) {
  const c = useCopy();
  const { t, locale } = useTranslation();
  const report = locale === "zh" ? applyResearchTranslation(original, chinese) : original;
  const title = c(`${report.ticker} stock research`, `${report.ticker} 股票研究`);
  const sections = [
    [
      "conclusion",
      c("Research conclusion", "研究结论"),
      report.full_signal || report.final_decision,
    ],
    ["investment", c("Investment plan", "投资计划"), report.investment_plan],
    ["market", c("Market analysis", "市场分析"), report.market_report],
    ["sentiment", c("Sentiment analysis", "情绪分析"), report.sentiment_report],
    ["news", c("News analysis", "新闻分析"), report.news_report],
    ["fundamentals", c("Fundamental analysis", "基本面分析"), report.fundamentals_report],
    ["trader", c("Trading plan", "交易计划"), report.trader_plan],
  ].filter((section): section is string[] => !!section[2]);
  const debates = [
    {
      id: "investment",
      title: c("Investment debate", "投资讨论"),
      data: report.investment_debate,
      labels: {
        judge_decision: c("Investment verdict", "研究裁决"),
        bull_history: c("Bull case", "看多理由"),
        bear_history: c("Bear case", "看空理由"),
      },
    },
    {
      id: "risk",
      title: c("Risk debate", "风险讨论"),
      data: report.risk_debate,
      labels: {
        judge_decision: c("Risk verdict", "风险裁决"),
        aggressive_history: c("Aggressive view", "积极观点"),
        conservative_history: c("Conservative view", "谨慎观点"),
        neutral_history: c("Neutral view", "中性观点"),
      },
    },
  ];
  const sectionIcons = {
    conclusion: CheckCircle2,
    investment: DollarSign,
    market: BarChart3,
    sentiment: Users,
    news: Newspaper,
    fundamentals: DollarSign,
    trader: TrendingUp,
  };
  return (
    <>
      <div className="mb-6 flex items-center gap-2">
        <HeaderBackButton href="/research" label={c("Back to stock research", "返回股票研究")} />
        <nav
          aria-label={c("Breadcrumb", "面包屑")}
          className="flex flex-wrap gap-3 text-xs text-muted-foreground"
        >
          <Link href="/research" className="hover:underline">
            {c("Stock research", "股票研究")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={publicStockPath(report.ticker)} className="hover:underline">
            {report.ticker}
          </Link>
        </nav>
      </div>
      <div className="mb-8 border-b border-border pb-6">
        <ReadingHeading title={title} icon={<ReadingQuotesIcon ticker={report.ticker} />}>
          {c("Analysis date: ", "分析日期：")}
          <ReadingDate value={report.trade_date} />
          {c(
            ". This AI generated report reflects the data available at the time.",
            "。AI 生成的已发布研究，阅读时请留意数据时点。",
          )}
        </ReadingHeading>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-muted-foreground">
          <DecisionBadge decision={report.final_decision} t={t} />
          <span>
            {c("Published by: ", "发布者：")}
            {author}
          </span>
          {report.published_at && (
            <span>
              {c("Published on: ", "发布日期：")}
              <ReadingDate value={report.published_at} />
            </span>
          )}
        </div>
      </div>
      <div className={REPORT_READER_GRID}>
        {sections.length > 0 && (
          <nav
            aria-label={c("Report contents", "报告目录")}
            className="min-w-0 lg:sticky lg:top-6 lg:self-start"
          >
            <div className="flex gap-1 overflow-x-auto border-b border-border pb-3 lg:flex-col lg:gap-2 lg:border-b-0 lg:pb-0">
              {sections.map(([id, heading]) => (
                <a key={id} href={`#${id}`} className={REPORT_READER_NAV}>
                  {heading}
                </a>
              ))}
            </div>
          </nav>
        )}
        <article className="min-w-0 space-y-12">
          {sections.map(([id, heading, content]) => {
            const Icon = sectionIcons[id as keyof typeof sectionIcons];
            return (
              <section
                key={id}
                id={id}
                className={
                  id === "conclusion"
                    ? REPORT_READER_CONCLUSION
                    : "scroll-mt-6 border-t border-border pt-6"
                }
              >
                <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold">
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {heading}
                </h2>
                <div lang={chineseTextLanguage(content) ?? "en"}>
                  <MarkdownBody content={content} symbols={[report.ticker]} />
                </div>
              </section>
            );
          })}
          {debates.map(
            ({ id, title: heading, data, labels }) =>
              data && (
                <section key={id} className="space-y-5 border-t border-border pt-8">
                  <h2 className="text-xl font-semibold">{heading}</h2>
                  {Object.entries(labels).map(([key, label]) => {
                    const content = (data as unknown as Record<string, string>)[key];
                    return content ? (
                      <details
                        key={key}
                        open={key === "judge_decision"}
                        className="border-b border-border pb-5"
                      >
                        <summary className="cursor-pointer py-3 font-medium">{label}</summary>
                        <div lang={chineseTextLanguage(content) ?? "en"}>
                          <MarkdownBody content={content} symbols={[report.ticker]} />
                        </div>
                      </details>
                    ) : null;
                  })}
                </section>
              ),
          )}
          {!sections.length && !report.investment_debate && !report.risk_debate && (
            <p className="text-muted-foreground">
              {c("This report has no body text.", "该报告未提供正文。")}
            </p>
          )}
        </article>
      </div>
      <div className="mt-12 border-t border-border pt-8">
        <Link
          href={publicStockPath(report.ticker)}
          className="inline-block py-3 text-positive underline underline-offset-4"
        >
          {c(
            `Read creator opinions and more research on ${report.ticker}`,
            `阅读 ${report.ticker} 的博主观点与更多研究`,
          )}
        </Link>
      </div>
    </>
  );
}
