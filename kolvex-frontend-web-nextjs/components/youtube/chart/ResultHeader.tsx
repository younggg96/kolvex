"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AiTechnicalAnalysis } from "@/lib/stockApi";

type Translate = (key: string, params?: Record<string, string>) => string;
export type ResultTone = "positive" | "negative" | "neutral";

const toneClass: Record<ResultTone, string> = {
  positive: "border-positive/25 bg-positive/10 text-positive",
  negative: "border-negative/25 bg-negative/10 text-negative",
  neutral: "border-border bg-muted/50 text-muted-foreground",
};

/**
 * One header for every AI result on the chart page. Analysis and the conditional
 * plan share the same label, title, badge and provenance line so the two cards
 * read as one system instead of two different designs.
 */
export default function ResultHeader({
  label,
  labelId,
  title,
  badge,
  interval,
  view,
  generatedAt,
  author,
  model,
  formatDate,
  t,
}: {
  label: string;
  labelId?: string;
  title: string;
  badge?: { label: string; tone: ResultTone };
  interval: AiTechnicalAnalysis["interval"];
  view: AiTechnicalAnalysis["view"];
  generatedAt?: string;
  author?: string;
  model?: string;
  formatDate: (date: string) => string;
  t: Translate;
}) {
  const meta: ReactNode[] = [
    t(`youtubeOpinions.intervals.${interval}`),
    <span key="view" className="tabular-nums">
      {formatDate(view.start.slice(0, 10))} – {formatDate(view.end.slice(0, 10))}
    </span>,
  ];
  if (generatedAt) {
    meta.push(
      <time key="generated" dateTime={generatedAt} className="tabular-nums">
        {new Date(generatedAt).toLocaleString(t("common.intlLocale"), { dateStyle: "medium", timeStyle: "short" })}
      </time>,
    );
  }
  if (author) meta.push(t("youtubeOpinions.ai.generatedByAuthor", { author }));
  if (model) meta.push(t("youtubeOpinions.ai.generatedBy", { model }));

  return (
    <header>
      <p id={labelId} className="text-sm font-semibold leading-5 text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-lg font-semibold leading-tight tracking-tight sm:text-xl">{title}</h3>
        {badge && <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", toneClass[badge.tone])}>{badge.label}</span>}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-[11px] leading-4 text-muted-foreground">
        {meta.map((item, index) => (
          <span key={index} className="inline-flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">·</span>}
            {item}
          </span>
        ))}
      </p>
    </header>
  );
}
