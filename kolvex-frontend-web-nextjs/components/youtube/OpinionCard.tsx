"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, proxyImageUrl } from "@/lib/utils";
import type {
  OpinionSentiment,
  YouTubeCreatorSummary,
  YouTubeOpinion,
} from "@/lib/youtubeOpinionsApi";

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function formatScore(value?: number | null) {
  const score = Number(value || 0);
  return score > 0 ? `+${score.toFixed(0)}` : score.toFixed(0);
}

function formatConfidence(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return `${Math.round(value * 100)}%`;
}

function scoreClass(value?: number | null) {
  const score = Number(value || 0);
  if (score > 15) return "text-emerald-600 dark:text-emerald-400";
  if (score < -15) return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

function sentimentClass(sentiment: string) {
  if (sentiment === "bullish") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-300";
  }
  if (sentiment === "bearish") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-500/10 dark:text-rose-300";
  }
  if (sentiment === "mixed") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-300";
  }
  return "border-border bg-muted text-muted-foreground";
}

function SentimentBadge({
  sentiment,
  t,
}: {
  sentiment: OpinionSentiment | string;
  t: (key: string) => string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", sentimentClass(sentiment))}
    >
      {t(`youtubeOpinions.${sentiment}`)}
    </Badge>
  );
}

function CreatorAvatar({
  creator,
}: {
  creator: Partial<YouTubeCreatorSummary | YouTubeOpinion>;
}) {
  const avatar =
    "channel_avatar_url" in creator ? creator.channel_avatar_url : null;
  const title = "channel_title" in creator ? creator.channel_title : null;
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxyImageUrl(avatar)}
          alt={title || "creator"}
          className="h-full w-full object-cover"
        />
      ) : (
        (title || "?").slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

function displayList(value?: unknown[]) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .filter(Boolean);
}

export default function OpinionCard({
  opinion,
  t,
  onCreator,
  onStock,
}: {
  opinion: YouTubeOpinion;
  onCreator?: (channelId: string) => void;
  onStock?: (ticker: string) => void;
  t: (key: string) => string;
}) {
  const keyPoints = displayList(opinion.key_points);
  const risks = displayList(opinion.risks);

  return (
    <article className="min-w-0 max-w-full rounded-lg border border-border bg-card p-3 [overflow-wrap:anywhere] sm:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <CreatorAvatar creator={opinion} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="min-w-0 break-words text-left font-medium hover:text-primary"
                onClick={() => onCreator?.(opinion.channel_id)}
              >
                {opinion.channel_title || opinion.channel_id}
              </button>
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={() => onStock?.(opinion.ticker)}
              >
                {opinion.ticker}
              </button>
              <SentimentBadge sentiment={opinion.sentiment} t={t} />
            </div>
            <div className="mt-1 break-words text-sm leading-5 text-muted-foreground">
              {opinion.video_title || opinion.video_id}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 md:justify-end">
          <div
            className={cn(
              "text-lg font-semibold",
              scoreClass(opinion.direction_score),
            )}
          >
            {formatScore(opinion.direction_score)}
          </div>
          {opinion.video_url && (
            <Button asChild variant="ghost" size="icon" className="h-11 w-11">
              <a href={opinion.video_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only">
                  {t("youtubeOpinions.openVideo")}
                </span>
              </a>
            </Button>
          )}
        </div>
      </div>

      {(opinion.summary || opinion.thesis) && (
        <p className="mt-4 break-words text-sm leading-6 text-foreground/90">
          {opinion.summary || opinion.thesis}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("youtubeOpinions.confidence")}
          </div>
          <div className="mt-1">{formatConfidence(opinion.confidence)}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("youtubeOpinions.latest")}
          </div>
          <div className="mt-1">{formatDate(opinion.video_published_at)}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("youtubeOpinions.score")}
          </div>
          <div
            className={cn(
              "mt-1 font-medium",
              scoreClass(opinion.direction_score),
            )}
          >
            {formatScore(opinion.direction_score)}
          </div>
        </div>
      </div>

      {(keyPoints.length > 0 || risks.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {keyPoints.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {t("youtubeOpinions.keyPoints")}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {keyPoints.slice(0, 5).map((point) => (
                  <Badge
                    key={point}
                    variant="outline"
                    className="max-w-full whitespace-normal break-words text-left font-normal leading-5"
                  >
                    {point}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {risks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {t("youtubeOpinions.risks")}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {risks.slice(0, 5).map((risk) => (
                  <Badge
                    key={risk}
                    variant="outline"
                    className="max-w-full whitespace-normal break-words text-left font-normal leading-5"
                  >
                    {risk}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
