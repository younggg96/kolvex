"use client";

import { useState } from "react";
import { ChevronDown, PlayCircle } from "lucide-react";
import CompanyLogo from "@/components/ui/company-logo";
import { cn, proxyImageUrl } from "@/lib/utils";
import type { OpinionSentiment, YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import OpinionStrength from "./OpinionStrength";

export type VideoOpinionGroup = {
  videoId: string;
  opinions: YouTubeOpinion[];
};

const collapsedRows = 3;
const tallyOrder: Array<{ sentiment: OpinionSentiment; className: string }> = [
  { sentiment: "bullish", className: "text-positive" },
  { sentiment: "bearish", className: "text-negative" },
  { sentiment: "neutral", className: "text-muted-foreground" },
  { sentiment: "mixed", className: "text-warning" },
];

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

/** First clause only. Full titles are long ticker lists; the link still carries the original. */
function shortTitle(title: string) {
  const clause = title.split(/[？?！!。｜|]/)[0]?.trim();
  return clause && clause.length >= 4 ? clause : title;
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

function thumbnailFor(opinion: YouTubeOpinion) {
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
}: {
  group: VideoOpinionGroup;
  t: (key: string, params?: Record<string, string>) => string;
  onStock?: (ticker: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const video = group.opinions[0];
  const title = video.video_title || t("youtubeOpinions.untitledVideo");
  const published = video.video_published_at || video.opinion_date;
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
    <span className="line-clamp-1 text-base font-semibold leading-6 tracking-[-0.01em]">
      {shortTitle(title)}
    </span>
  );

  return (
    <article className="min-w-0 border-b border-border py-7 [overflow-wrap:anywhere] first:pt-4 last:border-0">
      <header className="flex min-w-0 items-start gap-4 sm:gap-5">
        {video.video_url ? (
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
        )}
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
            <time dateTime={published}>{formatDate(published, t("common.intlLocale"))}</time>
            <span>{t("youtubeOpinions.videoStockCount", { count: String(opinions.length) })}</span>
            {tally.map((item) => (
              <span key={item.sentiment} className={cn("font-semibold", item.className)}>
                {t(`youtubeOpinions.${item.sentiment}`)} {item.count}
              </span>
            ))}
          </p>
        </div>
      </header>

      <ul className="mt-5 min-w-0">
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
                className="group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 text-left transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:-mx-3 sm:w-[calc(100%+1.5rem)] sm:grid-cols-[7rem_7.5rem_minmax(0,1fr)_auto] sm:items-start sm:rounded-xl sm:px-3"
              >
                <span className="flex min-w-0 items-center gap-2.5 sm:h-6">
                  <CompanyLogo symbol={opinion.ticker} size="xs" />
                  <span className="truncate text-[15px] font-semibold">{opinion.ticker}</span>
                  <OpinionStrength value={opinion.direction_score} className="ml-1 sm:hidden" />
                </span>
                <span className="hidden h-6 items-center sm:flex">
                  <OpinionStrength value={opinion.direction_score} />
                </span>
                <span className="col-span-2 row-start-2 max-w-[68ch] text-sm leading-6 text-muted-foreground transition-colors duration-150 group-hover:text-foreground sm:col-span-1 sm:col-start-3 sm:row-start-1">
                  {opinion.sentiment === "mixed" && (
                    <span className="mr-1.5 font-semibold text-warning">{t("youtubeOpinions.mixed")}</span>
                  )}
                  {summary}
                </span>
                <span
                  className="col-start-2 row-start-1 flex items-center justify-end text-xs text-muted-foreground tabular-nums sm:col-start-4 sm:h-6"
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
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:-ml-3"
        >
          {expanded ? t("youtubeOpinions.showFewerStocks") : t("youtubeOpinions.showMoreStocks")}
          {!expanded && (
            <span className="font-medium tabular-nums text-muted-foreground">{hidden}</span>
          )}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-150", expanded && "rotate-180")}
          />
        </button>
      )}
    </article>
  );
}
