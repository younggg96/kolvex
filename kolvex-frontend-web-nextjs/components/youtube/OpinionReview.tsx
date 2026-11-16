"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { marketStockHref } from "@/lib/stockLinks";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ContentLoading } from "@/components/ui/content-loading";
import { InfoTip } from "@/components/ui/info-tip";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import CompanyLogo from "@/components/ui/company-logo";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import CreatorOpinionsReview from "@/components/youtube/CreatorOpinionsReview";
import {
  DirectionTile,
  SentimentBadge,
  Tile,
  toneOf,
  VideoLink,
} from "@/components/youtube/reviewParts";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDate } from "@/lib/opinionDates";
import { signedPercent } from "@/lib/opinionOutcome";
import {
  beatCount,
  benchmarkChange,
  benchmarkPath,
  binLabel,
  binQuery,
  histogramHeights,
  horizonLabel,
  reviewFigure,
  segmentLabel,
  zeroPosition,
  type OpinionReview as Review,
  type ReviewHistogramBin,
  type ReviewSegment,
  type ReviewSentiment,
  type ReviewStats,
  type ReviewView,
  readReviewRoute,
  reviewRouteSearch,
} from "@/lib/opinionReview";
import { cn } from "@/lib/utils";
import { getYouTubeOpinionReview, getYouTubeReviewBin } from "@/lib/youtubeOpinionsApi";

const toneClass = { positive: "text-positive", negative: "text-negative", flat: "text-foreground" };
const EXPLORER = "/dashboard/youtube-opinions";

type T = (key: string, params?: Record<string, string>) => string;

function Figure({ value }: { value: number }) {
  const figure = reviewFigure(value);
  return <span className={cn("tabular-nums", toneClass[figure.tone])}>{figure.text}</span>;
}

type Selection = { sentiment: ReviewSentiment; index: number };

/** Bins at or below 0% trailed the market; the rest beat it. Matches zeroPosition. */
function isWorseBin(bin: ReviewHistogramBin) {
  return bin.high !== null && bin.high <= 0;
}

/** One labelled move drawn from a centre line: left is down, right is up. */
function MoveRow({ label, value, scale }: { label: string; value: number; scale: number }) {
  const width = Math.min((Math.abs(value) / scale) * 50, 50);
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="relative h-2.5" aria-hidden="true">
        <span
          className="absolute inset-y-0 rounded-sm bg-foreground/35"
          style={
            value < 0 ? { right: "50%", width: `${width}%` } : { left: "50%", width: `${width}%` }
          }
        />
        <span className="absolute -inset-y-1 left-1/2 border-l border-foreground/40" />
      </span>
      <span className="text-right font-medium tabular-nums">{signedPercent(value)}</span>
    </div>
  );
}

