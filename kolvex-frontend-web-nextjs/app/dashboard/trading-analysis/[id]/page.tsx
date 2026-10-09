"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
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
import { RESEARCH_AUTHORING_PATH } from "@/lib/researchRoutes";
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
import { FullReportActions } from "@/components/trading-analysis/report-actions";
import CompanyLogo from "@/components/ui/company-logo";
import { createClient } from "@/lib/supabase/client";

const STAGES = [
  { key: "initializing", icon: Bot },
  { key: "analysts", icon: BarChart3 },
  { key: "debate", icon: Swords },
  { key: "trader", icon: DollarSign },
  { key: "risk", icon: ShieldCheck },
  { key: "completed", icon: CheckCircle2 },
] as const;

const STAGE_ORDER: string[] = STAGES.map((s) => s.key);

function getProgressEventKey(event: ProgressEvent, index: number) {
  return [
    event.stage || "",
    event.node || "",
    event.message || "",
    event.detail_type || "",
    event.detail || "",
    event.status || "",
    String(event.elapsed ?? ""),
    String((event as any).created_at ?? index),
  ].join("|");
}

function mergeProgressEvents(
  current: ProgressEvent[],
  incoming: ProgressEvent[],
) {
  if (incoming.length === 0) return current;

  const seen = new Set(
    current.map((event, index) => getProgressEventKey(event, index)),
  );
  const next = [...current];

  incoming.forEach((event, index) => {
    const key = getProgressEventKey(event, index);
    if (!seen.has(key)) {
      seen.add(key);
      next.push(event);
    }
  });

  return next;
}

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
  const [isStreamConnected, setIsStreamConnected] = useState(false);
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const heading = analysis?.ticker
      ? t("tradingAnalysis.pageTitle", { ticker: analysis.ticker })
      : t("tradingAnalysis.title");
    document.title = `${heading} · ${t("sidebar.tradingAnalysis")} — Kolvex`;
  }, [analysis?.ticker, t]);

  const loadAnalysis = useCallback(async () => {
    try {
      const data = await getAnalysis(analysisId);
      setAnalysis(data);
      const storedEvents = Array.isArray(data.progress_events)
        ? data.progress_events
        : [];
      if (storedEvents.length > 0) {
        setProgressEvents((prev) => {
          const next = mergeProgressEvents(prev, storedEvents);
          if (next.length > prev.length) setLastActivityAt(Date.now());
          return next;
        });
      } else if (data.status === "running" && data.progress_stage) {
        setProgressEvents((prev) =>
          mergeProgressEvents(prev, [
            {
              stage: data.progress_stage!,
              message:
                data.progress_message ||
                t(`tradingAnalysis.stageDesc.${data.progress_stage}`),
            },
          ]),
        );
      }
      if (data.status === "completed") {
        setCurrentStage("completed");
        setLastActivityAt(Date.now());
      } else if (data.status === "failed") {
        setCurrentStage("failed");
        setLastActivityAt(Date.now());
      } else if (data.status === "running" && data.progress_stage) {
        setCurrentStage((prev) => {
          const prevIdx = STAGE_ORDER.indexOf(prev);
          const nextIdx = STAGE_ORDER.indexOf(data.progress_stage!);
          return nextIdx > prevIdx ? data.progress_stage! : prev;
        });
      }
      return data;
    } catch (e) {
      console.error("Failed to load analysis:", e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [analysisId, t]);

  const handlePublishToggle = useCallback(async () => {
    if (!analysis || publishing) return;
    setPublishing(true);
    try {
      if (analysis.is_published) {
        await unpublishAnalysis(analysisId);
        setAnalysis((prev) =>
          prev ? { ...prev, is_published: false, published_at: null } : prev,
        );
        toast.success(t("tradingAnalysis.unpublished"));
      } else {
        await publishAnalysis(analysisId);
        setAnalysis((prev) =>
          prev
            ? {
                ...prev,
                is_published: true,
                published_at: new Date().toISOString(),
              }
            : prev,
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
        if (!cancelled && (!data || data.status === "running")) {
          startPolling();
        }
      }, 5_000);
    };

    const connectSSE = async () => {
      if (cancelled) return;
      cleanupRef.current?.();

      let accessToken: string | undefined;
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        accessToken = session?.access_token;
        console.log(
          `[SSE] token obtained: ${!!accessToken}, backend: ${process.env.NEXT_PUBLIC_BACKEND_API_URL?.slice(0, 30)}`,
        );
      } catch (e) {
        console.warn("[SSE] failed to get token, using proxy:", e);
      }

      if (cancelled) return;
      const cleanup = streamAnalysisProgress(
        analysisId,
        (event) => {
          if (cancelled) return;
          setLastActivityAt(Date.now());
          setProgressEvents((prev) => mergeProgressEvents(prev, [event]));
          if (event.stage) {
            setCurrentStage((prev) => {
              const prevIdx = STAGE_ORDER.indexOf(prev);
              const nextIdx = STAGE_ORDER.indexOf(event.stage);
              return nextIdx > prevIdx ? event.stage : prev;
            });
          }
          if (event.stage === "done") {
            if (event.status === "completed") setCurrentStage("completed");
            if (event.status === "failed") setCurrentStage("failed");
          }
        },
        () => {
          if (cancelled) return;
          console.log("SSE error/timeout, falling back to polling");
          setIsStreamConnected(false);
          loadAnalysis();
        },
        () => {
          if (!cancelled) loadAnalysis();
        },
        accessToken,
        (connected) => {
          if (!cancelled) setIsStreamConnected(connected);
        },
      );
      cleanupRef.current = cleanup;
    };

    loadAnalysis().then((data) => {
      if (cancelled) return;
      if (data && data.status === "running") {
        startPolling();
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

  useEffect(() => {
    if (analysis?.status !== "running") return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [analysis?.status]);

  const activeStageIdx = Math.max(
    STAGES.findIndex((s) => s.key === currentStage),
    0,
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
        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[880px]">
            <DetailSkeleton />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analysis) {
    return (
      <DashboardLayout title={t("tradingAnalysis.title")}>
        <div className="relative flex-1 overflow-y-auto">
          <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] gap-4">
            <XCircle className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {t("tradingAnalysis.notFound")}
            </p>
            <Button
              variant="ghost"
              onClick={() => router.push(RESEARCH_AUTHORING_PATH)}
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
  const startedAt = new Date(analysis.created_at).getTime();
  const elapsedSeconds = Number.isFinite(startedAt)
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : 0;
  const activityIdleSeconds = Math.max(
    0,
    Math.floor((now - lastActivityAt) / 1000),
  );
  const isWaitingForModel = isRunning && activityIdleSeconds >= 20;

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
          onClick={() => router.push(RESEARCH_AUTHORING_PATH)}
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">
            {t("tradingAnalysis.backToList")}
          </span>
        </Button>
      }
      headerActions={
        <>
          <Button
            variant={analysis.is_published ? "default" : "outline"}
            size="sm"
            onClick={handlePublishToggle}
            disabled={publishing}
            className="gap-1.5"
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

          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/market/${analysis.ticker}`}>
              {locale === "zh" ? "股票工作台" : "Stock workspace"}
            </Link>
          </Button>
          {isCompleted && <FullReportActions analysis={analysis} t={t} />}
        </>
      }
    >
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[880px] space-y-8 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          {/* Header */}
          <div className="animate-fade-in-up">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <CompanyLogo symbol={analysis.ticker} size="lg" />
                <h1 className="text-[28px] font-bold leading-tight text-foreground md:text-[32px]">
                  {analysis.ticker}
                </h1>
                {isRunning && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium text-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {t("tradingAnalysis.statusAnalyzing")}
                  </span>
                )}
                {isFailed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-negative/10 px-2.5 py-1 text-xs font-medium text-negative">
                    <XCircle className="w-3 h-3" />
                    {t("tradingAnalysis.statusFailed")}
                  </span>
                )}
                {analysis.is_published && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                    <Globe className="w-3 h-3" />
                    {t("tradingAnalysis.publishedLabel")}
                  </span>
                )}
              </div>
              {isCompleted && (
                <div className="mt-5">
                  <DecisionBadgeLarge
                    decision={analysis.final_decision}
                    t={t}
                  />
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
                  <span className="capitalize">{analysis.llm_provider}</span>
                )}
              </div>
            </div>
          </div>

          {/* Progress */}
          {isRunning &&
            (() => {
              const progressPercent = Math.round(
                (activeStageIdx / (STAGES.length - 1)) * 100,
              );
              const activeStage = STAGES[activeStageIdx];

              return (
                <div className="overflow-hidden rounded-2xl bg-muted/60 animate-fade-in-up stagger-1">
                  <div className="border-b border-border px-5 py-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                        <span className="text-sm font-semibold text-foreground">
                          {t("tradingAnalysis.analysisInProgress")}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            isStreamConnected
                              ? "bg-positive/10 text-positive"
                              : "bg-warning/10 text-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full animate-pulse",
                              isStreamConnected
                                ? "bg-positive-fill"
                                : "bg-warning",
                            )}
                          />
                          {t(
                            isStreamConnected
                              ? "tradingAnalysis.liveUpdates"
                              : "tradingAnalysis.syncingStatus",
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground tabular-nums">
                        <span>
                          {t("tradingAnalysis.elapsed", {
                            seconds: String(elapsedSeconds),
                          })}
                        </span>
                        <span>
                          {t("tradingAnalysis.stage")} {activeStageIdx + 1}/
                          {STAGES.length}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
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
                          const stageLabel = t(
                            `tradingAnalysis.stages.${stage.key}`,
                          );
                          const stageDesc = t(
                            `tradingAnalysis.stageDesc.${stage.key}`,
                          );

                          return (
                            <div
                              key={stage.key}
                              className="flex items-start flex-1 min-w-0"
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex flex-col items-center flex-1 cursor-default min-w-0">
                                    <div className="relative">
                                      <div
                                        className={cn(
                                          "relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200",
                                          isDone &&
                                            "bg-primary text-primary-foreground",
                                          isActive &&
                                            "bg-foreground text-background",
                                          !isDone &&
                                            !isActive &&
                                            "bg-background text-muted-foreground",
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
                                        isActive && "text-foreground",
                                        isDone && "text-foreground",
                                        !isDone &&
                                          !isActive &&
                                          "text-muted-foreground",
                                      )}
                                    >
                                      {stageLabel}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="bottom"
                                  className="max-w-[180px]"
                                >
                                  <p className="text-xs font-medium">
                                    {stageLabel}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {stageDesc}
                                  </p>
                                </TooltipContent>
                              </Tooltip>

                              {idx < STAGES.length - 1 && (
                                <div className="flex-shrink-0 w-full max-w-[48px] h-0.5 mt-5 mx-0.5">
                                  <div className="h-full overflow-hidden rounded-full bg-foreground/10">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all duration-700 ease-out",
                                        idx < activeStageIdx
                                          ? "w-full bg-primary"
                                          : idx === activeStageIdx
                                            ? "w-1/2 bg-primary/60"
                                            : "w-0",
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
                      <div className="flex items-center gap-3 rounded-xl bg-background p-3 animate-slide-in">
                        {(() => {
                          const ActiveIcon = activeStage.icon;
                          return (
                            <ActiveIcon className="h-5 w-5 shrink-0 text-foreground" />
                          );
                        })()}
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-foreground">
                            {t(`tradingAnalysis.stages.${activeStage.key}`)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {isWaitingForModel
                              ? t("tradingAnalysis.waitingForModel")
                              : t(
                                  `tradingAnalysis.stageDesc.${activeStage.key}`,
                                )}
                          </p>
                        </div>
                        <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      </div>
                    )}

                    {progressEvents.length > 0 && (
                      <ProgressLog
                        events={progressEvents}
                        isLive={isStreamConnected}
                      />
                    )}
                  </div>
                </div>
              );
            })()}

          {/* Error */}
          {isFailed && analysis.error_message && (
            <div
              role="alert"
              className="rounded-2xl bg-negative/10 p-4 animate-fade-in-up"
            >
              <p className="text-sm text-foreground">
                {analysis.error_message}
              </p>
            </div>
          )}

          {/* Reports */}
          {isCompleted && (
            <>
              <div className="animate-fade-in-up stagger-3">
                <ReportCard
                  title={t("tradingAnalysis.sections.investmentPlan")}
                  icon={DollarSign}
                  content={analysis.investment_plan}
                  locale={locale}
                  t={t}
                />
              </div>

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
                ) : null,
              )}

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
                <ReportCard
                  title={t("tradingAnalysis.sections.finalSignal")}
                  icon={CheckCircle2}
                  content={analysis.full_signal}
                  locale={locale}
                  t={t}
                />
              </div>
              <details className="space-y-4 border-t border-border pt-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {locale === "zh"
                    ? "查看 AI 如何得出结论"
                    : "See how AI reached this conclusion"}
                </summary>
                <div className="animate-fade-in-up stagger-2">
                  <DebateCard
                    title={t("tradingAnalysis.sections.investmentDebate")}
                    icon={Swords}
                    debate={
                      analysis.investment_debate as Record<
                        string,
                        string
                      > | null
                    }
                    bullLabel={t("tradingAnalysis.debate.bullResearcher")}
                    bearLabel={t("tradingAnalysis.debate.bearResearcher")}
                    judgeLabel={t("tradingAnalysis.debate.judgeDecision")}
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
              </details>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
