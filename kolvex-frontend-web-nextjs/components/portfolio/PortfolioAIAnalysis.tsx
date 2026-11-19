"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Target,
  ChevronDown,
  Lightbulb,
  BarChart3,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Info,
  Gauge,
  PieChart,
  History,
} from "lucide-react";
import { AiModelSelect, aiModelName, useAiModelChoice } from "@/components/ai/AiModelSelect";
import { InfoTip } from "@/components/ui/info-tip";
import { Button } from "@/components/ui/button";
import CompanyLogo, { phoneListLogoClass } from "@/components/ui/company-logo";
import { marketStockHref } from "@/lib/stockLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { DirectionBadge } from "@/components/decision/shared";
import type { Direction } from "@/lib/decision";
import {
  analyzePortfolio,
  getPortfolioAnalysis,
  listPortfolioAnalyses,
  type PortfolioAnalysisRunItem,
  type PortfolioAnalysisResponse,
  type StockAnalysis,
  type OverallAnalysis,
} from "@/lib/portfolioApi";

// ============================================================
// Types
// ============================================================

type TFunction = (key: string, params?: Record<string, string>) => string;

interface PortfolioAIAnalysisProps {
  className?: string;
}

// ============================================================
// Sentiment & Recommendation Config
// ============================================================

/** The analysis returns free-form strings; anything unrecognised reads as neutral, as before. */
function asDirection(sentiment: string): Direction {
  return sentiment === "bullish" || sentiment === "bearish" ? sentiment : "neutral";
}

const RECOMMENDATION_CONFIG = {
  strong_buy: { icon: CheckCircle2, className: "bg-primary text-primary-foreground" },
  buy: { icon: TrendingUp, className: "bg-positive/10 text-positive" },
  buy_more: { icon: TrendingUp, className: "bg-positive/10 text-positive" },
  hold: { icon: MinusCircle, className: "bg-warning/10 text-warning" },
  reduce: { icon: TrendingDown, className: "bg-warning/10 text-warning" },
  sell: { icon: XCircle, className: "bg-negative/10 text-negative" },
} as const;

const RISK_CONFIG = {
  low: { color: "bg-positive-fill", width: "33%", textColor: "text-positive" },
  medium: { color: "bg-warning", width: "66%", textColor: "text-warning" },
  high: { color: "bg-negative-fill", width: "100%", textColor: "text-negative" },
} as const;

// ============================================================
// Sub-Components
// ============================================================

function RecommendationBadge({ recommendation, t }: { recommendation: string; t: TFunction }) {
  const key = (
    recommendation in RECOMMENDATION_CONFIG ? recommendation : "hold"
  ) as keyof typeof RECOMMENDATION_CONFIG;
  const config = RECOMMENDATION_CONFIG[key];
  const Icon = config.icon;

  return (
    <Badge size="sm" className={cn("gap-1 font-semibold border-0", config.className)}>
      <Icon className="w-3 h-3" />
      {t(`portfolio.ai.recommendation.${key}`)}
    </Badge>
  );
}

function RiskMeter({ level, t }: { level: string; t: TFunction }) {
  const config = RISK_CONFIG[level as keyof typeof RISK_CONFIG] || RISK_CONFIG.medium;
  const labelKey =
    level === "low"
      ? "portfolio.ai.lowRisk"
      : level === "high"
        ? "portfolio.ai.highRisk"
        : "portfolio.ai.mediumRisk";
  const label = t(labelKey);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Gauge className="w-4 h-4" />
          <span>{t("portfolio.ai.riskLevel")}</span>
        </div>
        <span className={cn("text-sm font-semibold", config.textColor)}>{label}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", config.color)}
          style={{ width: config.width }}
        />
      </div>
    </div>
  );
}

function DiversificationGauge({ score, t }: { score: number; t: TFunction }) {
  const getColor = (s: number) => {
    if (s >= 70) return { ring: "text-positive", text: "text-positive" };
    if (s >= 40) return { ring: "text-warning", text: "text-warning" };
    return { ring: "text-negative", text: "text-negative" };
  };
  const colors = getColor(score);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const statusLabel =
    score >= 70
      ? t("portfolio.ai.wellDiversified")
      : score >= 40
        ? t("portfolio.ai.moderate")
        : t("portfolio.ai.concentrated");

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-200"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn("transition-all duration-700 ease-out", colors.ring)}
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-lg font-bold",
            colors.text,
          )}
        >
          {score}
        </span>
      </div>
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PieChart className="w-4 h-4" />
          <span>{t("portfolio.ai.diversification")}</span>
        </div>
        <p className={cn("text-sm font-semibold", colors.text)}>{statusLabel}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-2xl border border-foreground/10 glass-card bg-card-glass">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

