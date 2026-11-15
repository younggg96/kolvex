"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { ListCard } from "@/components/ui/list-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDate } from "@/lib/opinionDates";
import { reviewFigure, type CreatorHalf, type CreatorReviewGroup } from "@/lib/opinionReview";
import { cn } from "@/lib/utils";
import { getYouTubeCreatorReview } from "@/lib/youtubeOpinionsApi";

const toneClass = { positive: "text-positive", negative: "text-negative", flat: "text-foreground" };
const REVIEW_PAGE = "/dashboard/youtube-opinions/review";

function Figure({ value }: { value: number }) {
  const figure = reviewFigure(value);
  return <span className={cn("tabular-nums", toneClass[figure.tone])}>{figure.text}</span>;
}

function Half({ label, half, minHalf }: { label: string; half: CreatorHalf; minHalf: number }) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">
        {half.enough && half.mean_excess_pct !== undefined ? (
          <>
            <Figure value={half.mean_excess_pct} />
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              {t("youtubeOpinions.review.sample", { count: String(half.n) })}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("youtubeOpinions.review.halfTooFew", { min: String(minHalf) })}
          </span>
        )}
      </dd>
    </div>
  );
}

function SentimentBlock({
  title,
  group,
  benchmark,
  minGroup,
  minHalf,
  split,
}: {
  title: string;
  group: CreatorReviewGroup;
  benchmark: string;
  minGroup: number;
  minHalf: number;
  split: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h4 className="text-sm font-medium">{title}</h4>
      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
        {t("youtubeOpinions.review.sample", { count: String(group.n) })}
      </p>
      {group.enough && group.mean_excess_pct !== undefined ? (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("youtubeOpinions.review.meanVs", { benchmark })}
          </p>
          <p className="text-2xl font-semibold tracking-tight">
            <Figure value={group.mean_excess_pct} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {t("youtubeOpinions.review.beatShare", { benchmark })} {group.beat_share_pct}%
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("youtubeOpinions.review.halvesLabel", { date: split })}
          </p>
          <dl className="mt-1 grid grid-cols-2 gap-3">
            <Half label={t("youtubeOpinions.review.early")} half={group.early} minHalf={minHalf} />
            <Half label={t("youtubeOpinions.review.late")} half={group.late} minHalf={minHalf} />
          </dl>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("youtubeOpinions.review.notEnough", { min: String(minGroup) })}
        </p>
      )}
    </div>
  );
}

/** A creator's own price-after-opinion card. Only on their page; never compared with others. */
export default function CreatorReviewCard({
  channelId,
  showSeeAll = true,
}: {
  channelId: string;
  /** Off on the review page itself, where the link would point back to the same page. */
  showSeeAll?: boolean;
}) {
  const { t, locale } = useTranslation();
  const [days, setDays] = useState("20");
  const resource = useCachedResource(
    `/api/youtube-opinions/creators/${encodeURIComponent(channelId)}/review`,
    (signal) => getYouTubeCreatorReview(channelId, signal),
    { ttl: 10 * 60_000 },
  );
  const card = resource.data;
  const benchmark = card?.benchmark ?? "SPY";

  const heading = (
    <div className="mb-3 flex min-w-0 items-center gap-1">
      <h2 className="text-base font-semibold">{t("youtubeOpinions.review.creatorTitle")}</h2>
      <InfoTip label={t("youtubeOpinions.review.creatorHowLabel")}>
        {t("youtubeOpinions.review.creatorHow", {
          benchmark,
          min: String(card?.min_group ?? 30),
          minDays: String(card?.min_span_days ?? 90),
        })}
      </InfoTip>
    </div>
  );

  // Not built yet or failed: the card stays out of the way rather than showing a fake figure.
  if (!card) {
    if (resource.loading) {
      return (
        <section className="min-w-0" aria-busy="true">
          {heading}
          <Skeleton className="h-28 rounded-2xl" />
        </section>
      );
    }
    const status = (resource.error as { status?: number } | null)?.status;
    return status === 503 ? null : (
      <section className="min-w-0">
        {heading}
        <ListCard className="p-4">
          <p className="text-sm text-muted-foreground" role="alert">
            {t("youtubeOpinions.review.creatorFailed")}
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={resource.refresh}>
            {t("common.retry")}
          </Button>
        </ListCard>
      </section>
    );
  }

  const horizon = card.groups?.[days];
  const split = card.split_dates?.[days];
  return (
    <section className="min-w-0" aria-label={t("youtubeOpinions.review.creatorTitle")}>
      {heading}
      <ListCard className="p-4">
        {!card.enough || !horizon || !split ? (
          <>
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("youtubeOpinions.review.creatorNotEnough", {
                count: String(card.counted),
                days: String(card.span_days),
                min: String(card.min_group),
                minDays: String(card.min_span_days),
              })}
            </p>
            {showSeeAll && (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href={REVIEW_PAGE}>{t("youtubeOpinions.review.seeAll")}</Link>
              </Button>
            )}
          </>
        ) : (
          <>
            <SegmentedControl
              label={t("youtubeOpinions.review.horizonLabel")}
              size="sm"
              value={days}
              onChange={setDays}
              options={card.horizons.map((value) => ({
                value: String(value),
                label: t("youtubeOpinions.review.horizon", { days: String(value) }),
              }))}
            />
            <div className="mt-4 space-y-4">
              {(["bullish", "bearish"] as const).map((sentiment) => (
                <SentimentBlock
                  key={sentiment}
                  title={t(`youtubeOpinions.review.${sentiment}Title`, { days })}
                  group={horizon[sentiment]}
                  benchmark={benchmark}
                  minGroup={card.min_group}
                  minHalf={card.min_half}
                  split={formatOpinionDate(split, locale)}
                />
              ))}
            </div>
          </>
        )}
      </ListCard>
    </section>
  );
}
