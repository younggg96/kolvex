"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ContentLoading } from "@/components/ui/content-loading";
import { InfoTip } from "@/components/ui/info-tip";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDate } from "@/lib/opinionDates";
import {
  benchmarkChange,
  benchmarkPath,
  binLabel,
  histogramHeights,
  reviewFigure,
  segmentLabel,
  type OpinionReview as Review,
  binQuery,
  type ReviewHistogramBin,
  type ReviewSegment,
  type ReviewSentiment,
  type ReviewStats,
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

function Histogram({
  stats,
  selected,
  onSelect,
  t,
}: {
  stats: ReviewStats;
  selected: number | null;
  onSelect: (index: number | null) => void;
  t: T;
}) {
  const bins = stats.histogram ?? [];
  const heights = histogramHeights(bins);
  return (
    <figure className="mt-5 min-w-0">
      <figcaption className="text-xs text-muted-foreground">
        {t("youtubeOpinions.review.distribution")}
      </figcaption>
      <div
        className="mt-2 flex h-24 items-end gap-1"
        role="group"
        aria-label={t("youtubeOpinions.review.distribution")}
      >
        {bins.map((bin, index) => {
          const label = binLabel(bin, t);
          const below = bin.high !== null && bin.high <= 0;
          const active = selected === index;
          return (
            <button
              key={label}
              type="button"
              disabled={!bin.count}
              aria-pressed={active}
              aria-label={t("youtubeOpinions.review.binOpen", {
                range: label,
                count: String(bin.count),
              })}
              title={t("youtubeOpinions.review.binCount", {
                range: label,
                count: String(bin.count),
              })}
              onClick={() => onSelect(active ? null : index)}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
            >
              <span
                className={cn(
                  "block w-full rounded-t-sm transition-opacity",
                  below ? "bg-negative" : "bg-positive",
                  active ? "opacity-90" : "opacity-50 group-hover:group-enabled:opacity-70",
                )}
                style={{ height: `${Math.max(heights[index] * 100, bin.count ? 4 : 0)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground tabular-nums">
        <span>{binLabel(bins[0] ?? { low: null, high: -20, count: 0 }, t)}</span>
        <span>0%</span>
        <span>{binLabel(bins[bins.length - 1] ?? { low: 20, high: null, count: 0 }, t)}</span>
      </div>
    </figure>
  );
}

const LIST_STEP = 10;

/** The opinions behind one bar, each traceable to its video. Newest first. */
function BinOpinions({
  horizon,
  sentiment,
  bin,
  benchmark,
  t,
}: {
  horizon: number;
  sentiment: ReviewSentiment;
  bin: ReviewHistogramBin;
  benchmark: string;
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
  const label = binLabel(bin, t);
  return (
    <section className="mt-4 min-w-0 border-t border-border pt-3" aria-live="polite">
      <h4 className="text-xs font-medium text-muted-foreground tabular-nums">
        {t("youtubeOpinions.review.binOpinions", { range: label, count: String(bin.count) })}
      </h4>
      {!data ? (
        resource.loading ? (
          <div className="mt-3 space-y-2" aria-busy="true">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground" role="alert">
            {t("youtubeOpinions.review.binFailed")}
            <Button size="sm" variant="outline" onClick={resource.refresh}>
              {t("common.retry")}
            </Button>
          </div>
        )
      ) : data.opinions.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("youtubeOpinions.review.binEmpty")}</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-border">
            {data.opinions.slice(0, shown).map((item) => (
              <li
                key={item.id}
                className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm"
              >
                <Link
                  href={`/dashboard/youtube-opinions?tab=stocks&stock=${encodeURIComponent(item.ticker)}`}
                  className="font-semibold underline-offset-4 hover:underline"
                >
                  {item.ticker}
                </Link>
                {item.channel_id ? (
                  <Link
                    href={`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(item.channel_id)}`}
                    className="min-w-0 truncate text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {item.channel_title || item.channel_id}
                  </Link>
                ) : null}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatOpinionDate(item.published_at, locale)}
                </span>
                <span className="ml-auto flex items-baseline gap-3 text-xs">
                  <span>
                    {t("youtubeOpinions.review.vsBenchmark", { benchmark, value: "" })}
                    <Figure value={item.excess_return_pct} />
                  </span>
                  <span className="text-muted-foreground">
                    {t("youtubeOpinions.review.stockMove", { value: "" })}
                    <Figure value={item.return_pct} />
                  </span>
                  {item.video_url ? (
                    <a
                      href={item.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      {t("youtubeOpinions.review.watchVideo")}
                    </a>
                  ) : null}
                </span>
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
    </section>
  );
}

function SentimentCard({
  sentiment,
  stats,
  days,
  benchmark,
  minGroup,
  t,
}: {
  sentiment: ReviewSentiment;
  stats: ReviewStats;
  days: number;
  benchmark: string;
  minGroup: number;
  t: T;
}) {
  const title = t(`youtubeOpinions.review.${sentiment}Title`, { days: String(days) });
  const [selected, setSelected] = useState<number | null>(null);
  const bin = selected === null ? null : stats.histogram?.[selected];
  return (
    <ListCard className="min-w-0 p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        {t("youtubeOpinions.review.sample", { count: String(stats.n) })}
      </p>
      {!stats.enough || stats.mean_excess_pct === undefined ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("youtubeOpinions.review.notEnough", { min: String(minGroup) })}
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("youtubeOpinions.review.meanVs", { benchmark })}
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            <Figure value={stats.mean_excess_pct} />
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("youtubeOpinions.review.median")}
              </dt>
              <dd className="mt-0.5 font-medium">
                <Figure value={stats.median_excess_pct ?? 0} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("youtubeOpinions.review.beatShare", { benchmark })}
              </dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {stats.beat_share_pct}%
                {stats.beat_share_ci && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({stats.beat_share_ci[0]}%–{stats.beat_share_ci[1]}%)
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("youtubeOpinions.review.meanStock")}
              </dt>
              <dd className="mt-0.5 font-medium">
                <Figure value={stats.mean_return_pct ?? 0} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("youtubeOpinions.review.meanBenchmark", { benchmark })}
              </dt>
              <dd className="mt-0.5 font-medium">
                <Figure value={stats.mean_benchmark_pct ?? 0} />
              </dd>
            </div>
          </dl>
          <Histogram stats={stats} selected={selected} onSelect={setSelected} t={t} />
          {bin && (
            <BinOpinions
              key={`${days}:${selected}`}
              horizon={days}
              sentiment={sentiment}
              bin={bin}
              benchmark={benchmark}
              t={t}
            />
          )}
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
      <h2 id="review-market-heading" className="text-lg font-semibold">
        {t("youtubeOpinions.review.marketTitle", { benchmark: review.benchmark })}
      </h2>
      <ListCard className="mt-3 p-5">
        <p className="text-sm text-muted-foreground">
          {t("youtubeOpinions.review.marketSummary", {
            benchmark: review.benchmark,
            from: day(first),
            to: day(last),
          })}{" "}
          {change !== null && <Figure value={change} />}
        </p>
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="mt-4 h-40 w-full overflow-visible"
          role="img"
          aria-label={t("youtubeOpinions.review.marketTitle", { benchmark: review.benchmark })}
        >
          {weeks.map((week) => {
            const x = ((Date.parse(week.week) - Date.parse(first)) / span) * 100;
            const height = ((week.bullish + week.bearish) / maxWeek) * 12;
            return (
              <rect
                key={week.week}
                x={Math.min(Math.max(x, 0), 98.5)}
                y={40 - height}
                width={1.5}
                height={height}
                className="fill-muted-foreground/30"
              >
                <title>
                  {t("youtubeOpinions.review.weekCount", {
                    week: day(week.week),
                    bullish: String(week.bullish),
                    bearish: String(week.bearish),
                  })}
                </title>
              </rect>
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
        <p className="mt-3 text-xs text-muted-foreground">
          {t("youtubeOpinions.review.marketLegend")}
        </p>
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

function ReviewSkeleton({ label }: { label: string }) {
  return (
    <ContentLoading label={label} className="min-h-0">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
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

          {review ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl
                  label={t("youtubeOpinions.review.horizonLabel")}
                  size="sm"
                  value={days}
                  onChange={setDays}
                  options={review.horizons.map((value) => ({
                    value: String(value),
                    label: t("youtubeOpinions.review.horizon", { days: String(value) }),
                  }))}
                />
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
                      days={Number(days)}
                      benchmark={review.benchmark}
                      minGroup={review.min_group}
                      t={t}
                    />
                  ))}
                </div>
              )}

              <MarketContext review={review} t={t} />

              {horizon && (
                <section className="mt-10 min-w-0" aria-labelledby="review-segments-heading">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="review-segments-heading" className="text-lg font-semibold">
                      {t("youtubeOpinions.review.segmentsTitle", { days })}
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

              <footer className="mt-10 space-y-1 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                <p className="tabular-nums">
                  {t("youtubeOpinions.review.coverage", {
                    opinions: String(review.counts.opinions),
                    kept: String(review.counts.after_dedupe),
                    bullish: String(review.counts.bullish),
                    bearish: String(review.counts.bearish),
                    neutral: String(review.counts.neutral_or_mixed),
                    noPrice: String(review.counts.no_price_data),
                  })}
                </p>
                <p>
                  {t("youtubeOpinions.review.asOf", { date: day(review.as_of) })}{" "}
                  {t("youtubeOpinions.review.disclaimer")}
                </p>
              </footer>
            </>
          ) : resource.loading || building ? (
            <>
              {building && (
                <p className="mb-4 text-sm text-muted-foreground" role="status">
                  {t("youtubeOpinions.review.building")}
                </p>
              )}
              <ReviewSkeleton label={t("common.loadingStatus")} />
            </>
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
