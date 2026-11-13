"use client";

import Link from "next/link";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Disclosure from "@/components/ui/disclosure";
import { cn } from "@/lib/utils";
import { formatPrice, type AiTechnicalAnalysis } from "@/lib/stockApi";
import { toneText, type StrengthTone } from "../strength";
import AnalysisSummary from "./AnalysisSummary";
import TechnicalFindings from "./TechnicalFindings";
import ResultHeader from "./ResultHeader";
import { authorLabel } from "@/lib/analysisAuthor";
import { useCopy } from "@/components/decision/shared";
import type { AnalysisVersion } from "@/lib/stockAnalysisHistory";

type Translate = (key: string, params?: Record<string, string>) => string;

export interface AiPanelState {
  status: "idle" | "loading" | "done" | "error";
  result?: AiTechnicalAnalysis;
  error?: string;
}

const biasTone: Record<AiTechnicalAnalysis["bias"], StrengthTone> = {
  bullish: "positive", bearish: "negative", neutral: "neutral",
};
const indicatorOrder = ["rsi14", "ema20", "ema50", "ema200", "atr14"] as const;
function indicatorLabel(key: string) {
  if (key.startsWith("ema")) return `EMA${key.slice(3)}`;
  return key.toUpperCase();
}

const percent = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;

export default function AiAnalysisPanel({ state, busy = false, onRetry, showRetry = true, formatDate, t, className, version, forecastVisible = false, onToggleForecast }: {
  state: AiPanelState;
  busy?: boolean;
  onRetry: () => void;
  showRetry?: boolean;
  formatDate: (date: string) => string;
  t: Translate;
  className?: string;
  /** Saved analysis version, so the header can show who generated it. */
  version?: AnalysisVersion<AiTechnicalAnalysis> | null;
  forecastVisible?: boolean;
  /** Absent when this chart cannot draw the saved forecast (compact view or another interval). */
  onToggleForecast?: () => void;
}) {
  const c = useCopy();
  const result = state.result;
  const loading = state.status === "loading";
  const indicators = result ? indicatorOrder.flatMap(key => {
    const value = result.indicators[key];
    return typeof value === "number" && Number.isFinite(value) ? [{ key, value }] : [];
  }) : [];
  const levels = result ? [...result.levels].sort((a, b) => b.price - a.price) : [];
  const forecast = result?.forecast;
  const hasDetails = result && (indicators.length > 0 || result.trendlines.length > 0 || (!result.findings?.length && result.signals.length > 0));

  return (
    <section aria-live="polite" aria-label={t("youtubeOpinions.ai.title")} className={cn("min-w-0 text-sm text-foreground", className)}>
      {result ? (
        <ResultHeader
          label={t("youtubeOpinions.ai.title")}
          title={t(`youtubeOpinions.ai.trend.${result.trend}`)}
          badge={{ label: t(`youtubeOpinions.ai.bias.${result.bias}`), tone: biasTone[result.bias] }}
          interval={result.interval}
          view={result.view}
          generatedAt={result.generated_at}
          author={version ? authorLabel(version, c) : undefined}
          model={result.model ? `${result.provider || ""} / ${result.model}` : undefined}
          formatDate={formatDate}
          t={t}
        />
      ) : (
        <header><h3 className="text-lg font-semibold leading-tight tracking-tight sm:text-xl">{t("youtubeOpinions.ai.title")}</h3></header>
      )}

      {loading && <div className="mt-4"><p className="text-sm leading-6 text-muted-foreground" aria-hidden="true">{t("youtubeOpinions.ai.loading")}</p><ContentLoading label={t("youtubeOpinions.ai.loading")} className="mt-1 min-h-0">
        <div className="mt-4 space-y-2.5">{[0, 1, 2].map(i => <Skeleton key={i} className={cn("h-4 rounded-md", i === 2 ? "w-2/3" : "w-full")} />)}</div>
        <div className="mt-4 rounded-3xl bg-muted/60 p-4"><Skeleton className="h-4 w-24 rounded-md" /><div className="mt-3 space-y-2.5"><Skeleton className="h-4 w-full rounded-md" /><Skeleton className="h-4 w-2/3 rounded-md" /></div></div>
        <div className="mt-6"><Skeleton className="h-4 w-20 rounded-md" /><div className="mt-2 divide-y divide-border">{[0, 1, 2].map(i => <div key={i} className="flex items-center gap-2 py-2.5"><Skeleton className="h-5 w-16 rounded-md" /><Skeleton className="ml-2 h-4 w-12 rounded-md" /><Skeleton className="ml-auto h-3 w-10 rounded-md" /><Skeleton className="h-4 w-4 rounded" /></div>)}</div></div>
      </ContentLoading></div>}
      {state.status === "error" && <p className="mt-4 text-sm leading-6 text-muted-foreground" role="alert">
        {state.error}{" "}
        {state.error === t("youtubeOpinions.ai.notConfigured") && <Link href="/dashboard/settings?tab=api-keys" className="font-medium underline underline-offset-2 focus-visible:outline-none ">{t("youtubeOpinions.ai.openSettings")}</Link>}
      </p>}

      {state.status === "done" && result && <div className="mt-5">
        <AnalysisSummary key={result.summary} text={result.summary} t={t} />
        {result.invalidation && <div className="mt-4 rounded-3xl bg-muted/60 p-4">
          <h4 className="text-sm font-semibold text-warning">{t("youtubeOpinions.ai.invalidation")}</h4>
          <p className="mt-2 max-w-[90ch] whitespace-pre-line break-words text-[13px] leading-6 text-muted-foreground">{result.invalidation}</p>
        </div>}

        {forecast && <section className="mt-4 rounded-3xl bg-muted/60 p-4" aria-label={t("youtubeOpinions.forecast.panelTitle")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">{t("youtubeOpinions.forecast.panelTitle")}</h4>
            {onToggleForecast && <Button type="button" size="sm" variant="outline" className="min-h-11 sm:min-h-9" aria-pressed={forecastVisible} onClick={onToggleForecast}>
              {forecastVisible ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
              {t(forecastVisible ? "youtubeOpinions.forecast.hideOnChart" : "youtubeOpinions.forecast.showOnChart")}
            </Button>}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">{t("youtubeOpinions.forecast.median", { days: String(forecast.horizon) })}</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{percent(forecast.summary.median_return)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">P10–P90</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{percent(forecast.summary.p10_return)} ~ {percent(forecast.summary.p90_return)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("youtubeOpinions.forecast.probUp")}</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{Math.round(forecast.summary.prob_up * 100)}%</dd></div>
          </dl>
          <p className="mt-3 max-w-[90ch] text-[13px] leading-6 text-muted-foreground">{t("youtubeOpinions.forecast.asOf", { date: forecast.context_end })} · {t("youtubeOpinions.forecast.disclaimer")}</p>
        </section>}

        {levels.length > 0 && <section className="mt-7" aria-label={t("youtubeOpinions.ai.levels")}>
          <h4 className="text-sm font-semibold">{t("youtubeOpinions.ai.levels")}</h4>
          <ul className="mt-2 space-y-2">
            {levels.map(level => <li key={`${level.kind}-${level.price}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
              <div className="flex shrink-0 items-center gap-2">
                <span className={cn("shrink-0 text-base font-semibold tabular-nums tracking-tight", toneText[level.kind === "support" ? "positive" : "negative"])}>{formatPrice(level.price)}</span>
                <span className="text-[13px] font-medium">{t(`youtubeOpinions.ai.${level.kind}`)}</span>
              </div>
              <p className="min-w-[10rem] flex-1 break-words text-[13px] leading-5 text-muted-foreground">{level.reason}</p>
              <span className={cn(
                "ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                level.strength === "strong" ? "border-positive/25 bg-positive/10 text-positive"
                  : level.strength === "weak" ? "border-border bg-muted/50 text-muted-foreground"
                    : "border-border bg-secondary text-secondary-foreground",
              )}>{t(`youtubeOpinions.ai.strength.${level.strength}`)}</span>
            </li>)}
          </ul>
        </section>}

        <TechnicalFindings result={result} t={t} />
        {hasDetails && <Disclosure title={t("youtubeOpinions.ai.supportingDetails")} className="mt-0 py-3">
          <div className="space-y-5 pb-4 pt-2">
            {indicators.length > 0 && <dl className="grid grid-cols-2 gap-4">
              {indicators.map(item => <div key={item.key}>
                <dt className="text-xs text-muted-foreground">{indicatorLabel(item.key)}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">{item.key.startsWith("rsi") ? item.value.toFixed(1) : formatPrice(item.value)}</dd>
              </div>)}
            </dl>}
            {result.trendlines.length > 0 && <div>
              <h4 className="text-sm font-medium">{t("youtubeOpinions.ai.trendlines")}</h4>
              <ul className="mt-2 space-y-3">
                {result.trendlines.map(line => <li key={`${line.start.date}-${line.end.date}-${line.kind}`}>
                  <p className={cn("text-sm font-medium", toneText[line.kind === "support" ? "positive" : "negative"])}>{t(`youtubeOpinions.ai.${line.kind}Line`)}</p>
                  <p className="mt-1 break-words text-[13px] leading-6 text-muted-foreground">{line.reason}</p>
                </li>)}
              </ul>
            </div>}
            {!result.findings?.length && result.signals.length > 0 && <div>
              <h4 className="text-sm font-medium">{t("youtubeOpinions.ai.signals")}</h4>
              <ul className="mt-2 space-y-2">
                {result.signals.map(signal => <li key={signal} className="break-words text-[13px] leading-6 text-muted-foreground">{signal}</li>)}
              </ul>
            </div>}
          </div>
        </Disclosure>}
      </div>}

      {showRetry && <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-border py-3">
        <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={loading || busy} aria-busy={loading}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />{t("youtubeOpinions.ai.rerun")}
        </Button>
      </footer>}
    </section>
  );
}
