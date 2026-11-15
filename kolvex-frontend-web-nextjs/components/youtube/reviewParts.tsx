"use client";

import { PlayCircle } from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { signedPercent } from "@/lib/opinionOutcome";
import { callDirection, type ReviewSentiment } from "@/lib/opinionReview";
import { cn } from "@/lib/utils";

type T = (key: string, params?: Record<string, string>) => string;

/** 看涨 / 看跌 as a small tinted badge; the word carries the meaning, the tint only helps. */
export function SentimentBadge({ sentiment, t }: { sentiment: ReviewSentiment; t: T }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-px text-[0.6875rem] font-medium",
        sentiment === "bullish" ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
      )}
    >
      {t(`youtubeOpinions.review.${sentiment}`)}
    </span>
  );
}

/** Icon link to the source video; the label is for screen readers and the hover title. */
export function VideoLink({ url, t }: { url: string | null; t: T }) {
  if (!url) return null;
  const label = t("youtubeOpinions.review.watchVideo");
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <PlayCircle className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

/** A labelled figure tile. `tone` colours the value; the sign or word still states direction. */
export function Tile({
  label,
  value,
  tone = "flat",
  tip,
  sub,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "flat";
  tip?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-1 text-[0.6875rem] text-muted-foreground">
        <span className="truncate">{label}</span>
        {tip}
      </div>
      <div
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "",
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{sub}</div> : null}
    </div>
  );
}

export function toneOf(value: number): "positive" | "negative" | "flat" {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? "positive" : rounded < 0 ? "negative" : "flat";
}

/**
 * The tile for a call on the benchmark itself: excess return is zero by construction, so it
 * states whether the price moved the way the call said, with the move itself underneath.
 */
export function DirectionTile({
  sentiment,
  returnPct,
  benchmark,
  label,
  t,
}: {
  sentiment: ReviewSentiment;
  returnPct: number;
  benchmark: string;
  label?: string;
  t: T;
}) {
  const direction = callDirection(sentiment, returnPct);
  const word =
    direction === "match"
      ? t("youtubeOpinions.review.directionMatch")
      : direction === "against"
        ? t("youtubeOpinions.review.directionAgainst")
        : t("youtubeOpinions.review.directionFlat");
  return (
    <Tile
      label={label ?? t("youtubeOpinions.review.cellDirection")}
      value={word}
      tone={direction === "match" ? "positive" : direction === "against" ? "negative" : "flat"}
      sub={label ? `${benchmark} ${signedPercent(returnPct)}` : undefined}
      tip={
        <InfoTip label={t("youtubeOpinions.review.howLabel")}>
          {t("youtubeOpinions.review.benchmarkTip", { benchmark })}
        </InfoTip>
      }
    />
  );
}
