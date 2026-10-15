"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [opinions, setOpinions] = useState<YouTubeOpinion[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [visibleCount, setVisibleCount] = useState(3);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setOpinions([]);
    setVisibleCount(3);

    getYouTubeStockDetail(ticker, {}, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        // The stock endpoint supplies the complete archive; take each creator's
        // latest call, even when one prolific creator dominates recent history.
        const latest = new Map<string, YouTubeOpinion>();
        const sorted = [...result.opinions].sort((a, b) =>
          b.opinion_date.localeCompare(a.opinion_date) ||
          (b.video_published_at || "").localeCompare(a.video_published_at || "") ||
          b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
        );
        for (const opinion of sorted) {
          if (opinion.channel_id !== currentCreator && !latest.has(opinion.channel_id)) {
            latest.set(opinion.channel_id, opinion);
          }
        }
        setOpinions([...latest.values()]);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [ticker, currentCreator, revision]);

  return (
    <section className="mt-10 min-w-0" aria-labelledby="other-creator-opinions-heading">
      <div className="border-b border-border pb-3">
        <h2 id="other-creator-opinions-heading" className="text-lg font-semibold">
          {t("youtubeOpinions.otherCreatorOpinions")}
          {!loading && !failed && opinions.length > 0 && (
            <span className="ml-2 text-sm font-normal text-foreground/75 tabular-nums">
              {opinions.length}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("youtubeOpinions.otherCreatorOpinionsHint", { ticker })}
        </p>
      </div>
      {loading ? (
        <div className="space-y-5 py-6" role="status" aria-label={t("common.loadingStatus")}>
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 py-8 text-sm text-muted-foreground">
          <span>{t("youtubeOpinions.otherCreatorOpinionsFailed")}</span>
          <Button size="sm" variant="outline" onClick={() => setRevision((value) => value + 1)}>
            {t("common.retry")}
          </Button>
        </div>
      ) : opinions.length === 0 ? (
        <p className="py-8 text-sm leading-6 text-muted-foreground">
          {t("youtubeOpinions.noOtherCreatorOpinions", { ticker })}
        </p>
      ) : (
        <>
          <div id="other-creator-opinions-list" className="pt-4">
            {opinions.slice(0, visibleCount).map((opinion) => (
              <OpinionCard key={opinion.id} opinion={opinion} t={t} showTicker={false} onCreator={onCreator} />
            ))}
          </div>
          {visibleCount < opinions.length && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                aria-controls="other-creator-opinions-list"
                onClick={() => setVisibleCount((value) => value + 3)}
              >
                {t("youtubeOpinions.loadMoreCreators")}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
