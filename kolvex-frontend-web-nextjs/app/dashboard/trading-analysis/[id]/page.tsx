"use client";

import HeaderBackButton from "@/components/layout/HeaderBackButton";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Loader2,
  Clock,
  Calendar,
  BarChart3,
  DollarSign,
  Swords,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Globe,
  Lock,
  Bot,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { RESEARCH_AUTHORING_PATH } from "@/lib/researchRoutes";
import { Button } from "@/components/ui/button";
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
import { ResearchReportContent } from "@/components/trading-analysis/ResearchReportContent";
import { DetailSkeleton } from "@/components/trading-analysis/skeletons";
import { AnalysisProgress } from "@/components/trading-analysis/analysis-progress";
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
  const { t, locale } = useTranslation();
  const analysisId = params.id as string;

  const [analysis, setAnalysis] = useState<TradingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([]);
  const [currentStage, setCurrentStage] = useState("initializing");
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

  const backAction = <HeaderBackButton href={RESEARCH_AUTHORING_PATH} label={t("tradingAnalysis.backToList")} />;

  if (loading) {
    return (
      <DashboardLayout title={t("tradingAnalysis.title")} headerLeftAction={backAction}>
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
      <DashboardLayout title={t("tradingAnalysis.title")} headerLeftAction={backAction}>
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

  return (
    <DashboardLayout
      title={t("tradingAnalysis.pageTitle", { ticker: analysis.ticker })}
      headerLeftAction={backAction}
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
        <div className="mx-auto w-full max-w-[1120px] space-y-8 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          {/* Header */}
          <div className="animate-fade-in-up">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <CompanyLogo symbol={analysis.ticker} size="lg" />
                <h1 className="text-[28px] font-bold leading-tight text-foreground md:text-[32px]">
                  {analysis.ticker}
                </h1>
                {isRunning && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-positive-fill" />
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
          {isRunning && (
            <AnalysisProgress
              stages={STAGES}
              activeStageIdx={activeStageIdx}
              elapsedSeconds={elapsedSeconds}
              isStreamConnected={isStreamConnected}
              isWaitingForModel={isWaitingForModel}
              events={progressEvents}
              t={t}
            />
          )}

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

          {/* Completed reports use the same reading order as the published library. */}
          {isCompleted && <ResearchReportContent key={analysis.id} analysis={analysis} locale={locale} t={t} />}
        </div>
      </div>
    </DashboardLayout>
  );
}
