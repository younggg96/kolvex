"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import CompanyLogo from "@/components/ui/company-logo";
import { proxyImageUrl } from "@/lib/utils";
import type { YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import OpinionStrength from "./OpinionStrength";

export type VideoOpinionGroup = {
  videoId: string;
  opinions: YouTubeOpinion[];
};

export function groupOpinionsByVideo(opinions: YouTubeOpinion[]) {
  const groups = new Map<string, VideoOpinionGroup>();
  for (const opinion of opinions) {
    const key = opinion.video_id || opinion.id;
    const group = groups.get(key);
    if (group) group.opinions.push(opinion);
    else groups.set(key, { videoId: key, opinions: [opinion] });
  }
  return Array.from(groups.values());
}

function formatDate(value: string | null | undefined, intlLocale: string) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(intlLocale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function Thumbnail({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-muted-foreground sm:w-36">
      <PlayCircle className="h-5 w-5" />
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxyImageUrl(src)}
          alt=""
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}

export default function VideoOpinionCard({
  group,
  t,
  onStock,
}: {
  group: VideoOpinionGroup;
  t: (key: string, params?: Record<string, string>) => string;
  onStock?: (ticker: string) => void;
}) {
  const video = group.opinions[0];
  const title = video.video_title || t("youtubeOpinions.untitledVideo");
  const published = video.video_published_at || video.opinion_date;
  const opinions = [...group.opinions].sort(
    (a, b) => Math.abs(b.direction_score) - Math.abs(a.direction_score),
  );

  return (
    <article className="min-w-0 border-b border-border py-6 [overflow-wrap:anywhere] first:pt-2">
      <header className="flex min-w-0 items-start gap-4">
        {video.video_url ? (
          <a
            href={video.video_url}
            target="_blank"
            rel="noreferrer"
            tabIndex={-1}
            aria-hidden="true"
            className="shrink-0"
          >
            <Thumbnail src={video.thumbnail_url} />
          </a>
        ) : (
          <Thumbnail src={video.thumbnail_url} />
        )}
        <div className="min-w-0 flex-1">
          {video.video_url ? (
            <a
              href={video.video_url}
              target="_blank"
              rel="noreferrer"
              className="text-[15px] font-semibold leading-6 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {title}
            </a>
          ) : (
            <p className="text-[15px] font-semibold leading-6">{title}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            <time dateTime={published}>{formatDate(published, t("common.intlLocale"))}</time>
            <span aria-hidden="true"> · </span>
            {t("youtubeOpinions.videoStockCount", { count: String(opinions.length) })}
          </p>
        </div>
      </header>

      <ul className="mt-4 min-w-0 space-y-1">
        {opinions.map((opinion) => {
          const confidence =
            opinion.confidence === null || opinion.confidence === undefined
              ? null
              : Math.round(opinion.confidence * 100);
          return (
            <li key={opinion.id}>
              <button
                type="button"
                onClick={() => onStock?.(opinion.ticker)}
                className="group flex w-full min-w-0 items-start gap-3 rounded-xl py-3 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:-mx-3 sm:w-[calc(100%+1.5rem)] sm:px-3"
              >
                <CompanyLogo symbol={opinion.ticker} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[15px] font-semibold">{opinion.ticker}</span>
                    <OpinionStrength value={opinion.direction_score} />
                    {opinion.sentiment === "mixed" && (
                      <span className="text-xs font-medium text-warning">
                        {t("youtubeOpinions.mixed")}
                      </span>
                    )}
                    {confidence !== null && (
                      <span className="text-xs text-muted-foreground">
                        {t("youtubeOpinions.confidence")}{" "}
                        <span className="font-medium text-foreground tabular-nums">{confidence}%</span>
                      </span>
                    )}
                  </span>
                  {(opinion.summary || opinion.thesis) && (
                    <span className="mt-1 block max-w-[68ch] text-sm leading-6 text-muted-foreground group-hover:text-foreground">
                      {opinion.summary || opinion.thesis}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