function Histogram({
  sentiment,
  stats,
  selected,
  onSelect,
  t,
}: {
  sentiment: ReviewSentiment;
  stats: ReviewStats;
  selected: number | null;
  onSelect: (selection: Selection | null) => void;
  t: T;
}) {
  const bins = stats.histogram ?? [];
  const heights = histogramHeights(bins);
  const zero = zeroPosition(bins) * 100;
  return (
    <figure className="mt-6 min-w-0">
      <figcaption className="flex items-center gap-1 text-xs text-muted-foreground">
        {t("youtubeOpinions.review.distribution")}
        <InfoTip label={t("youtubeOpinions.review.distribution")}>
          {t("youtubeOpinions.review.distributionTip")}
        </InfoTip>
      </figcaption>
      <div
        className="relative mt-2 flex h-28 items-end gap-1"
        role="group"
        aria-label={t("youtubeOpinions.review.distribution")}
      >
        {bins.map((bin, index) => {
          const label = binLabel(bin, t);
          const active = selected === index;
          const worse = isWorseBin(bin);
          const dimmed = selected !== null && !active;
          return (
            <button
              key={`${bin.low}:${bin.high}`}
              type="button"
              disabled={!bin.count}
              aria-pressed={active}
              aria-label={t("youtubeOpinions.review.binOpen", {
                range: label,
                count: String(bin.count),
              })}
              title={`${label} · ${t("youtubeOpinions.review.binCount", { count: String(bin.count) })}`}
              onClick={() => onSelect(active ? null : { sentiment, index })}
              className="group flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end gap-0.5 rounded-t-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
            >
              <span
                className={cn(
                  "text-[0.6875rem] tabular-nums",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {bin.count}
              </span>
              <span
                className={cn(
                  "block w-full rounded-t-sm transition-[background-color,box-shadow]",
                  worse ? "bg-negative-fill" : "bg-positive-fill",
                  active
                    ? "ring-2 ring-foreground ring-offset-1 ring-offset-card"
                    : dimmed
                      ? "opacity-30 group-hover:group-enabled:opacity-70"
                      : "opacity-60 group-hover:group-enabled:opacity-100",
                )}
                style={{ height: `${Math.max(heights[index] * 78, bin.count ? 3 : 0)}%` }}
              />
            </button>
          );
        })}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 border-l border-dashed border-foreground/40"
          style={{ left: `${zero}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-[0.6875rem]">
        <span className="font-medium text-negative">← {t("youtubeOpinions.review.axisWorse")}</span>
        <span className="text-muted-foreground">{t("youtubeOpinions.review.axisSame")}</span>
        <span className="text-right font-medium text-positive">
          {t("youtubeOpinions.review.axisBetter")} →
        </span>
      </div>
    </figure>
  );
}

const LIST_STEP = 10;

/** The opinions behind one bar, each with its stock, the market and the gap. Newest first. */
function BinOpinions({
  horizon,
  sentiment,
  bin,
  onClose,
  onCreator,
  t,
}: {
  horizon: number;
  sentiment: ReviewSentiment;
  bin: ReviewHistogramBin;
  onClose: () => void;
  /** Opens that creator's own list in the review page's creator view. */
  onCreator: (channelId: string) => void;
  t: T;
}) {
  const { locale } = useTranslation();
  const [shown, setShown] = useState(LIST_STEP);
  const query = binQuery(horizon, sentiment, bin);
  const resource = useCachedResource(
    `/api/youtube-opinions/review/opinions?${query}`,
    (signal) => getYouTubeReviewBin(query, signal),
    { ttl: 10 * 60_000 },
  );
  const data = resource.data;
  const cardRef = useRef<HTMLDivElement>(null);
  // The list opens below both cards, out of view on most screens: bring it into view.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);
  return (
    <ListCard ref={cardRef} className="mt-4 min-w-0 scroll-mt-4 p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold tabular-nums">
          <SentimentBadge sentiment={sentiment} t={t} />
          <span className="rounded bg-muted px-1.5 py-px text-[0.6875rem] font-medium">
            {horizonLabel(horizon, t)}
          </span>
          <span className="rounded bg-muted px-1.5 py-px text-[0.6875rem] font-medium">
            {t("youtubeOpinions.review.binRangeBadge", { range: binLabel(bin, t) })}
          </span>
          <span className="ml-1">
            {t("youtubeOpinions.review.binCount", { count: String(bin.count) })}
          </span>
        </h3>
        <Button size="sm" variant="outline" onClick={onClose}>
          {t("youtubeOpinions.review.closeList")}
        </Button>
      </div>
      {!data ? (
        resource.loading ? (
          <div className="mt-3 space-y-2" aria-busy="true">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground" role="alert">
            {t("youtubeOpinions.review.binFailed")}
            <Button size="sm" variant="outline" onClick={resource.refresh}>
              {t("common.retry")}
            </Button>
          </div>
        )
      ) : data.opinions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("youtubeOpinions.review.binEmpty")}</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-border">
            {data.opinions.slice(0, shown).map((item) => (
              <li key={item.id} className="min-w-0 py-3">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <CompanyLogo symbol={item.ticker} size="xs" />
                  <Link
                    href={marketStockHref(item.ticker)}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {item.ticker}
                  </Link>
                  {item.channel_id ? (
                    <button
                      type="button"
                      onClick={() => onCreator(item.channel_id!)}
                      className="flex min-w-0 items-center gap-1.5 text-muted-foreground underline-offset-4 hover:underline"
                    >
                      <CreatorAvatar
                        name={item.channel_title || item.channel_id}
                        avatarUrl={item.channel_avatar_url}
                        size="xs"
                      />
                      <span className="truncate">{item.channel_title || item.channel_id}</span>
                    </button>
                  ) : null}
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatOpinionDate(item.published_at, locale)}
                  </span>
                  <VideoLink url={item.video_url} t={t} />
                </div>
                {item.ticker === data.benchmark ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Tile
                      label={t("youtubeOpinions.review.cellStock", { ticker: item.ticker })}
                      value={signedPercent(item.return_pct)}
                    />
                    <DirectionTile
                      sentiment={item.sentiment}
                      returnPct={item.return_pct}
                      benchmark={data.benchmark}
                      t={t}
                    />
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Tile
                      label={t("youtubeOpinions.review.cellStock", { ticker: item.ticker })}
                      value={signedPercent(item.return_pct)}
                    />
                    <Tile
                      label={t("youtubeOpinions.review.cellMarket", { benchmark: data.benchmark })}
                      value={signedPercent(item.benchmark_return_pct)}
                    />
                    <Tile
                      label={t("youtubeOpinions.review.cellExcess")}
                      value={signedPercent(item.excess_return_pct)}
                      tone={toneOf(item.excess_return_pct)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {shown < data.opinions.length ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setShown((value) => value + LIST_STEP)}
            >
              {t("youtubeOpinions.review.showMore")}
            </Button>
          ) : data.total > data.opinions.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("youtubeOpinions.review.binCapped", { shown: String(data.opinions.length) })}
            </p>
          ) : null}
        </>
      )}
    </ListCard>
  );
}

function SentimentCard({
  sentiment,
  stats,
  benchmark,
  minGroup,
  selected,
  onSelect,
  t,
}: {
  sentiment: ReviewSentiment;
  stats: ReviewStats;
  benchmark: string;
  minGroup: number;
  selected: number | null;
  onSelect: (selection: Selection | null) => void;
  t: T;
}) {
  const ready =
    stats.enough &&
    stats.mean_excess_pct !== undefined &&
    stats.mean_return_pct !== undefined &&
    stats.mean_benchmark_pct !== undefined;
  const beat = beatCount(stats);
  return (
    <ListCard className="min-w-0 p-5">
      <p className="text-xs text-muted-foreground tabular-nums">
        {t(`youtubeOpinions.review.${sentiment}Card`, { count: String(stats.n) })}
      </p>
      {!ready ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("youtubeOpinions.review.notEnough", { min: String(minGroup) })}
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            {t("youtubeOpinions.review.excessLabel")}
            {stats.median_excess_pct !== undefined && stats.beat_share_ci && (
              <InfoTip label={t("youtubeOpinions.review.excessLabel")}>
                {t("youtubeOpinions.review.excessTip", {
                  benchmark,
                  median: signedPercent(stats.median_excess_pct),
                  low: String(stats.beat_share_ci[0]),
                  high: String(stats.beat_share_ci[1]),
                })}
              </InfoTip>
            )}
          </div>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight">
            <Figure value={stats.mean_excess_pct!} />
          </p>
          <div className="mt-4 space-y-2">
            {(() => {
              const scale = Math.max(
                5,
                Math.abs(stats.mean_return_pct!),
                Math.abs(stats.mean_benchmark_pct!),
              );
              return (
                <>
                  <MoveRow
                    label={t("youtubeOpinions.review.stockAverage")}
                    value={stats.mean_return_pct!}
                    scale={scale}
                  />
                  <MoveRow
                    label={t("youtubeOpinions.review.marketAverage", { benchmark })}
                    value={stats.mean_benchmark_pct!}
                    scale={scale}
                  />
                </>
              );
            })()}
          </div>
          {beat !== null && (
            <div className="mt-4 flex items-center gap-1 text-sm tabular-nums">
              {t("youtubeOpinions.review.beatLine", {
                benchmark,
                n: String(stats.n),
                beat: String(beat),
                share: String(Math.round(stats.beat_share_pct ?? 0)),
              })}
            </div>
          )}
          <Histogram
            sentiment={sentiment}
            stats={stats}
            selected={selected}
            onSelect={onSelect}
            t={t}
          />
        </>
      )}
    </ListCard>
  );
}

function MarketContext({ review, t }: { review: Review; t: T }) {
  const { locale } = useTranslation();
  const day = (value: string) => formatOpinionDate(value, locale);
  const points = review.market.benchmark;
  const change = benchmarkChange(points);
  const weeks = review.market.weekly_opinions;
  const maxWeek = Math.max(1, ...weeks.map((week) => week.bullish + week.bearish));
  if (points.length < 2) return null;
  const first = points[0].date;
  const last = points[points.length - 1].date;
  const span = Date.parse(last) - Date.parse(first) || 1;
  return (
    <section className="mt-10 min-w-0" aria-labelledby="review-market-heading">
      <div className="flex items-center gap-1">
        <h2 id="review-market-heading" className="text-lg font-semibold">
          {t("youtubeOpinions.review.marketTitle", { benchmark: review.benchmark })}
        </h2>
        <InfoTip label={t("youtubeOpinions.review.marketTitle", { benchmark: review.benchmark })}>
          {t("youtubeOpinions.review.marketTip", { benchmark: review.benchmark })}
        </InfoTip>
      </div>
      <ListCard className="mt-3 p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {review.benchmark} {change !== null && <Figure value={change} />}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-foreground" aria-hidden="true" />
            {t("youtubeOpinions.review.legendLine", { benchmark: review.benchmark })}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-positive-fill/60" aria-hidden="true" />
            {t("youtubeOpinions.review.legendBullish")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-negative-fill/60" aria-hidden="true" />
            {t("youtubeOpinions.review.legendBearish")}
          </span>
        </div>
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="mt-4 h-40 w-full overflow-visible"
          role="img"
          aria-label={t("youtubeOpinions.review.marketTitle", { benchmark: review.benchmark })}
        >
          {weeks.map((week) => {
            const x = ((Date.parse(week.week) - Date.parse(first)) / span) * 100;
            const bull = (week.bullish / maxWeek) * 12;
            const bear = (week.bearish / maxWeek) * 12;
            const left = Math.min(Math.max(x, 0), 98.5);
            return (
              <g key={week.week}>
                <title>
                  {t("youtubeOpinions.review.weekCount", {
                    week: day(week.week),
                    bullish: String(week.bullish),
                    bearish: String(week.bearish),
                  })}
                </title>
                <rect
                  x={left}
                  y={40 - bull}
                  width={1.5}
                  height={bull}
                  className="fill-positive-fill/60"
                />
                <rect
                  x={left}
                  y={40 - bull - bear}
                  width={1.5}
                  height={bear}
                  className="fill-negative-fill/60"
                />
              </g>
            );
          })}
          <polyline
            points={benchmarkPath(points, 100, 26)}
            fill="none"
            vectorEffect="non-scaling-stroke"
            className="stroke-foreground"
            strokeWidth={1.5}
          />
        </svg>
        <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground tabular-nums">
          <span>{day(first)}</span>
          <span>{day(last)}</span>
        </div>
      </ListCard>
    </section>
  );
}

function SegmentTable({
  title,
  dimension,
  segments,
  t,
}: {
  title: string;
  dimension: "confidence" | "strength";
  segments: ReviewSegment[];
  t: T;
}) {
  if (!segments.length) return null;
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1.5 font-normal">{t("youtubeOpinions.review.group")}</th>
            <th className="py-1.5 text-right font-normal">{t("youtubeOpinions.review.count")}</th>
            <th className="py-1.5 text-right font-normal">
              {t("youtubeOpinions.review.meanShort")}
            </th>
            <th className="py-1.5 text-right font-normal">
              {t("youtubeOpinions.review.beatShort")}
            </th>
          </tr>
        </thead>
        <tbody>
          {segments.map((segment) => (
            <tr
              key={`${segment.low}-${segment.high}-${segment.unknown}`}
              className="border-t border-border"
            >
              <td className="py-2">{segmentLabel(segment, dimension, t)}</td>
              <td className="py-2 text-right tabular-nums">{segment.n}</td>
              {segment.enough && segment.mean_excess_pct !== undefined ? (
                <>
                  <td className="py-2 text-right">
                    <Figure value={segment.mean_excess_pct} />
                  </td>
                  <td className="py-2 text-right tabular-nums">{segment.beat_share_pct}%</td>
                </>
              ) : (
                <td colSpan={2} className="py-2 text-right text-xs text-muted-foreground">
                  {t("youtubeOpinions.review.tooFew")}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SKELETON_BARS = [0.15, 0.12, 0.25, 0.45, 0.8, 1, 0.35, 0.1, 0.06, 0.04];

/** Mirrors the loaded page: horizon control, two sentiment cards, then the SPY chart. */
function ReviewSkeleton({ label }: { label: string }) {
  return (
    <ContentLoading label={label} className="min-h-0">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-32 rounded-[var(--radius-control)]" />
        <Skeleton className="h-3 w-72 max-w-full rounded-full" />
      </div>
      <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
        {[0, 1].map((card) => (
          <ListCard key={card} className="min-w-0 p-5">
            <Skeleton className="h-3 w-32 rounded-full" />
            <Skeleton className="mt-2 h-6 w-3/4 rounded-md" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-4 w-full rounded-full" />
            </div>
            <Skeleton className="mt-4 h-4 w-1/2 rounded-full" />
            <div className="mt-6">
              <Skeleton className="h-3 w-2/3 rounded-full" />
              <div className="mt-2 flex h-28 items-end gap-1">
                {SKELETON_BARS.map((height, index) => (
                  <Skeleton
                    key={index}
                    className="flex-1 rounded-b-none rounded-t-sm"
                    style={{ height: `${Math.max(height * 78, 3)}%` }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between">
                <Skeleton className="h-3 w-14 rounded-full" />
                <Skeleton className="h-3 w-14 rounded-full" />
                <Skeleton className="h-3 w-14 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-9 w-full rounded-lg" />
            </div>
          </ListCard>
        ))}
      </div>
      <div className="mt-10 min-w-0">
        <Skeleton className="h-6 w-36 rounded-md" />
        <ListCard className="mt-3 p-5">
          <Skeleton className="h-4 w-64 max-w-full rounded-full" />
          <Skeleton className="mt-4 h-40 w-full rounded-lg" />
        </ListCard>
      </div>
    </ContentLoading>
  );
}

export default function OpinionReview() {
  const { t, locale } = useTranslation();
  const day = (value: string) => formatOpinionDate(value, locale);
  const router = useRouter();
  const [days, setDays] = useState("20");
  const [sentiment, setSentiment] = useState<ReviewSentiment>("bullish");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [view, setView] = useState<ReviewView>("all");
  const [creator, setCreator] = useState<string | null>(null);
  // ?view=creators&creator=<id> makes a creator's list shareable; read once on mount.
  useEffect(() => {
    const route = readReviewRoute(window.location.search);
    setView(route.view);
    setCreator(route.creator);
  }, []);
  const showView = (next: ReviewView, channelId: string | null = creator) => {
    setView(next);
    setCreator(channelId);
    const url = new URL(window.location.href);
    url.search = reviewRouteSearch(next, channelId);
    window.history.replaceState(null, "", url);
    if (next === "creators") window.scrollTo({ top: 0 });
  };
  const openCreator = (channelId: string) => showView("creators", channelId);
  const changeDays = (value: string) => {
    setDays(value);
    setSelection(null);
  };
  const resource = useCachedResource("/api/youtube-opinions/review", getYouTubeOpinionReview, {
    ttl: 10 * 60_000,
  });
  const review = resource.data;
  const error = resource.error as (Error & { status?: number }) | null;
  const building = !review && error?.status === 503 && error.message === "building";
  const { refresh } = resource;
  // The first snapshot takes a few seconds to build on the server; ask again until it is ready.
  useEffect(() => {
    if (!building) return;
    const timer = window.setTimeout(refresh, 5000);
    return () => window.clearTimeout(timer);
  }, [building, refresh, error]);

  const switcher = (
    <SegmentedControl
      label={t("youtubeOpinions.browseBy")}
      semantics="nav"
      className="align-middle md:gap-1"
      size="sm"
      itemClassName="md:min-h-9 md:px-4 md:text-sm"
      value="review"
      onChange={(tab) => {
        if (tab !== "review") router.push(`${EXPLORER}?tab=${tab}`);
      }}
      options={[
        { value: "stocks", label: t("youtubeOpinions.byStock") },
        { value: "creators", label: t("youtubeOpinions.byCreator") },
        { value: "review", label: t("youtubeOpinions.review.tab") },
      ]}
    />
  );

  const horizon = review?.groups[days];
  const selectedBin = selection
    ? horizon?.[selection.sentiment].overall.histogram?.[selection.index]
    : undefined;
  return (
    <DashboardLayout title={t("youtubeOpinions.title")}>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full min-w-0 max-w-[100rem] px-[16px] pb-10 pt-[12px] md:px-8 md:pt-7">
          <header className="mb-6 flex min-h-14 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              <h2 className="text-xl font-semibold leading-tight tracking-[-0.02em] md:text-[1.75rem]">
                {t("youtubeOpinions.review.title")}
              </h2>
              <InfoTip label={t("youtubeOpinions.review.howLabel")}>
                {t("youtubeOpinions.review.how", {
                  benchmark: review?.benchmark ?? "SPY",
                  min: String(review?.min_group ?? 30),
                })}
              </InfoTip>
            </div>
            {switcher}
          </header>

          <SegmentedControl
            label={t("youtubeOpinions.review.viewLabel")}
            size="sm"
            className="mb-4"
            value={view}
            onChange={(next) => showView(next)}
            options={[
              { value: "all", label: t("youtubeOpinions.review.viewAll") },
              { value: "creators", label: t("youtubeOpinions.review.viewCreator") },
            ]}
          />

          {view === "creators" ? (
            <CreatorOpinionsReview
              channelId={creator}
              onChannel={(channelId) => showView("creators", channelId)}
            />
          ) : review ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl
                  label={t("youtubeOpinions.review.horizonLabel")}
                  size="sm"
                  value={days}
                  onChange={changeDays}
                  options={review.horizons.map((value) => ({
                    value: String(value),
                    label: horizonLabel(value, t),
                  }))}
                />
                <InfoTip label={t("youtubeOpinions.review.horizonLabel")}>
                  {t("youtubeOpinions.review.horizonTip")}
                </InfoTip>
                {review.refreshing && (
                  <span className="text-xs text-muted-foreground">
                    {t("youtubeOpinions.review.refreshing")}
                  </span>
                )}
              </div>

              {horizon && (
                <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
                  {(["bullish", "bearish"] as const).map((key) => (
                    <SentimentCard
                      key={`${key}:${days}`}
                      sentiment={key}
                      stats={horizon[key].overall}
                      benchmark={review.benchmark}
                      minGroup={review.min_group}
                      selected={selection?.sentiment === key ? selection.index : null}
                      onSelect={setSelection}
                      t={t}
                    />
                  ))}
                </div>
              )}
              {horizon && selectedBin && selection && (
                <BinOpinions
                  key={`${days}:${selection.sentiment}:${selection.index}`}
                  horizon={Number(days)}
                  sentiment={selection.sentiment}
                  bin={selectedBin}
                  onClose={() => setSelection(null)}
                  onCreator={openCreator}
                  t={t}
                />
              )}

              <MarketContext review={review} t={t} />

              {horizon && (
                <section className="mt-10 min-w-0" aria-labelledby="review-segments-heading">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="review-segments-heading" className="text-lg font-semibold">
                      {t("youtubeOpinions.review.segmentsTitle", {
                        days: horizonLabel(Number(days), t),
                      })}
                    </h2>
                    <SegmentedControl
                      label={t("youtubeOpinions.review.sentimentLabel")}
                      size="sm"
                      value={sentiment}
                      onChange={setSentiment}
                      options={[
                        { value: "bullish", label: t("youtubeOpinions.review.bullish") },
                        { value: "bearish", label: t("youtubeOpinions.review.bearish") },
                      ]}
                    />
                  </div>
                  <ListCard className="mt-3 grid min-w-0 gap-8 p-5 md:grid-cols-2">
                    <SegmentTable
                      title={t("youtubeOpinions.review.byConfidence")}
                      dimension="confidence"
                      segments={horizon[sentiment].confidence}
                      t={t}
                    />
                    <SegmentTable
                      title={t("youtubeOpinions.review.byStrength")}
                      dimension="strength"
                      segments={horizon[sentiment].strength}
                      t={t}
                    />
                  </ListCard>
                </section>
              )}

              <footer className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                <span className="flex items-center gap-1 tabular-nums">
                  {t("youtubeOpinions.review.coverageShort", {
                    kept: String(review.counts.after_dedupe),
                    bullish: String(review.counts.bullish),
                    bearish: String(review.counts.bearish),
                  })}
                  <InfoTip label={t("youtubeOpinions.review.coverageLabel")}>
                    {t("youtubeOpinions.review.coverage", {
                      opinions: String(review.counts.opinions),
                      kept: String(review.counts.after_dedupe),
                      bullish: String(review.counts.bullish),
                      bearish: String(review.counts.bearish),
                      neutral: String(review.counts.neutral_or_mixed),
                      onBenchmark: String(review.counts.on_benchmark ?? 0),
                      benchmark: review.benchmark,
                      noPrice: String(review.counts.no_price_data),
                    })}
                  </InfoTip>
                </span>
                <span>· {t("youtubeOpinions.review.asOf", { date: day(review.as_of) })}</span>
                <span>· {t("youtubeOpinions.review.disclaimer")}</span>
              </footer>
            </>
          ) : resource.loading || building ? (
            <ReviewSkeleton
              label={t(building ? "youtubeOpinions.review.building" : "common.loadingStatus")}
            />
          ) : (
            <ListCard>
              <ListEmptyState
                alert
                title={t("youtubeOpinions.review.failed")}
                action={
                  <Button size="sm" variant="outline" onClick={resource.refresh}>
                    {t("common.retry")}
                  </Button>
                }
              />
            </ListCard>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
