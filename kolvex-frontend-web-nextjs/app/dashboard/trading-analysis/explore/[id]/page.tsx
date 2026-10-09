"use client";

import HeaderBackButton from "@/components/layout/HeaderBackButton";
import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Clock,
  Calendar,
  XCircle,
  Globe,
  User,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { deepResearchPagePath, parseDeepResearchPage } from "@/lib/researchRoutes";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  getPublishedAnalysis,
  type TradingAnalysis,
} from "@/lib/tradingAnalysisApi";
import { DecisionBadge } from "@/components/trading-analysis/badges";
import { ResearchReportContent } from "@/components/trading-analysis/ResearchReportContent";
import { DetailSkeleton } from "@/components/trading-analysis/skeletons";
import { FullReportActions } from "@/components/trading-analysis/report-actions";
import CompanyLogo from "@/components/ui/company-logo";

export default function PublishedAnalysisDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();
  const analysisId = params.id as string;
  const listPath = deepResearchPagePath(parseDeepResearchPage(searchParams.get("page")));

  const [analysis, setAnalysis] = useState<TradingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

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
    const heading = analysis?.ticker
      ? t("tradingAnalysis.pageTitle", { ticker: analysis.ticker })
      : t("tradingAnalysis.title");
    document.title = `${heading} · ${t("sidebar.tradingAnalysis")} — Kolvex`;
  }, [analysis?.ticker, t]);

  const backAction = <HeaderBackButton href={listPath} label={t("tradingAnalysis.explore.backToExplore")} />;

  if (loading) {
    return (
      <DashboardLayout title={t("tradingAnalysis.explore.title")} headerLeftAction={backAction}>
        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1120px]">
            <DetailSkeleton />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analysis) {
    return (
      <DashboardLayout title={t("tradingAnalysis.explore.title")} headerLeftAction={backAction}>
        <div className="relative flex-1 overflow-y-auto">
          <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] gap-4">
            <XCircle className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {t("tradingAnalysis.notFound")}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={t("tradingAnalysis.pageTitle", { ticker: analysis.ticker })}
      headerLeftAction={backAction}
      headerActions={
        <FullReportActions analysis={analysis} t={t} />
      }
    >
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1120px] space-y-10 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          {/* Header */}
          <div className="border-b border-border pb-6">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <CompanyLogo symbol={analysis.ticker} size="lg" />
                <h1 className="text-[28px] font-bold leading-tight text-foreground md:text-[32px]">
                  {analysis.ticker}
                </h1>
                <DecisionBadge decision={analysis.final_decision} t={t} />
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  <Globe className="w-3 h-3" />
                  {t("tradingAnalysis.publishedLabel")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {analysis.author && (
                  <span className="flex items-center gap-1.5">
                    <Avatar className="w-5 h-5">
                      {analysis.author.avatar_url && (
                        <AvatarImage src={analysis.author.avatar_url} alt="" />
                      )}
                      <AvatarFallback className="text-[9px] bg-muted">
                        <User className="w-3 h-3" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-muted-foreground">
                      {analysis.author.full_name || analysis.author.username || t("research.author")}
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
                  <span className="capitalize">
                    {analysis.llm_provider}
                  </span>
                )}
              </div>
            </div>
          </div>

          <ResearchReportContent key={analysis.id} analysis={analysis} locale={locale} t={t} />
        </div>
      </div>
    </DashboardLayout>
  );
}
