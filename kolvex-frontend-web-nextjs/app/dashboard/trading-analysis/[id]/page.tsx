"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
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
  Lock,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SwitchTab } from "@/components/ui/switch-tab";
import {
  getAnalysis,
  streamAnalysisProgress,
  publishAnalysis,
  unpublishAnalysis,
  type TradingAnalysis,
  type ProgressEvent,
} from "@/lib/tradingAnalysisApi";
import { toast } from "sonner";
import { DecisionBadgeLarge } from "@/components/trading-analysis/badges";
import { ReportCard } from "@/components/trading-analysis/report-card";
import { DebateCard } from "@/components/trading-analysis/debate-card";
import { DetailSkeleton } from "@/components/trading-analysis/skeletons";
import { ProgressLog } from "@/components/trading-analysis/progress-log";

const STAGES = [
  { key: "initializing", icon: Bot },
  { key: "analysts", icon: BarChart3 },
  { key: "debate", icon: Swords },
  { key: "trader", icon: DollarSign },
  { key: "risk", icon: ShieldCheck },
  { key: "completed", icon: CheckCircle2 },
] as const;

const STAGE_ORDER: string[] = STAGES.map((s) => s.key);

export default function TradingAnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const analysisId = params.id as string;

  const [analysis, setAnalysis] = useState<TradingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([]);
  const [currentStage, setCurrentStage] = useState("initializing");
  const [activeReportTab, setActiveReportTab] = useState("market");
  const cleanupRef = useRef<(() => void) | null>(null);

  const loadAnalysis = useCallback(async () => {
    try {
      const data = await getAnalysis(analysisId);
      setAnalysis(data);
      if (data.status === "completed") setCurrentStage("completed");
      if (data.status === "failed") setCurrentStage("failed");
      return data;
    } catch (e) {
      console.error("Failed to load analysis:", e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  const handlePublishToggle = useCallback(async () => {
    if (!analysis || publishing) return;
    setPublishing(true);
    try {
      if (analysis.is_published) {
        await unpublishAnalysis(analysisId);
        setAnalysis((prev) =>
          prev ? { ...prev, is_published: false, published_at: null } : prev
        );
        toast.success(t("tradingAnalysis.unpublished"));
      } else {
        await publishAnalysis(analysisId);
        setAnalysis((prev) =>
          prev
            ? { ...prev, is_published: true, published_at: new Date().toISOString() }
            : prev
        );
        toast.success(t("tradingAnalysis.published"));
      }
    } catch (e: any) {
      toast.error(e.message || t("tradingAnalysis.publishFailed"));
    } finally {
      setPublishing(false);
    }
  }, [analysis, publishing, analysisId, t]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const startPolling = () => {
      if (cancelled) return;
      pollTimer = setTimeout(async () => {
        if (cancelled) return;
        const data = await loadAnalysis();
        if (data && data.status === "running") {
          startPolling();
        }
      }, 10_000);
    };

    const connectSSE = () => {
      if (cancelled) return;
      cleanupRef.current?.();
      const cleanup = streamAnalysisProgress(
        analysisId,
        (event) => {
          if (cancelled) return;
          setProgressEvents((prev) => [...prev, event]);
          if (event.stage) {
            setCurrentStage((prev) => {
              const prevIdx = STAGE_ORDER.indexOf(prev);
              const nextIdx = STAGE_ORDER.indexOf(event.stage);
              return nextIdx > prevIdx ? event.stage : prev;
            });
          }
        },
        () => {
          if (cancelled) return;
          loadAnalysis().then((data) => {
            if (!cancelled && data?.status === "running") {
              startPolling();
            }
          });
        },
        () => {
          if (!cancelled) loadAnalysis();
        }
      );
      cleanupRef.current = cleanup;
    };

    loadAnalysis().then((data) => {
      if (cancelled) return;
      if (data && data.status === "running") {
        connectSSE();
      }
    });

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [analysisId, loadAnalysis]);

  const activeStageIdx = Math.max(
    STAGES.findIndex((s) => s.key === currentStage),
    0
  );

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
      <DashboardLayout title={t("tradingAnalysis.title")}>
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
      <DashboardLayout title={t("tradingAnalysis.title")}>
        <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
          <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
          <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] gap-4">
            <XCircle className="w-12 h-12 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">
              {t("tradingAnalysis.notFound")}
            </p>
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/trading-analysis")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("common.back")}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isRunning = analysis.status === "running";
  const isCompleted = analysis.status === "completed";
  const isFailed = analysis.status === "failed";

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

  const firstAvailableTab =
    reportTabs.find((tab) => !!tab.content)?.key || "market";

  return (
    <DashboardLayout
      title={t("tradingAnalysis.pageTitle", { ticker: analysis.ticker })}
      headerLeftAction={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/trading-analysis")}
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">
            {t("tradingAnalysis.backToList")}
          </span>
        </Button>
      }
      headerActions={
        <Button
          variant={analysis.is_published ? "default" : "outline"}
          size="xs"
          onClick={handlePublishToggle}
          disabled={publishing}
          className={cn(
            "gap-1.5 transition-all",
            analysis.is_published
              ? "bg-primary hover:bg-primary/90 text-white"
              : ""
          )}
        >
          {publishing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : analysis.is_published ? (
            <Globe className="w-3.5 h-3.5" />
          ) : (
            <Lock className="w-3.5 h-3.5" />
          )}
          {analysis.is_published
            ? t("tradingAnalysis.publishedLabel")
            : t("tradingAnalysis.publish")}
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analysis.ticker}
                </h1>
                {isRunning && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary dark:bg-primary/20 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {t("tradingAnalysis.statusAnalyzing")}
                  </span>
                )}
                {isFailed && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400">
                    <XCircle className="w-3 h-3" />
                    {t("tradingAnalysis.statusFailed")}
                  </span>
                )}
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary dark:bg-primary/20">
                    <CheckCircle2 className="w-3 h-3" />
                    {t("tradingAnalysis.statusCompleted")}
                  </span>
                )}
                {analysis.is_published && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400">
                    <Globe className="w-3 h-3" />
                    {t("tradingAnalysis.publishedLabel")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500 dark:text-gray-400">
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

            {isCompleted && (
              <div className="flex items-center gap-3">
                <DecisionBadgeLarge decision={analysis.final_decision} t={t} />
              </div>
            )}
          </div>

          {/* Progress */}
          {isRunning && (() => {
            const progressPercent = Math.round(
              (activeStageIdx / (STAGES.length - 1)) * 100
            );
            const activeStage = STAGES[activeStageIdx];

            return (
              <div className="bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg overflow-hidden animate-fade-in-up stagger-1">
                <div className="px-5 py-3 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {t("tradingAnalysis.analysisInProgress")}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                      {t("tradingAnalysis.stage")} {activeStageIdx + 1}/{STAGES.length}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary animate-progress-stripes transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(progressPercent, 5)}%` }}
                    />
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  <TooltipProvider>
                    <div className="flex items-start">
                      {STAGES.map((stage, idx) => {
                        const Icon = stage.icon;
                        const isActive = idx === activeStageIdx;
                        const isDone = idx < activeStageIdx;
                        const stageLabel = t(`tradingAnalysis.stages.${stage.key}`);
                        const stageDesc = t(`tradingAnalysis.stageDesc.${stage.key}`);

                        return (
                          <div key={stage.key} className="flex items-start flex-1 min-w-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex flex-col items-center flex-1 cursor-default min-w-0">
                                  <div className="relative">
                                    {isActive && (
                                      <div className="absolute inset-0 w-10 h-10 rounded-full bg-primary/20 dark:bg-primary/10 animate-pulse-ring" style={{ "--pulse-color": "rgba(0, 200, 5, 0.4)" } as React.CSSProperties} />
                                    )}
                                    <div
                                      className={cn(
                                        "relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500",
                                        isDone &&
                                        "bg-primary/10 dark:bg-primary/20 text-primary",
                                        isActive &&
                                        "bg-primary/15 dark:bg-primary/20 text-primary ring-2 ring-primary/40 ring-offset-2 ring-offset-white dark:ring-offset-card-dark scale-110 shadow-lg shadow-primary/10",
                                        !isDone && !isActive &&
                                        "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                                      )}
                                    >
                                      {isActive ? (
                                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                      ) : isDone ? (
                                        <CheckCircle2 className="w-4.5 h-4.5" />
                                      ) : (
                                        <Icon className="w-4 h-4" />
                                      )}
                                    </div>
                                  </div>
                                  <span
                                    className={cn(
                                      "text-[10px] mt-2 font-semibold transition-colors duration-300 text-center",
                                      isActive && "text-primary",
                                      isDone && "text-primary/70 dark:text-primary/60",
                                      !isDone && !isActive && "text-gray-400 dark:text-gray-500"
                                    )}
                                  >
                                    {stageLabel}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[180px]">
                                <p className="text-xs font-medium">{stageLabel}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{stageDesc}</p>
                              </TooltipContent>
                            </Tooltip>

                            {idx < STAGES.length - 1 && (
                              <div className="flex-shrink-0 w-full max-w-[48px] h-0.5 mt-5 mx-0.5">
                                <div className="h-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-700 ease-out",
                                      idx < activeStageIdx
                                        ? "w-full bg-primary"
                                        : idx === activeStageIdx
                                          ? "w-1/2 bg-primary/60 animate-pulse-subtle"
                                          : "w-0"
                                    )}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </TooltipProvider>

                  {activeStage && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 dark:bg-primary/5 border border-primary/20 dark:border-primary/15 animate-slide-in">
                      {(() => {
                        const ActiveIcon = activeStage.icon;
                        return <ActiveIcon className="w-5 h-5 text-primary shrink-0" />;
                      })()}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-primary">
                          {t(`tradingAnalysis.stages.${activeStage.key}`)}
                        </p>
                        <p className="text-[11px] text-primary/60 truncate">
                          {t(`tradingAnalysis.stageDesc.${activeStage.key}`)}
                        </p>
                      </div>
                      <Loader2 className="w-4 h-4 text-primary/60 animate-spin ml-auto shrink-0" />
                    </div>
                  )}

                  {progressEvents.length > 0 && (
                    <ProgressLog events={progressEvents} />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Error */}
          {isFailed && analysis.error_message && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 animate-fade-in-up">
              <p className="text-sm text-red-700 dark:text-red-400">
                {analysis.error_message}
              </p>
            </div>
          )}

          {/* Reports */}
          {isCompleted && (
            <>
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
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
