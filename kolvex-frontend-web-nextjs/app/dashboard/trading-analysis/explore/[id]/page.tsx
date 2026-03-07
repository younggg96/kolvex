"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  TrendingUp,
  Clock,
  Calendar,
  BarChart3,
  Newspaper,
  Users,
  DollarSign,
  Swords,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Globe,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { SwitchTab } from "@/components/ui/switch-tab";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  getPublishedAnalysis,
  type TradingAnalysis,
} from "@/lib/tradingAnalysisApi";
import { DecisionBadgeLarge } from "@/components/trading-analysis/badges";
import { ReportCard } from "@/components/trading-analysis/report-card";
import { DebateCard } from "@/components/trading-analysis/debate-card";
import { DetailSkeleton } from "@/components/trading-analysis/skeletons";
import CompanyLogo from "@/components/ui/company-logo";

export default function PublishedAnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const analysisId = params.id as string;

  const [analysis, setAnalysis] = useState<TradingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeReportTab, setActiveReportTab] = useState("market");

  const loadAnalysis = useCallback(async () => {
    try {
      const data = await getPublishedAnalysis(analysisId);
      setAnalysis(data);
    } catch (e) {
      console.error("Failed to load published analysis:", e);
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  useEffect(() => {
    if (analysis?.status === "completed") {
      const tabs = [
        analysis.market_report ? "market" : null,
        analysis.sentiment_report ? "sentiment" : null,
        analysis.news_report ? "news" : null,
        analysis.fundamentals_report ? "fundamentals" : null,
      ];
      const first = tabs.find(Boolean) || "market";
      setActiveReportTab(first);
    }
  }, [analysis]);

  if (loading) {
    return (
      <DashboardLayout title={t("tradingAnalysis.explore.title")}>
        <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
          <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
          <div className="relative">
            <DetailSkeleton />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analysis) {
    return (
      <DashboardLayout title={t("tradingAnalysis.explore.title")}>
        <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
          <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
          <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] gap-4">
            <XCircle className="w-12 h-12 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">
              {t("tradingAnalysis.notFound")}
            </p>
            <Button
              variant="ghost"
              onClick={() =>
                router.push("/dashboard/trading-analysis/explore")
              }
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("common.back")}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const reportTabs = [
    {
      key: "market",
      title: t("tradingAnalysis.tabs.market"),
      icon: BarChart3,
      content: analysis.market_report,
    },
    {
      key: "sentiment",
      title: t("tradingAnalysis.tabs.sentiment"),
      icon: Users,
      content: analysis.sentiment_report,
    },
    {
      key: "news",
      title: t("tradingAnalysis.tabs.news"),
      icon: Newspaper,
      content: analysis.news_report,
    },
    {
      key: "fundamentals",
      title: t("tradingAnalysis.tabs.fundamentals"),
      icon: DollarSign,
      content: analysis.fundamentals_report,
    },
  ];

  return (
    <DashboardLayout
      title={t("tradingAnalysis.pageTitle", { ticker: analysis.ticker })}
      headerLeftAction={
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.push("/dashboard/trading-analysis/explore")
          }
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">
            {t("tradingAnalysis.explore.backToExplore")}
          </span>
        </Button>
      }
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

        <div className="relative p-4 space-y-6 mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
            <div>
              <div className="flex items-center gap-3">
                <CompanyLogo symbol={analysis.ticker} size="lg" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analysis.ticker}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary dark:bg-primary/20">
                  <CheckCircle2 className="w-3 h-3" />
                  {t("tradingAnalysis.statusCompleted")}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400">
                  <Globe className="w-3 h-3" />
                  {t("tradingAnalysis.publishedLabel")}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-3 text-sm text-gray-500 dark:text-gray-400">
                {analysis.author && (
                  <span className="flex items-center gap-1.5">
                    <Avatar className="w-5 h-5">
                      {analysis.author.avatar_url && (
                        <AvatarImage src={analysis.author.avatar_url} alt="" />
                      )}
                      <AvatarFallback className="text-[9px] bg-gray-200 dark:bg-gray-700">
                        <User className="w-3 h-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {analysis.author.full_name || analysis.author.username || "User"}
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {analysis.trade_date}
                </span>
                {analysis.duration_seconds && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {t("tradingAnalysis.durationSeconds", {
                      seconds: String(Math.round(analysis.duration_seconds)),
                    })}
                  </span>
                )}
                {analysis.llm_provider && (
                  <span className="capitalize px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">
                    {analysis.llm_provider}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <DecisionBadgeLarge decision={analysis.final_decision} t={t} />
            </div>
          </div>

          {/* Reports */}
          {reportTabs.map((tab) =>
            tab.key === activeReportTab ? (
              <div key={tab.key} className="animate-fade-in-up stagger-1">
                <ReportCard
                  title={tab.title}
                  icon={tab.icon}
                  content={tab.content}
                  locale={locale}
                  t={t}
                  headerExtra={
                    <SwitchTab
                      options={reportTabs.map((rt) => ({
                        value: rt.key,
                        label: rt.title,
                        icon: <rt.icon className="w-3.5 h-3.5" />,
                        disabled: !rt.content,
                      }))}
                      value={activeReportTab}
                      onValueChange={setActiveReportTab}
                      className="!w-fit"
                      size="sm"
                    />
                  }
                />
              </div>
            ) : null
          )}

          <div className="animate-fade-in-up stagger-2">
            <ReportCard
              title={t("tradingAnalysis.sections.investmentPlan")}
              icon={DollarSign}
              content={analysis.investment_plan}
              locale={locale}
              t={t}
            />
          </div>

          <div className="animate-fade-in-up stagger-3">
            <DebateCard
              title={t("tradingAnalysis.sections.investmentDebate")}
              icon={Swords}
              debate={
                analysis.investment_debate as Record<string, string> | null
              }
              bullLabel={t("tradingAnalysis.debate.bullResearcher")}
              bearLabel={t("tradingAnalysis.debate.bearResearcher")}
              judgeLabel={t("tradingAnalysis.debate.judgeDecision")}
              locale={locale}
              t={t}
            />
          </div>

          <div className="animate-fade-in-up stagger-4">
            <ReportCard
              title={t("tradingAnalysis.sections.traderPlan")}
              icon={TrendingUp}
              content={analysis.trader_plan}
              locale={locale}
              t={t}
            />
          </div>

          <div className="animate-fade-in-up stagger-5">
            <DebateCard
              title={t("tradingAnalysis.sections.riskDebate")}
              icon={ShieldCheck}
              debate={
                analysis.risk_debate as Record<string, string> | null
              }
              bullLabel={t("tradingAnalysis.debate.aggressiveAnalyst")}
              bearLabel={t("tradingAnalysis.debate.conservativeAnalyst")}
              judgeLabel={t("tradingAnalysis.debate.judgeDecision")}
              locale={locale}
              t={t}
            />
          </div>

          <div className="animate-fade-in-up stagger-5">
            <ReportCard
              title={t("tradingAnalysis.sections.finalSignal")}
              icon={CheckCircle2}
              content={analysis.full_signal}
              locale={locale}
              t={t}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
