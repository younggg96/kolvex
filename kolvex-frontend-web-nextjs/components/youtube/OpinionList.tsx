"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import HeaderBackButton from "@/components/layout/HeaderBackButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { getYouTubeOpinionDashboard, type YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import OpinionCard from "./OpinionCard";

const pageSize = 40;

export default function OpinionList() {
  const c = useCopy();
  const { t } = useTranslation();
  const router = useRouter();
  const [opinions, setOpinions] = useState<YouTubeOpinion[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const active = useRef(false);
  const pending = useRef(false);
  const offset = useRef(0);

  useEffect(() => {
    let alive = true;
    active.current = true;
    setLoading(true);
    setError(false);
    getYouTubeOpinionDashboard({ limit: pageSize, offset: 0 })
      .then((result) => {
        if (!alive) return;
        setOpinions(result.latest);
        setTotal(result.pagination?.total ?? result.summary.total_opinions);
        offset.current = result.latest.length;
        setHasMore(result.pagination?.has_more ?? result.latest.length < result.summary.total_opinions);
      })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; active.current = false; };
  }, [revision]);

  async function loadMore() {
    if (pending.current || loading || !hasMore) return;
    pending.current = true;
    setMoreLoading(true);
    setError(false);
    try {
      const result = await getYouTubeOpinionDashboard({ limit: pageSize, offset: offset.current });
      if (!active.current) return;
      setOpinions((current) => {
        const ids = new Set(current.map((opinion) => opinion.id));
        return [...current, ...result.latest.filter((opinion) => !ids.has(opinion.id))];
      });
      offset.current += result.latest.length;
      setTotal(result.pagination?.total ?? result.summary.total_opinions);
      setHasMore(result.latest.length > 0 && (result.pagination?.has_more ?? offset.current < result.summary.total_opinions));
    } catch {
      if (active.current) setError(true);
    } finally {
      pending.current = false;
      if (active.current) setMoreLoading(false);
    }
  }

  return (
    <DashboardLayout title={c("All opinions", "全部观点")} headerLeftAction={<HeaderBackButton href="/dashboard/youtube-opinions" label={t("common.back")} />}>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1080px] px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <header className="mb-6 border-b border-border pb-5">
            <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">{c("All opinions", "全部观点")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{c("Latest opinions first", "按最新观点排序")}</p>
            {!loading && !error && <p className="mt-1 text-xs tabular-nums text-muted-foreground" role="status">{c(`${opinions.length} of ${total} opinions`, `已显示 ${opinions.length} / ${total} 条观点`)}</p>}
          </header>
          <div aria-busy={loading || moreLoading}>
            {loading ? (
              <div role="status" aria-label={t("common.loadingStatus")} className="space-y-5">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-32 w-full" />)}</div>
            ) : (
              <>
                {opinions.map((opinion) => <OpinionCard key={opinion.id} opinion={opinion} t={t} onCreator={(creator) => router.push(`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(creator)}`)} onStock={(ticker) => router.push(`/dashboard/youtube-opinions?tab=stocks&stock=${encodeURIComponent(ticker)}`)} />)}
                {!opinions.length && !error && <Empty>{t("youtubeOpinions.noOpinionsYet")}</Empty>}
              </>
            )}
          </div>
          {!loading && error && <div role="alert" className="mt-5 flex flex-wrap items-center gap-3"><p className="text-sm text-muted-foreground">{c("Opinions could not be loaded. Try again.", "暂时无法加载观点，请重试。")}</p><Button variant="outline" onClick={() => opinions.length ? loadMore() : setRevision((value) => value + 1)}>{t("common.retry")}</Button></div>}
          {!loading && !error && hasMore && <Button variant="outline" className="mt-6" disabled={moreLoading} onClick={loadMore}>{moreLoading ? t("common.loadingStatus") : c("Load more opinions", "加载更多观点")}</Button>}
        </div>
      </main>
    </DashboardLayout>
  );
}
