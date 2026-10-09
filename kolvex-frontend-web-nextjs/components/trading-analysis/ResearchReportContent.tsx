"use client";

import { useId, useState } from "react";
import { BarChart3, CheckCircle2, DollarSign, Newspaper, ShieldCheck, Swords, TrendingUp, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { TradingAnalysis } from "@/lib/tradingAnalysisApi";
import { ReportCard } from "./report-card";
import { DebateCard } from "./debate-card";

/** Shared reading order for published reports and completed authoring reports. */
export function ResearchReportContent({ analysis, locale, t }: {
  analysis: TradingAnalysis;
  locale: string;
  t: (key: string) => string;
}) {
  const id = useId().replace(/:/g, "");
  const reports = [
    { key: "market", title: t("tradingAnalysis.tabs.market"), icon: BarChart3, content: analysis.market_report },
    { key: "sentiment", title: t("tradingAnalysis.tabs.sentiment"), icon: Users, content: analysis.sentiment_report },
    { key: "news", title: t("tradingAnalysis.tabs.news"), icon: Newspaper, content: analysis.news_report },
    { key: "fundamentals", title: t("tradingAnalysis.tabs.fundamentals"), icon: DollarSign, content: analysis.fundamentals_report },
  ].filter((report) => report.content);
  const [selected, setSelected] = useState(reports[0]?.key || "market");
  const active = reports.some((report) => report.key === selected) ? selected : reports[0]?.key;
  const sections = [
    { key: "conclusion", label: t("tradingAnalysis.reader.conclusion"), present: analysis.full_signal },
    { key: "investment", label: t("tradingAnalysis.sections.investmentPlan"), present: analysis.investment_plan },
    { key: "evidence", label: t("tradingAnalysis.reader.evidence"), present: reports.length },
    { key: "trader", label: t("tradingAnalysis.sections.traderPlan"), present: analysis.trader_plan },
    { key: "discussion", label: t("tradingAnalysis.reader.discussion"), present: analysis.investment_debate || analysis.risk_debate },
  ].filter((section) => section.present);
  if (!sections.length) return null;

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[168px_minmax(0,1fr)] lg:gap-12">
      <nav aria-label={t("tradingAnalysis.reader.contents")} className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <div className="flex gap-1 overflow-x-auto border-b border-border pb-3 lg:flex-col lg:gap-2 lg:border-b-0 lg:pb-0">
          {sections.map((section) => (
            <a key={section.key} href={`#${id}-${section.key}`} className="flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              {section.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="min-w-0 space-y-12">
        {analysis.full_signal && (
          <div id={`${id}-conclusion`} className="scroll-mt-6 rounded-xl bg-muted/60 p-5 md:p-8">
            <ReportCard title={t("tradingAnalysis.reader.conclusion")} icon={CheckCircle2} content={analysis.full_signal} locale={locale} t={t} bordered={false} />
          </div>
        )}
        {analysis.investment_plan && (
          <div id={`${id}-investment`} className="scroll-mt-6">
            <ReportCard title={t("tradingAnalysis.sections.investmentPlan")} icon={DollarSign} content={analysis.investment_plan} locale={locale} t={t} />
          </div>
        )}
        {!!reports.length && (
          <section id={`${id}-evidence`} className="min-w-0 scroll-mt-6">
            <h2 className="mb-5 text-xl font-semibold">{t("tradingAnalysis.reader.evidence")}</h2>
            <Tabs value={active} onValueChange={setSelected}>
              <div className="mb-6 min-w-0 overflow-x-auto border-b border-border">
                <TabsList className="h-auto justify-start gap-1 rounded-none bg-transparent p-0">
                  {reports.map((report) => (
                    <TabsTrigger key={report.key} value={report.key} className="min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-4 py-3 text-sm text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
                      {report.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {reports.map((report) => (
                <TabsContent key={report.key} value={report.key} className="mt-0">
                  <ReportCard title={report.title} icon={report.icon} content={report.content} locale={locale} t={t} bordered={false} />
                </TabsContent>
              ))}
            </Tabs>
          </section>
        )}
        {analysis.trader_plan && (
          <div id={`${id}-trader`} className="scroll-mt-6">
            <ReportCard title={t("tradingAnalysis.sections.traderPlan")} icon={TrendingUp} content={analysis.trader_plan} locale={locale} t={t} />
          </div>
        )}
        {(analysis.investment_debate || analysis.risk_debate) && (
          <section id={`${id}-discussion`} className="scroll-mt-6 space-y-10">
            <h2 className="text-xl font-semibold">{t("tradingAnalysis.reader.discussion")}</h2>
            <DebateCard title={t("tradingAnalysis.sections.investmentDebate")} icon={Swords} debate={analysis.investment_debate as unknown as Record<string, string> | null} bullLabel={t("tradingAnalysis.debate.bullResearcher")} bearLabel={t("tradingAnalysis.debate.bearResearcher")} judgeLabel={t("tradingAnalysis.debate.judgeDecision")} locale={locale} t={t} />
            <DebateCard title={t("tradingAnalysis.sections.riskDebate")} icon={ShieldCheck} debate={analysis.risk_debate as unknown as Record<string, string> | null} bullLabel={t("tradingAnalysis.debate.aggressiveAnalyst")} bearLabel={t("tradingAnalysis.debate.conservativeAnalyst")} judgeLabel={t("tradingAnalysis.debate.judgeDecision")} locale={locale} t={t} />
          </section>
        )}
      </div>
    </div>
  );
}
