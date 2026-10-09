"use client";

import Link from "next/link";
import TechnicalFindings from "./TechnicalFindings";
import { Loader2, RefreshCw, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice, type AiTechnicalAnalysis } from "@/lib/stockApi";
import { toneText, type StrengthTone } from "../strength";

type Translate = (key: string, params?: Record<string, string>) => string;

export interface AiPanelState {
  status: "idle" | "loading" | "done" | "error";
  result?: AiTechnicalAnalysis;
  error?: string;
}

const biasTone: Record<AiTechnicalAnalysis["bias"], StrengthTone> = {
  bullish: "positive",
  bearish: "negative",
  neutral: "neutral",
};

const indicatorOrder = ["rsi14", "ema20", "ema50", "ema200", "atr14"] as const;

function indicatorLabel(key: string) {
  if (key.startsWith("ema")) return `EMA${key.slice(3)}`;
  if (key === "rsi14") return "RSI14";
  if (key === "atr14") return "ATR14";
  return key.toUpperCase();
}

function indicatorValue(key: string, value: number) {
  if (key.startsWith("rsi")) return value.toFixed(1);
  return formatPrice(value);
}

function SectionTitle({ children }: { children: string }) {
  return <h4 className="text-xs font-medium leading-4 text-muted-foreground">{children}</h4>;
}

export default function AiAnalysisPanel({
  state,
  busy = false,
  interval,
  onRetry,
  onClear,
  formatDate,
  t,
  className,
}: {
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
  const actionClass =
    "inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";

  const indicators = result
    ? indicatorOrder.flatMap((key) => {
        const value = result.indicators[key];
        return typeof value === "number" && Number.isFinite(value) ? [{ key, value }] : [];
      })
    : [];

  const levels = result ? [...result.levels].sort((a, b) => b.price - a.price) : [];

  return (
    <section
      aria-live="polite"
      aria-label={t("youtubeOpinions.ai.title")}
      className={cn("min-w-0 text-sm text-foreground", className)}
    >
      <header>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-lg font-semibold leading-6">
              {result ? t(`youtubeOpinions.ai.trend.${result.trend}`) : t("youtubeOpinions.ai.title")}
            </h3>
            {result && (
              <p className={cn("text-sm font-medium leading-5", toneText[biasTone[result.bias]])}>
                {t(`youtubeOpinions.ai.bias.${result.bias}`)}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <button type="button" onClick={onRetry} disabled={loading || busy} className={actionClass}>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t("youtubeOpinions.ai.rerun")}
            </button>
            {result && (
              <button type="button" onClick={onClear} className={actionClass}>
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                {t("youtubeOpinions.ai.hideAnalysis")}
              </button>
            )}
          </div>
        </div>
        {result && (
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-4 text-muted-foreground">
            <span>{t(`youtubeOpinions.intervals.${interval}`)}</span>
            <span className="whitespace-nowrap tabular-nums">
              {formatDate(result.view.start.slice(0, 10))} – {formatDate(result.view.end.slice(0, 10))}
            </span>
          </p>
        )}
      </header>

      {loading && (
        <p className="mt-4 text-[13px] leading-5 text-muted-foreground">{t("youtubeOpinions.ai.loading")}</p>
      )}

      {state.status === "error" && (
        <p className="mt-4 text-[13px] leading-5 text-muted-foreground" role="alert">
          {state.error}{" "}
          {state.error === t("youtubeOpinions.ai.notConfigured") && (
            <Link
              href="/dashboard/settings"
              className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t("youtubeOpinions.ai.openSettings")}
            </Link>
          )}
        </p>
      )}

      {state.status === "done" && result && (
        <div className="mt-4">
          <p className="text-sm leading-6">{result.summary}</p>
          <TechnicalFindings result={result} t={t} />

          {indicators.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-5">
              {indicators.map((item) => (
                <li key={item.key} className="whitespace-nowrap">
                  <span className="text-muted-foreground">{indicatorLabel(item.key)}</span>{" "}
                  <span className="font-semibold tabular-nums">{indicatorValue(item.key, item.value)}</span>
                </li>
              ))}
            </ul>
          )}

          {levels.length > 0 && (
            <div className={cn(indicators.length > 0 && "mt-5")}>
              <SectionTitle>{t("youtubeOpinions.ai.levels")}</SectionTitle>
              <ul className="mt-2">
                {levels.map((level) => {
                  const tone = level.kind === "support" ? "positive" : "negative";
                  return (
                    <li
                      key={`${level.kind}-${level.price}`}
                      className="flex gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0"
                    >
                      <span
                        className={cn(
                          "w-[5.5rem] shrink-0 pt-px text-sm font-semibold tabular-nums leading-5",
                          toneText[tone],
                        )}
                      >
                        {formatPrice(level.price)}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] font-medium leading-5">
                          {t(`youtubeOpinions.ai.${level.kind}`)}
                          <span className="font-normal text-muted-foreground">
                            {t(`youtubeOpinions.ai.strength.${level.strength}`)}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{level.reason}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {result.trendlines.length > 0 && (
            <div className="mt-5">
              <SectionTitle>{t("youtubeOpinions.ai.trendlines")}</SectionTitle>
              <ul className="mt-2">
                {result.trendlines.map((line) => {
                  const tone = line.kind === "support" ? "positive" : "negative";
                  return (
                    <li
                      key={`${line.start.date}-${line.end.date}-${line.kind}`}
                      className="border-t border-border py-2.5 first:border-t-0 first:pt-0"
                    >
                      <p className={cn("flex items-center gap-2 text-[13px] font-semibold leading-5", toneText[tone])}>
                        <span className="h-px w-4 bg-current" aria-hidden="true" />
                        {t(`youtubeOpinions.ai.${line.kind}Line`)}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{line.reason}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!result.findings?.length && result.signals.length > 0 && (
            <div className="mt-5">
              <SectionTitle>{t("youtubeOpinions.ai.signals")}</SectionTitle>
              <ul className="mt-2">
                {result.signals.map((signal) => (
                  <li
                    key={signal}
                    className="border-t border-border py-2 text-[13px] leading-5 first:border-t-0 first:pt-0"
                  >
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          )}


          {result.invalidation && (
            <div className="mt-5 max-w-[68ch]">
              <h4 className="text-xs font-medium leading-4 text-warning">{t("youtubeOpinions.ai.invalidation")}</h4>
              <p className="mt-1.5 text-[13px] leading-5">{result.invalidation}</p>
            </div>
          )}

          <p className="mt-4 max-w-[68ch] text-xs leading-5 text-muted-foreground">{t("youtubeOpinions.ai.disclaimer")}</p>
        </div>
      )}
    </section>
  );
}
