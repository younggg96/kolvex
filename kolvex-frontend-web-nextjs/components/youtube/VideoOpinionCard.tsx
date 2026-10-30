"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown, PlayCircle } from "lucide-react";
import CompanyLogo from "@/components/ui/company-logo";
import { cn, proxyImageUrl } from "@/lib/utils";
import type { OpinionSentiment } from "@/lib/youtubeOpinionsApi";
import OpinionStrength from "./OpinionStrength";
import { formatOpinionDate } from "@/lib/opinionDates";
import type { VideoOpinionGroup } from "@/lib/youtubeVideoHistory";
import CreatorAvatar from "./CreatorAvatar";

const tallyOrder: Array<{ sentiment: OpinionSentiment; className: string }> = [
  { sentiment: "bullish", className: "text-positive" },
  { sentiment: "bearish", className: "text-negative" },
  { sentiment: "neutral", className: "text-muted-foreground" },
  { sentiment: "mixed", className: "text-warning" },
];

function thumbnailFor(opinion: VideoOpinionGroup["video"]) {
  const url =
    opinion.thumbnail_url ||
    (/^[\w-]{11}$/.test(opinion.video_id)
      ? `https://i.ytimg.com/vi/${opinion.video_id}/mqdefault.jpg`
      : "");
  if (!url) return "";
  try {
    const host = new URL(url).hostname;
    return host === "i.ytimg.com"
      ? `/api/image-proxy?url=${encodeURIComponent(url)}`
      : proxyImageUrl(url);
  } catch {
    return "";
  }
}

function Thumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative flex aspect-video w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground sm:w-[168px]">
      <PlayCircle className="h-5 w-5" />
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-150 group-hover/video:opacity-90"
        />
      )}
    </span>
  );
}

export default function VideoOpinionCard({
  group,
  t,
  onStock,
  showCreator = false,
  compact = false,
}: {
  group: VideoOpinionGroup;
  t: (key: string, params?: Record<string, string>) => string;
  onStock?: (ticker: string) => void;
  showCreator?: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const opinionsId = useId();
  const video = group.video;
  const title = video.video_title || t("youtubeOpinions.untitledVideo");
  const published = video.video_published_at || video.opinion_date || undefined;
  const creator = group.opinions[0];
  const collapsedRows = compact ? 2 : 3;
  const opinions = [...group.opinions].sort(
    (a, b) => Math.abs(b.direction_score) - Math.abs(a.direction_score),
  );
  const hidden = Math.max(0, opinions.length - collapsedRows);
  const shown = expanded ? opinions : opinions.slice(0, collapsedRows);
  const tally = tallyOrder
    .map((item) => ({
      ...item,
      count: opinions.filter((opinion) => opinion.sentiment === item.sentiment).length,
    }))
    .filter((item) => item.count > 0);

  const heading = (
    <span className="line-clamp-2 text-base font-semibold leading-6 tracking-[-0.01em]">
      {title}
    </span>
  );

  return (
    <article className="min-w-0 border-b border-border py-7 [overflow-wrap:anywhere] first:pt-4 last:border-0">
      {showCreator && creator && (
        <Link
          href={`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(creator.channel_id)}`}
          className="mb-3 flex w-fit max-w-full items-center gap-2 rounded-sm text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <CreatorAvatar name={creator.channel_title || creator.channel_id} avatarUrl={creator.channel_avatar_url} size="xs" />
          <span className="truncate">{creator.channel_title || creator.channel_id}</span>
        </Link>
      )}
      <header className="flex min-w-0 items-start gap-4 sm:gap-5">
        {!compact && (video.video_url ? (
          <a
            href={video.video_url}
            target="_blank"
            rel="noreferrer"
            tabIndex={-1}
            aria-hidden="true"
            className="group/video shrink-0"
          >
            <Thumbnail src={thumbnailFor(video)} />
          </a>
        ) : (
          <Thumbnail src={thumbnailFor(video)} />
        ))}
        <div className="min-w-0 flex-1 sm:pt-0.5">
          {video.video_url ? (
            <a
              href={video.video_url}
              target="_blank"
              rel="noreferrer"
              title={title}
              aria-label={title}
              className="rounded-sm hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {heading}
            </a>
          ) : (
            <h3 title={title}>{heading}</h3>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground tabular-nums">
            <time dateTime={published}>{formatOpinionDate(published, t("common.intlLocale"))}</time>
            {opinions.length > 0 ? (
              <span>{t("youtubeOpinions.videoStockCount", { count: String(opinions.length) })}</span>
            ) : (
              <span>{t("youtubeOpinions.untrackedVideo")}</span>
            )}
            {!compact && tally.map((item) => (
              <span key={item.sentiment} className={cn("font-semibold", item.className)}>
                {t(`youtubeOpinions.${item.sentiment}`)} {item.count}
              </span>
            ))}
          </p>
        </div>
      </header>

      {opinions.length > 0 && <ul id={opinionsId} className="mt-5 min-w-0">
        {shown.map((opinion) => {
          const confidence =
            opinion.confidence === null || opinion.confidence === undefined
              ? null
              : Math.round(opinion.confidence * 100);
          const summary = opinion.summary || opinion.thesis;
          return (
            <li key={opinion.id} className="border-t border-border first:border-t-0">
              <button
                type="button"
                onClick={() => onStock?.(opinion.ticker)}
                className={cn("group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary", !compact && "sm:-mx-3 sm:w-[calc(100%+1.5rem)] sm:grid-cols-[7rem_7.5rem_minmax(0,1fr)_auto] sm:items-start sm:rounded-xl sm:px-3")}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <CompanyLogo symbol={opinion.ticker} size="sm" />
                  <span className="truncate text-[15px] font-semibold">{opinion.ticker}</span>
                  <OpinionStrength value={opinion.direction_score} className={cn("ml-1", !compact && "sm:hidden")} />
                </span>
                <span className={cn("hidden h-6 items-center", !compact && "sm:flex")}>
                  <OpinionStrength value={opinion.direction_score} />
                </span>
                <span className={cn("col-span-2 row-start-2 text-sm leading-6 text-muted-foreground transition-colors duration-150 group-hover:text-foreground", !compact && "sm:col-span-1 sm:col-start-3 sm:row-start-1", compact && !expanded && "line-clamp-2")}>
                  {opinion.sentiment === "mixed" && (
                    <span className="mr-1.5 font-semibold text-warning">{t("youtubeOpinions.mixed")}</span>
                  )}
                  {summary}
                </span>
                <span
                  className={cn("col-start-2 row-start-1 flex items-center justify-end text-xs text-muted-foreground tabular-nums", !compact && "sm:col-start-4 sm:h-6")}
                  title={t("youtubeOpinions.confidence")}
                >
                  {confidence !== null && (
                    <>
                      <span className="sr-only">{t("youtubeOpinions.confidence")} </span>
                      {confidence}%
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>}

      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={opinionsId}
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:-ml-3"
        >
          {expanded ? t("youtubeOpinions.collapseVideoOpinions") : t("youtubeOpinions.showRemainingVideoOpinions", { count: String(hidden) })}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-150", expanded && "rotate-180")}
          />
        </button>
      )}
    </article>
  );
}
