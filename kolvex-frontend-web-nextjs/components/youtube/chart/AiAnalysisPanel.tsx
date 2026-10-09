"use client";

import Link from "next/link";
import { ChevronDown, Loader2, RefreshCw, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice, type AiTechnicalAnalysis } from "@/lib/stockApi";
import { toneText, type StrengthTone } from "../strength";
import AnalysisSummary from "./AnalysisSummary";
import TechnicalFindings from "./TechnicalFindings";

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
const disclosureClass = "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded text-sm font-medium hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden";

function indicatorLabel(key: string) {
  if (key.startsWith("ema")) return `EMA${key.slice(3)}`;
  return key.toUpperCase();
}

export default function AiAnalysisPanel({ state, busy = false, interval, onRetry, onClear, formatDate, t, className }: {
  state: AiPanelState;
  busy?: boolean;
  interval: string;
  onRetry: () => void;
  onClear: () => void;
  formatDate: (date: string) => string;
  t: Translate;
  className?: string;
}) {
  const result = state.result;
  const loading = state.status === "loading";
  const indicators = result ? indicatorOrder.flatMap(key => {
    const value = result.indicators[key];
    return typeof value === "number" && Number.isFinite(value) ? [{ key, value }] : [];
  }) : [];
  const levels = result ? [...result.levels].sort((a, b) => b.price - a.price) : [];
  const hasDetails = result && (indicators.length > 0 || result.trendlines.length > 0 || (!result.findings?.length && result.signals.length > 0));

  return (
    <section aria-live="polite" aria-label={t("youtubeOpinions.ai.title")} className={cn("min-w-0 text-sm text-foreground", className)}>
      <header>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-lg font-semibold leading-7">{result ? t(`youtubeOpinions.ai.trend.${result.trend}`) : t("youtubeOpinions.ai.title")}</h3>
          {result && <span className={cn("text-sm font-semibold", toneText[biasTone[result.bias]])}>{t(`youtubeOpinions.ai.bias.${result.bias}`)}</span>}
        </div>
        {result && <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 break-words text-xs leading-5 text-muted-foreground">
          <span>{t(`youtubeOpinions.intervals.${interval}`)}</span>
          <span className="tabular-nums">{formatDate(result.view.start.slice(0, 10))} – {formatDate(result.view.end.slice(0, 10))}</span>
          {result.model && <span>{t("youtubeOpinions.ai.generatedBy", { model: `${result.provider || ""} / ${result.model}` })}</span>}
        </p>}
      </header>

      {loading && <p className="mt-4 flex items-center gap-2 text-sm leading-6 text-muted-foreground" role="status"><Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />{t("youtubeOpinions.ai.loading")}</p>}
      {state.status === "error" && <p className="mt-4 text-sm leading-6 text-muted-foreground" role="alert">
        {state.error}{" "}
        {state.error === t("youtubeOpinions.ai.notConfigured") && <Link href="/dashboard/settings?tab=api-keys" className="font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t("youtubeOpinions.ai.openSettings")}</Link>}
      </p>}

      {state.status === "done" && result && <div className="mt-4 ">
        <AnalysisSummary key={result.summary} text={result.summary} t={t} />
        {result.invalidation && <div className="mt-4  rounded-xl bg-muted/60 p-4">
          <h4 className="text-sm font-semibold text-warning">{t("youtubeOpinions.ai.invalidation")}</h4>
          <p className="mt-1 whitespace-pre-line break-words text-sm leading-7">{result.invalidation}</p>
        </div>}

        {levels.length > 0 && <section className="mt-6" aria-label={t("youtubeOpinions.ai.levels")}>
          <h4 className="text-sm font-semibold">{t("youtubeOpinions.ai.levels")}</h4>
          <ul className="mt-2 divide-y divide-border">
            {levels.map(level => <li key={`${level.kind}-${level.price}`}>
              <details className="group/level">
                <summary className={cn(disclosureClass, "gap-2 py-2")}>
                  <span className={cn("shrink-0 text-base font-semibold tabular-nums", toneText[level.kind === "support" ? "positive" : "negative"])}>{formatPrice(level.price)}</span>
                  <span className="ml-auto text-sm">{t(`youtubeOpinions.ai.${level.kind}`)}</span>
                  <span className="text-xs font-normal text-muted-foreground">{t(`youtubeOpinions.ai.strength.${level.strength}`)}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground group-open/level:rotate-180" aria-hidden="true" />
                </summary>
                <p className=" break-words pb-3 text-sm leading-7 text-muted-foreground">{level.reason}</p>
              </details>
            </li>)}
          </ul>
        </section>}

        <TechnicalFindings result={result} t={t} />
        {hasDetails && <details className="group/indicators mt-4 border-t border-border">
          <summary className={disclosureClass}>
            {t("youtubeOpinions.ai.supportingDetails")}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground group-open/indicators:rotate-180" aria-hidden="true" />
          </summary>
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
                  <p className="mt-1  break-words text-sm leading-7 text-muted-foreground">{line.reason}</p>
                </li>)}
              </ul>
            </div>}
            {!result.findings?.length && result.signals.length > 0 && <div>
              <h4 className="text-sm font-medium">{t("youtubeOpinions.ai.signals")}</h4>
              <ul className="mt-2  space-y-2">
                {result.signals.map(signal => <li key={signal} className="break-words text-sm leading-7 text-muted-foreground">{signal}</li>)}
              </ul>
            </div>}
          </div>
        </details>}
        <p className="mt-4  text-xs leading-5 text-muted-foreground">{t("youtubeOpinions.ai.disclaimer")}</p>
      </div>}

      <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={loading || busy} aria-busy={loading}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />{t("youtubeOpinions.ai.rerun")}
        </Button>
        {result && <Button type="button" size="sm" variant="ghost" onClick={onClear} disabled={loading || busy} className="text-muted-foreground">
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />{t("youtubeOpinions.ai.hideAnalysis")}
        </Button>}
      </footer>
    </section>
  );
}
