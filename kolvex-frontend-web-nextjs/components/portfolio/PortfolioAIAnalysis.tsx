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
  History,
  ArrowUpRight,
} from "lucide-react";
import { AiModelSelect, aiModelName, useAiModelChoice } from "@/components/ai/AiModelSelect";
import { InfoTip } from "@/components/ui/info-tip";
import { Button } from "@/components/ui/button";
import CompanyLogo, { phoneListLogoClass } from "@/components/ui/company-logo";
import { marketStockHref } from "@/lib/stockLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// Recommendation chips are neutral pills; only the icon and word carry the
// semantic tone, so the action reads without colour and green stays reserved
// for brand actions.
const RECOMMENDATION_CONFIG = {
  strong_buy: { icon: CheckCircle2, tone: "text-positive" },
  buy: { icon: TrendingUp, tone: "text-positive" },
  buy_more: { icon: TrendingUp, tone: "text-positive" },
  hold: { icon: MinusCircle, tone: "text-foreground" },
  reduce: { icon: TrendingDown, tone: "text-warning" },
  sell: { icon: XCircle, tone: "text-negative" },
} as const;

const RISK_CONFIG = {
  low: { steps: 1, tone: "text-positive", labelKey: "portfolio.ai.lowRisk" },
  medium: { steps: 2, tone: "text-warning", labelKey: "portfolio.ai.mediumRisk" },
  high: { steps: 3, tone: "text-negative", labelKey: "portfolio.ai.highRisk" },
} as const;

/** Labels in the locale files end with a colon for inline use; stat labels drop it. */
function bareLabel(t: TFunction, key: string) {
  return t(key).replace(/[:：]\s*$/, "");
}

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
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs font-medium",
        config.tone,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {t(`portfolio.ai.recommendation.${key}`)}
    </span>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

function RiskStat({ level, t }: { level: string; t: TFunction }) {
  const config = RISK_CONFIG[level as keyof typeof RISK_CONFIG] || RISK_CONFIG.medium;
  return (
    <>
      <p className={cn("text-[0.9375rem] font-semibold", config.tone)}>{t(config.labelKey)}</p>
      <div className={cn("mt-2 flex gap-1", config.tone)} aria-hidden="true">
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 flex-1 rounded-full",
              step <= config.steps ? "bg-current" : "bg-muted",
            )}
          />
        ))}
      </div>
    </>
  );
}

function DiversificationStat({ score, t }: { score: number; t: TFunction }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const tone = clamped >= 70 ? "text-positive" : clamped >= 40 ? "text-warning" : "text-negative";
  const status =
    clamped >= 70
      ? t("portfolio.ai.wellDiversified")
      : clamped >= 40
        ? t("portfolio.ai.moderate")
        : t("portfolio.ai.concentrated");
  return (
    <>
      <p className="flex items-baseline gap-2">
        <span className="text-[0.9375rem] font-semibold tabular-nums">
          {clamped}
          <span className="text-xs font-normal text-muted-foreground">/100</span>
        </span>
        <span className={cn("text-xs font-medium", tone)}>{status}</span>
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn("h-full rounded-full bg-current", tone)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </>
  );
}

function PointList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2.5 text-sm leading-6">
          <span
            className="mt-[0.6875rem] h-1 w-1 shrink-0 rounded-full bg-muted-foreground"
            aria-hidden="true"
          />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ============================================================
// Stock Analysis Accordion Item
// ============================================================

