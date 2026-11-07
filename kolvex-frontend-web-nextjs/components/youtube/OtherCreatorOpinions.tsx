"use client";

import { useEffect, useMemo, useState } from "react";
import { useCachedResource } from "@/hooks/useCachedResource";
import { Button } from "@/components/ui/button";
import { OpinionCardsSkeleton } from "@/components/youtube/OpinionSkeletons";
import {
  ListCard,
  ListEmptyState,
  ListLoadMore,
  ListRows,
  listFeedRowClass,
} from "@/components/ui/list-card";
import { useTranslation } from "@/lib/i18n";
import { getYouTubeStockDetail, type YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import OpinionCard from "./OpinionCard";

export default function OtherCreatorOpinions({
  ticker,
  currentCreator,
  onCreator,
}: {
  ticker: string;
  currentCreator: string;
  onCreator: (channelId: string) => void;
}) {
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(3);
  const resource = useCachedResource(
    `/api/youtube-opinions/stocks/${encodeURIComponent(ticker)}`,
    signal => getYouTubeStockDetail(ticker, {}, signal),
    { ttl: 60_000 },
  );
  const loading = resource.loading;
  const failed = Boolean(resource.error) && !resource.data;
  // The complete archive is shared with the stock workspace. Changing the
  // excluded creator only filters that snapshot; it does not fetch it again.
  const opinions = useMemo(() => {
    const latest = new Map<string, YouTubeOpinion>();
    const sorted = [...(resource.data?.opinions ?? [])].sort((a, b) =>
      b.opinion_date.localeCompare(a.opinion_date) ||
      (b.video_published_at || "").localeCompare(a.video_published_at || "") ||
      b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
    );
    for (const opinion of sorted) {
      if (opinion.channel_id !== currentCreator && !latest.has(opinion.channel_id)) {
        latest.set(opinion.channel_id, opinion);
      }
    }
    return [...latest.values()];
  }, [resource.data, currentCreator]);
  useEffect(() => setVisibleCount(3), [ticker, currentCreator]);

  return (
    <section className="mt-10 min-w-0" aria-labelledby="other-creator-opinions-heading">
      <header className="mb-3 min-w-0">
        <h2 id="other-creator-opinions-heading" className="text-lg font-semibold">
          {t("youtubeOpinions.otherCreatorOpinions")}
          {!loading && !failed && opinions.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              {opinions.length}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("youtubeOpinions.otherCreatorOpinionsHint", { ticker })}
        </p>
      </header>
      <ListCard>
        {loading ? (
          <OpinionCardsSkeleton label={t("common.loadingStatus")} />
        ) : failed ? (
          <ListEmptyState alert title={t("youtubeOpinions.otherCreatorOpinionsFailed")} action={
            <Button size="sm" variant="outline" onClick={resource.refresh}>
              {t("common.retry")}
            </Button>
          } />
        ) : opinions.length === 0 ? (
          <ListEmptyState title={t("youtubeOpinions.noOtherCreatorOpinions", { ticker })} />
        ) : (
          <>
            <ListRows id="other-creator-opinions-list" aria-label={t("youtubeOpinions.otherCreatorOpinions")}>
              {opinions.slice(0, visibleCount).map((opinion) => (
                <li key={opinion.id} className={listFeedRowClass}>
                  <OpinionCard opinion={opinion} t={t} showTicker={false} onCreator={onCreator} />
                </li>
              ))}
            </ListRows>
            {visibleCount < opinions.length && (
              <ListLoadMore
                aria-controls="other-creator-opinions-list"
                onClick={() => setVisibleCount((value) => value + 3)}
              >
                {t("youtubeOpinions.loadMoreCreators")}
              </ListLoadMore>
            )}
          </>
        )}
      </ListCard>
    </section>
  );
}
