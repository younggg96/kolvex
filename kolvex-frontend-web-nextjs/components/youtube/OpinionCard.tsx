"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { proxyImageUrl } from "@/lib/utils";
import type { YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import OpinionStrength from "./OpinionStrength";

function formatDate(value: string | null | undefined, zh: boolean) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function CreatorAvatar({ opinion }: { opinion: YouTubeOpinion }) {
  const [failed, setFailed] = useState(false);
  const title = opinion.channel_title || opinion.channel_id;
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
      {title.slice(0, 1).toUpperCase()}
      {opinion.channel_avatar_url && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxyImageUrl(opinion.channel_avatar_url)}
          alt=""
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
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
  showCreator = true,
  showTicker = true,
}: {
  opinion: YouTubeOpinion;
  onCreator?: (channelId: string) => void;
  onStock?: (ticker: string) => void;
  t: (key: string) => string;
  showCreator?: boolean;
  showTicker?: boolean;
}) {
  const { locale } = useTranslation();
  const zh = locale === "zh";
  const keyPoints = displayList(opinion.key_points).slice(0, 5);
  const risks = displayList(opinion.risks).slice(0, 5);
  const confidence =
    opinion.confidence === null || opinion.confidence === undefined
      ? null
      : Math.round(opinion.confidence * 100);
  const sentiment = t(`youtubeOpinions.${opinion.sentiment}`);

  return (
    <article className="min-w-0 border-b border-border py-6 [overflow-wrap:anywhere] first:pt-2">
      <header className="flex min-w-0 items-start gap-3">
        {showCreator && <CreatorAvatar opinion={opinion} />}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            {showCreator && (
              <button
                type="button"
                className="min-w-0 text-left text-[15px] font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => onCreator?.(opinion.channel_id)}
              >
                {opinion.channel_title || opinion.channel_id}
              </button>
            )}
            {showTicker && (
              <button
                type="button"
                className="text-[15px] font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => onStock?.(opinion.ticker)}
              >
                {opinion.ticker}
              </button>
            )}
            <time
              dateTime={opinion.video_published_at || opinion.opinion_date}
              className="text-xs text-muted-foreground tabular-nums"
            >
              {formatDate(opinion.video_published_at || opinion.opinion_date, zh)}
            </time>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <OpinionStrength value={opinion.direction_score} />
            {opinion.sentiment === "mixed" && (
              <span className="text-xs font-medium text-warning">{sentiment}</span>
            )}
            {confidence !== null && (
              <span className="text-xs text-muted-foreground">
                {t("youtubeOpinions.confidence")}{" "}
                <span className="font-medium text-foreground tabular-nums">{confidence}%</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {(opinion.summary || opinion.thesis) && (
        <p className="mt-4 max-w-[68ch] text-[15px] leading-7 text-foreground">
          {opinion.summary || opinion.thesis}
        </p>
      )}

      {(keyPoints.length > 0 || risks.length > 0) && (
        <div className={`mt-4 grid max-w-[68ch] gap-x-8 gap-y-4 ${keyPoints.length > 0 && risks.length > 0 ? "md:grid-cols-2" : ""}`}>
          {keyPoints.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground">
                {t("youtubeOpinions.keyPoints")}
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm leading-6">
                {keyPoints.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-positive-fill" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {risks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground">
                {t("youtubeOpinions.risks")}
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm leading-6">
                {risks.map((risk) => (
                  <li key={risk} className="flex gap-2">
                    <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-negative-fill" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(opinion.video_title || opinion.video_url) && (
        <footer className="mt-4">
          {opinion.video_url ? (
            <a
              href={opinion.video_url}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex max-w-full items-start gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <PlayCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 group-hover:underline">
                {opinion.video_title || t("youtubeOpinions.openVideo")}
              </span>
            </a>
          ) : (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <PlayCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">{opinion.video_title}</span>
            </p>
          )}
        </footer>
      )}
    </article>
  );
}
