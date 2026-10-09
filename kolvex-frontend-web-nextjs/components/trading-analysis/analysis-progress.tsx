"use client";

import { Check, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgressEvent } from "@/lib/tradingAnalysisApi";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProgressLog } from "./progress-log";

interface AnalysisStage {
  key: string;
  icon: LucideIcon;
}

export function AnalysisProgress({
  stages,
  activeStageIdx,
  elapsedSeconds,
  isStreamConnected,
  isWaitingForModel,
  events,
  t,
}: {
  stages: readonly AnalysisStage[];
  activeStageIdx: number;
  elapsedSeconds: number;
  isStreamConnected: boolean;
  isWaitingForModel: boolean;
  events: ProgressEvent[];
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const activeStage = stages[activeStageIdx];
  const ActiveIcon = activeStage?.icon;
  const progressPercent = Math.round(
    (activeStageIdx / (stages.length - 1)) * 100,
  );

  return (
    <section
      aria-label={t("tradingAnalysis.analysisInProgress")}
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-sm font-medium text-foreground">
              {t("tradingAnalysis.analysisInProgress")}
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn(
                  "h-1 w-1 rounded-full",
                  isStreamConnected ? "bg-positive-fill" : "bg-warning",
                )}
              />
              {t(
                isStreamConnected
                  ? "tradingAnalysis.liveUpdates"
                  : "tradingAnalysis.syncingStatus",
              )}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
            <span>
              {t("tradingAnalysis.elapsed", {
                seconds: String(elapsedSeconds),
              })}
            </span>
            <span>
              {t("tradingAnalysis.stage")} {activeStageIdx + 1}/{stages.length}
            </span>
          </div>
        </div>
        <div aria-hidden="true" className="mt-4 h-0.5 overflow-hidden bg-border">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${Math.max(progressPercent, 5)}%` }}
          />
        </div>
      </div>

      <div className="px-4 sm:px-6">
        <TooltipProvider>
          <ol className="grid grid-cols-3 gap-x-4 gap-y-4 py-5 sm:grid-cols-6 sm:gap-x-5 sm:py-6">
            {stages.map((stage, idx) => {
              const isActive = idx === activeStageIdx;
              const isDone = idx < activeStageIdx;
              const stageLabel = t(`tradingAnalysis.stages.${stage.key}`);
              const stageDesc = t(`tradingAnalysis.stageDesc.${stage.key}`);

              return (
                <li key={stage.key} aria-current={isActive ? "step" : undefined}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        tabIndex={0}
                        className={cn(
                          "flex h-full min-w-0 cursor-default items-center gap-2 border-b pb-3 text-xs outline-offset-4 transition-colors duration-200 motion-reduce:transition-none",
                          isActive
                            ? "border-foreground font-medium text-foreground"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center tabular-nums">
                          {isDone ? (
                            <Check aria-hidden="true" className="h-3.5 w-3.5 text-positive" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </span>
                        <span className="min-w-0 break-words leading-5">{stageLabel}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px]">
                      <p className="text-xs font-medium">{stageLabel}</p>
                      <p className="mt-1 text-xs font-normal text-background/80">{stageDesc}</p>
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
        </TooltipProvider>

        {activeStage && ActiveIcon && (
          <div className="flex items-start gap-3 border-b border-border pb-5" role="status">
            <ActiveIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {t(`tradingAnalysis.stages.${activeStage.key}`)}
              </p>
              <p className="mt-1 max-w-prose text-xs leading-6 text-muted-foreground">
                {isWaitingForModel
                  ? t("tradingAnalysis.waitingForModel")
                  : t(`tradingAnalysis.stageDesc.${activeStage.key}`)}
              </p>
            </div>
            <Loader2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground [animation-duration:1.5s] motion-reduce:animate-none" />
          </div>
        )}

        {events.length > 0 && (
          <ProgressLog events={events} isLive={isStreamConnected} />
        )}
      </div>
    </section>
  );
}
