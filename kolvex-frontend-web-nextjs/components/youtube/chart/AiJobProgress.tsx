"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Translate = (key: string, params?: Record<string, string>) => string;
export type AiJobPhase = "submitting" | "queued" | "running";
type Operation = "analysis" | "drawings";

const STEPS: AiJobPhase[] = ["submitting", "queued", "running"];

function useElapsed(startedAt?: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  if (!startedAt) return null;
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function titleKey(operation: Operation, phase: AiJobPhase) {
  return `youtubeOpinions.ai.job.${operation}.${phase}`;
}

/** One-line status chip shown next to the chart while a background job is active. */
export function AiJobStatusChip({ operation, phase = "submitting", startedAt, t, className }: {
  operation: Operation;
  phase?: AiJobPhase;
  startedAt?: number;
  t: Translate;
  className?: string;
}) {
  const elapsed = useElapsed(startedAt);
  return (
    <p role="status" className={cn("inline-flex max-w-full items-center gap-2 rounded-full bg-foreground/[0.06] px-3 py-1.5 text-xs leading-5 text-muted-foreground", className)}>
      <Loader2 className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin" aria-hidden="true" />
      <span className="min-w-0 truncate font-medium text-foreground">{t(titleKey(operation, phase))}</span>
      {elapsed && <span className="shrink-0 tabular-nums">{elapsed}</span>}
    </p>
  );
}

export interface JobProgressStep { key: string; label: string }

/**
 * Generic progress card for long-running background AI jobs: title, hint, elapsed time,
 * a step track, a result-shaped skeleton and a "you can leave" note, so the results
 * area never sits empty while a job is queued or running.
 */
export function JobProgressCard({ title, hint, steps, activeIndex, startedAt, elapsedLabel, leaveLabel, progressLabel, skeleton = "text", className }: {
  title: string;
  hint?: string;
  steps: JobProgressStep[];
  activeIndex: number;
  startedAt?: number;
  elapsedLabel: (time: string) => string;
  leaveLabel: string;
  progressLabel: string;
  skeleton?: "text" | "rows" | "report";
  className?: string;
}) {
  const elapsed = useElapsed(startedAt);
  return (
    <section role="status" aria-live="polite" aria-label={title} className={cn("min-w-0 rounded-3xl bg-foreground/[0.04] p-4 sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background shadow-sm ring-1 ring-border">
          <Loader2 className="h-4 w-4 text-foreground motion-safe:animate-spin" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h3 className="text-base font-semibold leading-6">{title}</h3>
            {elapsed && <span className="text-xs tabular-nums text-muted-foreground">{elapsedLabel(elapsed)}</span>}
          </div>
          {hint && <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{hint}</p>}
        </div>
      </div>

      <ol className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label={progressLabel}>
        {steps.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li key={step.key} className="min-w-0" aria-current={active ? "step" : undefined}>
              <span className={cn("block h-1 overflow-hidden rounded-full", done ? "bg-foreground/70" : "bg-foreground/10")}>
                {active && <span className="block h-full w-1/2 rounded-full bg-foreground/70 motion-safe:animate-[ai-job-sweep_1.6s_ease-in-out_infinite] motion-reduce:w-full" />}
              </span>
              <span className={cn("mt-1.5 flex items-center gap-1 text-xs leading-5", active ? "font-medium text-foreground" : "text-muted-foreground")}>
                {done && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
                <span className="truncate">{step.label}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 space-y-3" aria-hidden="true">
        {skeleton === "rows" ? [0, 1, 2].map(row => <div key={row} className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-16 shrink-0" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-12 shrink-0" />
        </div>) : <>
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-3/4" />
          {skeleton === "report" ? <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
          </div> : <div className="grid grid-cols-2 gap-3 pt-1">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>}
        </>}
      </div>

      <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{leaveLabel}</p>
    </section>
  );
}

/** Progress card for chart AI jobs (analysis / drawings). */
export default function AiJobProgress({ operation, phase = "submitting", startedAt, t, className }: {
  operation: Operation;
  phase?: AiJobPhase;
  startedAt?: number;
  t: Translate;
  className?: string;
}) {
  return (
    <JobProgressCard
      title={t(titleKey(operation, phase))}
      hint={t(`youtubeOpinions.ai.job.hint.${phase}`)}
      steps={STEPS.map(key => ({ key, label: t(`youtubeOpinions.ai.job.steps.${key}`) }))}
      activeIndex={STEPS.indexOf(phase)}
      startedAt={startedAt}
      elapsedLabel={time => t("youtubeOpinions.ai.job.elapsed", { time })}
      leaveLabel={t("youtubeOpinions.ai.job.leave")}
      progressLabel={t("youtubeOpinions.ai.job.progress")}
      skeleton={operation === "analysis" ? "text" : "rows"}
      className={className}
    />
  );
}