// ============================================================
// Stock Analysis Accordion Item
// ============================================================

function StockAnalysisItem({ stock, t }: { stock: StockAnalysis; t: TFunction }) {
  return (
    <AccordionItem
      value={stock.symbol}
      className="glass-card bg-card-glass border border-foreground/10 rounded-2xl mb-2 overflow-hidden"
    >
      <AccordionTrigger className="px-4 py-3 transition-colors hover:bg-foreground/[0.06] hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <span aria-hidden="true">
            <CompanyLogo
              symbol={stock.symbol}
              name={stock.name}
              size="md"
              className={phoneListLogoClass}
            />
          </span>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{stock.symbol}</span>
              <DirectionBadge direction={asDirection(stock.sentiment)} className="text-xs" />
            </div>
            {stock.name && <p className="text-xs text-muted-foreground truncate">{stock.name}</p>}
          </div>
          <RecommendationBadge recommendation={stock.recommendation} t={t} />
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4 pt-2">
          {/* Quotes page entry point: the accordion trigger above is a
                        button, so the stock identity cannot itself be a link. */}
          <Link
            href={marketStockHref(stock.symbol)}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none "
          >
            <CompanyLogo symbol={stock.symbol} name={stock.name} size="sm" />
            <span>{t("redditOpinions.openStock", { ticker: stock.symbol })}</span>
          </Link>

          {/* Analysis Text */}
          {stock.analysis && (
            <p className="text-sm text-muted-foreground leading-relaxed">{stock.analysis}</p>
          )}

          {/* Key Points */}
          {stock.key_points && stock.key_points.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {t("portfolio.ai.keyPoints")}
              </p>
              <ul className="space-y-1.5">
                {stock.key_points.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metrics */}
          <div className="flex items-center gap-4 pt-2 border-t border-border">
            {stock.current_weight !== undefined && stock.current_weight !== null && (
              <div className="text-xs">
                <span className="text-muted-foreground">{t("portfolio.ai.weight")} </span>
                <span className="font-semibold">{stock.current_weight.toFixed(1)}%</span>
              </div>
            )}
            <div className="text-xs">
              <span className="text-muted-foreground">{t("portfolio.ai.confidence")} </span>
              <span className="font-semibold">{(stock.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ============================================================
// Overall Analysis Section
// ============================================================

function OverallAnalysisSection({ analysis, t }: { analysis: OverallAnalysis; t: TFunction }) {
  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <div className="p-4 rounded-2xl  from-primary/5 via-primary/3 to-transparent border border-primary/10">
        <p className="text-sm leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Metrics Grid - Bento Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard icon={Gauge} label={t("portfolio.ai.riskAssessment")}>
          <RiskMeter level={analysis.risk_level} t={t} />
        </MetricCard>
        <MetricCard icon={PieChart} label={t("portfolio.ai.portfolioHealth")}>
          <DiversificationGauge score={analysis.diversification_score} t={t} />
        </MetricCard>
      </div>

      {/* Portfolio Style */}
      {analysis.portfolio_style && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-muted border border-border">
          <span className="text-sm text-muted-foreground">{t("portfolio.ai.portfolioStyle")}</span>
          <span className="text-sm font-semibold capitalize">{analysis.portfolio_style}</span>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {analysis.strengths && analysis.strengths.length > 0 && (
          <div className="p-4 rounded-2xl border border-positive/30 bg-positive/10">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-positive" />
              <span className="text-sm font-semibold text-positive">
                {t("portfolio.ai.strengths")}
              </span>
            </div>
            <ul className="space-y-1.5">
              {analysis.strengths.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-positive">
                  <span className="w-1 h-1 rounded-full bg-positive-fill mt-2 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.weaknesses && analysis.weaknesses.length > 0 && (
          <div className="p-4 rounded-2xl border border-warning/30 bg-warning/10">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="text-sm font-semibold text-warning">
                {t("portfolio.ai.areasToImprove")}
              </span>
            </div>
            <ul className="space-y-1.5">
              {analysis.weaknesses.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-warning">
                  <span className="w-1 h-1 rounded-full bg-warning mt-2 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Suggestions Section
// ============================================================

const SUGGESTION_SECTIONS = [
  {
    key: "rebalancing",
    titleKey: "portfolio.ai.rebalancing",
    icon: Target,
    color: "text-gery-500",
    bg: "bg-muted",
  },
  {
    key: "risk_management",
    titleKey: "portfolio.ai.riskManagement",
    icon: Shield,
    color: "text-foreground",
    bg: "bg-muted",
  },
  {
    key: "opportunities",
    titleKey: "portfolio.ai.opportunities",
    icon: Lightbulb,
    color: "text-warning",
    bg: "bg-warning/10",
  },
  {
    key: "tax_considerations",
    titleKey: "portfolio.ai.taxTips",
    icon: Info,
    color: "text-foreground",
    bg: "bg-muted",
  },
] as const;

function SuggestionsSection({
  suggestions,
  t,
}: {
  suggestions: PortfolioAnalysisResponse["portfolio_suggestions"];
  t: TFunction;
}) {
  if (!suggestions) return null;

  const activeSections = SUGGESTION_SECTIONS.filter((s) => {
    const items = suggestions[s.key as keyof typeof suggestions];
    return items && items.length > 0;
  });

  if (activeSections.length === 0) return null;

  return (
    <div className="space-y-2">
      {activeSections.map((section) => {
        const Icon = section.icon;
        const items = suggestions[section.key as keyof typeof suggestions] ?? [];

        return (
          <div
            key={section.key}
            className="p-4 rounded-2xl border border-foreground/10 glass-card bg-card-glass"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-1.5 rounded-md", section.bg)}>
                <Icon className={cn("w-4 h-4", section.color)} />
              </div>
              <span className="font-semibold text-sm">{t(section.titleKey)}</span>
            </div>
            <ul className="space-y-1.5 pl-2">
              {items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="w-1 h-1 rounded-full bg-current mt-2 shrink-0 opacity-50" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Loading State
// ============================================================

/** Mirrors the result: overview summary, two metric cards, sentiment strip, strengths/risks, then per-stock rows. */
function AnalysisLoadingState({ t }: { t: TFunction }) {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("portfolio.ai.analyzing")}</span>
      <div aria-hidden="true">
        <Skeleton className="mb-3 h-4 w-32 rounded-md" />
        <div className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-primary/10 p-4">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="glass-card rounded-2xl border border-foreground/10 bg-card-glass p-4"
              >
                <Skeleton className="mb-3 h-4 w-24 rounded-md" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="mt-2 h-3 w-16 rounded-md" />
              </div>
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={
                  i
                    ? "rounded-2xl border border-warning/30 bg-warning/10 p-4"
                    : "rounded-2xl border border-positive/30 bg-positive/10 p-4"
                }
              >
                <Skeleton className="mb-3 h-4 w-20 rounded-md" />
                <div className="space-y-2">
                  {[0, 1, 2].map((j) => (
                    <Skeleton key={j} className="h-3.5 w-full rounded-md" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden="true">
        <Skeleton className="mb-3 h-4 w-28 rounded-md" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="glass-card flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-card-glass px-4 py-3"
            >
              <span className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-md" />
              </span>
              <span className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Empty State
// ============================================================

function EmptyAnalysisState({
  onAnalyze,
  canRun,
  noApiKey,
  t,
}: {
  onAnalyze: () => void;
  canRun: boolean;
  noApiKey: boolean;
  t: TFunction;
}) {
  if (noApiKey) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-muted-foreground mb-4">{t("portfolio.ai.noApiKey")}</p>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/settings?tab=api-keys">{t("portfolio.ai.openSettings")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="text-center py-10">
      <p className="text-sm text-muted-foreground mb-4">{t("portfolio.ai.emptyHint")}</p>
      <Button onClick={onAnalyze} disabled={!canRun} size="sm" className="gap-2">
        <Zap className="w-4 h-4" />
        {t("portfolio.ai.startAnalysis")}
      </Button>
    </div>
  );
}

// ============================================================
// Error State
// ============================================================

const ERROR_CODES = new Set([
  "ai_not_configured",
  "ai_key_rejected",
  "ai_rate_limited",
  "ai_analysis_invalid",
  "ai_analysis_timeout",
  "no_positions",
  "Unauthorized",
]);

function errorMessage(code: string, t: TFunction) {
  return t(`portfolio.ai.errors.${ERROR_CODES.has(code) ? code : "ai_unavailable"}`);
}

function ErrorState({ error, onRetry, t }: { error: string; onRetry: () => void; t: TFunction }) {
  return (
    <div className="text-center py-10" role="alert">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-negative/10 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-negative" />
      </div>
      <h3 className="font-semibold mb-1">{t("portfolio.ai.analysisFailed")}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">{error}</p>
      <Button variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="w-4 h-4" />
        {t("portfolio.ai.tryAgain")}
      </Button>
    </div>
  );
}

// ============================================================
// History
// ============================================================

function formatRunTime(iso: string, t: TFunction) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(t("common.intlLocale"), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AnalysisHistory({
  runs,
  failed,
  selectedId,
  openingId,
  disabled,
  onOpen,
  t,
}: {
  runs: PortfolioAnalysisRunItem[];
  failed: boolean;
  selectedId: string | null;
  openingId: string | null;
  disabled: boolean;
  onOpen: (id: string) => void;
  t: TFunction;
}) {
  return (
    <section aria-labelledby="portfolio-ai-history" className="min-w-0">
      <h3 id="portfolio-ai-history" className="text-sm font-semibold mb-3 flex items-center gap-2">
        <History className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        {t("portfolio.ai.history")}
      </h3>
      {failed ? (
        <p className="text-sm text-muted-foreground">{t("portfolio.ai.historyUnavailable")}</p>
      ) : (
        <ul className="space-y-1.5">
          {runs.map((run) => {
            const active = run.id === selectedId;
            return (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => onOpen(run.id)}
                  disabled={disabled || active}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-accent" : "hover:bg-foreground/[0.04] disabled:opacity-60",
                  )}
                >
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">{formatRunTime(run.created_at, t)}</span>
                    <span className="truncate">{aiModelName(run.model_id)}</span>
                  </span>
                  <span className="mt-1 block text-sm leading-5 line-clamp-2 break-words">
                    {openingId === run.id ? t("portfolio.ai.opening") : run.summary}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ============================================================
// Main Component
// ============================================================

export function PortfolioAIAnalysis({ className }: PortfolioAIAnalysisProps) {
  const { t, locale } = useTranslation();
  const modelChoice = useAiModelChoice();
  const [analysis, setAnalysis] = useState<PortfolioAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllStocks, setShowAllStocks] = useState(false);
  const [runs, setRuns] = useState<PortfolioAnalysisRunItem[]>([]);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openError, setOpenError] = useState(false);
  const openRequest = useRef(0);

  const openRun = useCallback(async (id: string) => {
    const request = ++openRequest.current;
    setOpeningId(id);
    setOpenError(false);
    try {
      const run = await getPortfolioAnalysis(id);
      if (request !== openRequest.current) return;
      setAnalysis(run);
      setShowAllStocks(false);
      setError(null);
    } catch {
      if (request === openRequest.current) setOpenError(true);
    } finally {
      if (request === openRequest.current) setOpeningId(null);
    }
  }, []);

  // Load history once; reopen the latest saved analysis so returning users see it.
  useEffect(() => {
    let cancelled = false;
    listPortfolioAnalyses()
      .then((items) => {
        if (cancelled) return;
        setRuns(items);
        if (items[0]) void openRun(items[0].id);
      })
      .catch(() => {
        if (!cancelled) setHistoryFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [openRun]);

  const model = modelChoice.model;
  const noApiKey = !modelChoice.loading && modelChoice.eligibleModels.length === 0;

  const handleAnalyze = useCallback(async () => {
    if (!model) return;
    openRequest.current += 1; // a newer run wins over a history item still opening
    setOpeningId(null);
    setOpenError(false);
    setLoading(true);
    setError(null);

    try {
      const result = await analyzePortfolio({ model, locale });
      setAnalysis(result);
      setShowAllStocks(false);
      if (result.saved && result.id && result.created_at) {
        const item: PortfolioAnalysisRunItem = {
          id: result.id,
          created_at: result.created_at,
          model_id: result.model,
          locale: result.locale,
          summary: result.overall_analysis.summary,
          risk_level: result.overall_analysis.risk_level,
          positions_analyzed: result.positions_analyzed,
        };
        setRuns((prev) => [item, ...prev.filter((run) => run.id !== item.id)]);
      }
    } catch (err) {
      setError(errorMessage(err instanceof Error ? err.message : "", t));
    } finally {
      setLoading(false);
    }
  }, [model, locale, t]);

  const displayedStocks = showAllStocks
    ? analysis?.stock_analyses || []
    : (analysis?.stock_analyses || []).slice(0, 5);

  const hasMoreStocks = (analysis?.stock_analyses?.length || 0) > 5;
  const hiddenCount = (analysis?.stock_analyses?.length || 0) - 5;
  const showHistory = runs.length > 0 || historyFailed;
  const busy = loading || openingId !== null;
  const firstLoad = !analysis && !error && (loading || openingId !== null);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <CardTitle className="text-lg flex items-center gap-1.5">
          {t("portfolio.ai.title")}
          <InfoTip label={t("portfolio.ai.aboutLabel")}>{t("portfolio.ai.about")}</InfoTip>
        </CardTitle>
        {!noApiKey && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <AiModelSelect
              choice={modelChoice}
              disabled={loading}
              className="flex-1 sm:flex-none"
            />
            {(analysis || error) && (
              <Button
                size="sm"
                className="h-9 gap-2"
                onClick={handleAnalyze}
                disabled={!model || loading}
              >
                <Zap className="w-4 h-4" />
                {loading ? t("portfolio.ai.analyzing") : t("portfolio.ai.regenerate")}
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className={cn(showHistory && "lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-8")}>
          <div className="min-w-0">
            {openError && (
              <p role="alert" className="mb-4 text-sm text-negative">
                {t("portfolio.ai.openFailed")}
              </p>
            )}
            {analysis && analysis.saved === false && !loading && (
              <p role="status" className="mb-4 text-sm text-muted-foreground">
                {t("portfolio.ai.notSaved")}
              </p>
            )}

            {/* Initial Empty State */}
            {!analysis && !error && !busy && (
              <EmptyAnalysisState
                onAnalyze={handleAnalyze}
                canRun={Boolean(model)}
                noApiKey={noApiKey}
                t={t}
              />
            )}

            {/* Loading State */}
            {(loading || firstLoad) && <AnalysisLoadingState t={t} />}

            {/* Error State */}
            {error && !loading && <ErrorState error={error} onRetry={handleAnalyze} t={t} />}

            {/* Analysis Results */}
            {analysis && !loading && !error && (
              <div className={cn("space-y-6 transition-opacity", openingId && "opacity-50")}>
                {/* Overall Analysis */}
                <section>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    {t("portfolio.ai.portfolioOverview")}
                  </h3>
                  <OverallAnalysisSection analysis={analysis.overall_analysis} t={t} />
                </section>

                {/* Stock Analysis */}
                {analysis.stock_analyses && analysis.stock_analyses.length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      {t("portfolio.ai.stockAnalysis")}
                      <Badge variant="default" className="ml-1">
                        {analysis.stock_analyses.length}
                      </Badge>
                    </h3>
                    <Accordion
                      type="multiple"
                      defaultValue={analysis.stock_analyses.slice(0, 2).map((s) => s.symbol)}
                    >
                      {displayedStocks.map((stock) => (
                        <StockAnalysisItem key={stock.symbol} stock={stock} t={t} />
                      ))}
                    </Accordion>
                    {hasMoreStocks && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 w-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                        onClick={() => setShowAllStocks(!showAllStocks)}
                      >
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 mr-1 transition-transform",
                            showAllStocks && "rotate-180",
                          )}
                        />
                        {showAllStocks
                          ? t("portfolio.ai.showLess")
                          : t("portfolio.ai.showMore", { count: String(hiddenCount) })}
                      </Button>
                    )}
                  </section>
                )}

                {/* Suggestions */}
                <section>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    {t("portfolio.ai.recommendations")}
                  </h3>
                  <SuggestionsSection suggestions={analysis.portfolio_suggestions} t={t} />
                </section>

                {/* Footer */}
                <footer className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {t("portfolio.ai.positionsAnalyzed", {
                        count: String(analysis.positions_analyzed),
                      })}{" "}
                      • {t("portfolio.aiAnalysis.model")} {aiModelName(analysis.model)}
                    </span>
                    <span>{formatRunTime(analysis.created_at || analysis.analyzed_at, t)}</span>
                  </div>
                </footer>
              </div>
            )}
          </div>

          {showHistory && (
            <div className="mt-8 border-t border-border pt-6 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
              <AnalysisHistory
                runs={runs}
                failed={historyFailed}
                selectedId={analysis?.id ?? null}
                openingId={openingId}
                disabled={loading}
                onOpen={openRun}
                t={t}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default PortfolioAIAnalysis;