function StockAnalysisItem({ stock, t }: { stock: StockAnalysis; t: TFunction }) {
  const hasWeight = stock.current_weight !== undefined && stock.current_weight !== null;
  return (
    <AccordionItem value={stock.symbol} className="border-b border-border last:border-0">
      <AccordionTrigger className="list-control min-h-16 gap-3 rounded-2xl px-2 py-3 text-left hover:bg-foreground/[0.06] hover:no-underline focus-visible:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-primary max-md:px-0 [&>svg]:text-muted-foreground">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span aria-hidden="true" className="shrink-0">
            <CompanyLogo
              symbol={stock.symbol}
              name={stock.name}
              size="md"
              className={phoneListLogoClass}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="text-[0.9375rem] font-semibold">{stock.symbol}</span>
              <DirectionBadge direction={asDirection(stock.sentiment)} className="text-xs" />
            </span>
            {stock.name && (
              <span className="mt-0.5 block truncate text-[0.8125rem] font-normal text-muted-foreground">
                {stock.name}
              </span>
            )}
          </span>
          {hasWeight && (
            <span className="hidden shrink-0 text-right text-sm font-normal tabular-nums sm:block">
              <span className="sr-only">{bareLabel(t, "portfolio.ai.weight")} </span>
              {stock.current_weight!.toFixed(1)}%
            </span>
          )}
          <RecommendationBadge recommendation={stock.recommendation} t={t} />
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-2 pb-5 max-md:px-0 md:pl-[3.75rem]">
        <div className="space-y-4">
          {stock.analysis && <p className="text-sm leading-6">{stock.analysis}</p>}

          {stock.key_points && stock.key_points.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">{t("portfolio.ai.keyPoints")}</p>
              <PointList items={stock.key_points} />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex flex-wrap gap-x-4 tabular-nums">
              {hasWeight && (
                <span>
                  {bareLabel(t, "portfolio.ai.weight")}{" "}
                  <span className="font-medium text-foreground">
                    {stock.current_weight!.toFixed(1)}%
                  </span>
                </span>
              )}
              <span>
                {bareLabel(t, "portfolio.ai.confidence")}{" "}
                <span className="font-medium text-foreground">
                  {(stock.confidence * 100).toFixed(0)}%
                </span>
              </span>
            </span>
            {/* The accordion trigger is a button, so the quote page gets its own link. */}
            <Link
              href={marketStockHref(stock.symbol)}
              className="inline-flex min-h-11 items-center gap-1 rounded-full font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t("redditOpinions.openStock", { ticker: stock.symbol })}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
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
  const strengths = analysis.strengths ?? [];
  const weaknesses = analysis.weaknesses ?? [];
  return (
    <div className="space-y-5">
      <p className="text-[0.9375rem] leading-7">{analysis.summary}</p>

      <dl
        className={cn(
          "grid grid-cols-1 divide-y divide-border rounded-2xl border border-border sm:divide-y-0 sm:divide-x",
          analysis.portfolio_style ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        <Stat label={t("portfolio.ai.riskLevel")}>
          <RiskStat level={analysis.risk_level} t={t} />
        </Stat>
        <Stat label={t("portfolio.ai.diversification")}>
          <DiversificationStat score={analysis.diversification_score} t={t} />
        </Stat>
        {analysis.portfolio_style && (
          <Stat label={bareLabel(t, "portfolio.ai.portfolioStyle")}>
            <p className="text-sm font-medium leading-6 first-letter:uppercase">
              {analysis.portfolio_style}
            </p>
          </Stat>
        )}
      </dl>

      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          {strengths.length > 0 && (
            <div>
              <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-positive" aria-hidden="true" />
                {t("portfolio.ai.strengths")}
              </h4>
              <PointList items={strengths} />
            </div>
          )}
          {weaknesses.length > 0 && (
            <div>
              <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                {t("portfolio.ai.areasToImprove")}
              </h4>
              <PointList items={weaknesses} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Suggestions Section
// ============================================================

const SUGGESTION_SECTIONS = [
  { key: "rebalancing", titleKey: "portfolio.ai.rebalancing", icon: Target },
  { key: "risk_management", titleKey: "portfolio.ai.riskManagement", icon: Shield },
  { key: "opportunities", titleKey: "portfolio.ai.opportunities", icon: Lightbulb },
  { key: "tax_considerations", titleKey: "portfolio.ai.taxTips", icon: Info },
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
    <section>
      <h3 className="mb-3 text-sm font-semibold">{t("portfolio.ai.recommendations")}</h3>
      <div className="divide-y divide-border">
        {activeSections.map((section) => {
          const Icon = section.icon;
          const items = suggestions[section.key as keyof typeof suggestions] ?? [];

          return (
            <div key={section.key} className="py-4 first:pt-0 last:pb-0">
              <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {t(section.titleKey)}
              </h4>
              <PointList items={items} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// Loading State
// ============================================================

/** Mirrors the result: summary, stat strip, strengths/risks, then flat per-stock rows. */
function AnalysisLoadingState({ t }: { t: TFunction }) {
  return (
    <div role="status" className="space-y-8">
      <span className="sr-only">{t("portfolio.ai.analyzing")}</span>
      <div aria-hidden="true" className="space-y-5">
        <Skeleton className="h-4 w-24 rounded-md" />
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
        <div className="grid grid-cols-1 divide-y divide-border rounded-2xl border border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2.5 px-4 py-3.5">
              <Skeleton className="h-3 w-14 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-1 w-full rounded-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className="h-4 w-16 rounded-md" />
              {[0, 1, 2].map((j) => (
                <Skeleton key={j} className="h-3.5 w-full rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true">
        <Skeleton className="mb-3 h-4 w-20 rounded-md" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-2 py-3 last:border-0 max-md:px-0"
          >
            <span className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full max-md:h-8 max-md:w-8" />
              <span className="space-y-1.5">
                <Skeleton className="h-4 w-14 rounded-md" />
                <Skeleton className="h-3 w-28 rounded-md" />
              </span>
            </span>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
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
              <div className={cn("space-y-10 transition-opacity", openingId && "opacity-50")}>
                {/* Overall Analysis */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold">
                    {t("portfolio.ai.portfolioOverview")}
                  </h3>
                  <OverallAnalysisSection analysis={analysis.overall_analysis} t={t} />
                </section>

                {/* Stock Analysis */}
                {analysis.stock_analyses && analysis.stock_analyses.length > 0 && (
                  <section>
                    <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                      {t("portfolio.ai.stockAnalysis")}
                      <span className="text-xs font-normal tabular-nums text-muted-foreground">
                        {analysis.stock_analyses.length}
                      </span>
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
                <SuggestionsSection suggestions={analysis.portfolio_suggestions} t={t} />

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
