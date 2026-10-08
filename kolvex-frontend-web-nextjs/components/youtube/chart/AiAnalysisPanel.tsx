"use client";

import Link from "next/link";
import { Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
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

export default function AiAnalysisPanel({
  state,
  interval,
  onRetry,
  onClear,
  formatDate,
  t,
  className,
}: {
  state: AiPanelState;
  interval: string;
  onRetry: () => void;
  onClear: () => void;
  formatDate: (date: string) => string;
  t: Translate;
  className?: string;
}) {
  const result = state.result;
  const actionClass =
    "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";

  return (
    <section aria-live="polite" aria-label={t("youtubeOpinions.ai.title")} className={cn("rounded-xl border border-border p-4 text-sm", className)}>
      <header className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" />
        <h3 className="font-semibold">{t("youtubeOpinions.ai.title")}</h3>
        {result && (
          <span className="text-xs text-muted-foreground">
            {t(`youtubeOpinions.intervals.${interval}`)} · {formatDate(result.view.start.slice(0, 10))} – {formatDate(result.view.end.slice(0, 10))}
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={onRetry} disabled={state.status === "loading"} className={actionClass}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("youtubeOpinions.ai.rerun")}
          </button>
          {result && (
            <button type="button" onClick={onClear} className={actionClass}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("youtubeOpinions.ai.clear")}
            </button>
          )}
        </div>
      </header>

      {state.status === "loading" && (
        <p className="mt-3 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("youtubeOpinions.ai.loading")}
        </p>
      )}

      {state.status === "error" && (
        <p className="mt-3 text-muted-foreground" role="alert">
          {state.error}{" "}
          {state.error === t("youtubeOpinions.ai.notConfigured") && (
            <Link href="/dashboard/settings" className="font-semibold text-primary underline-offset-2 hover:underline">
              {t("youtubeOpinions.ai.openSettings")}
            </Link>
          )}
        </p>
      )}

      {state.status === "done" && result && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-muted px-2 py-0.5">{t(`youtubeOpinions.ai.trend.${result.trend}`)}</span>
            <span className={cn("rounded-full bg-muted px-2 py-0.5", toneText[biasTone[result.bias]])}>
              {t(`youtubeOpinions.ai.bias.${result.bias}`)}
            </span>
          </div>
          <p className="leading-6">{result.summary}</p>

          {result.levels.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground">{t("youtubeOpinions.ai.levels")}</h4>
              <ul className="mt-1.5 space-y-1.5">
                {[...result.levels]
                  .sort((a, b) => b.price - a.price)
                  .map((level) => (
                    <li key={`${level.kind}-${level.price}`} className="flex gap-2">
                      <span className={cn("w-16 shrink-0 font-semibold tabular-nums", toneText[level.kind === "support" ? "positive" : "negative"])}>
                        {formatPrice(level.price)}
                      </span>
                      <span className="min-w-0 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {t(`youtubeOpinions.ai.${level.kind}`)} · {t(`youtubeOpinions.ai.strength.${level.strength}`)}
                        </span>{" "}
                        {level.reason}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {result.trendlines.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground">{t("youtubeOpinions.ai.trendlines")}</h4>
              <ul className="mt-1.5 space-y-1.5">
                {result.trendlines.map((line) => (
                  <li key={`${line.start.date}-${line.end.date}`} className="text-muted-foreground">
                    <span className={cn("font-medium", toneText[line.kind === "support" ? "positive" : "negative"])}>
                      {t(`youtubeOpinions.ai.${line.kind}Line`)}
                    </span>{" "}
                    {line.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.signals.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground">{t("youtubeOpinions.ai.signals")}</h4>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 marker:text-muted-foreground">
                {result.signals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </div>
          )}

          {result.invalidation && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5">
              <span className="font-semibold">{t("youtubeOpinions.ai.invalidation")}</span> {result.invalidation}
            </p>
          )}
          <p className="text-[11px] leading-4 text-muted-foreground">{t("youtubeOpinions.ai.disclaimer")}</p>
        </div>
      )}
    </section>
  );
}
