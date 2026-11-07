"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageBreadcrumb from "@/components/layout/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, useCopy } from "@/components/decision/shared";
import {
  ListCard,
  ListLoadMore,
  ListRows,
  listFeedGroupRowClass,
} from "@/components/ui/list-card";
import { useTranslation } from "@/lib/i18n";
import { getYouTubeVideoFeed } from "@/lib/youtubeOpinionsApi";
import VideoOpinionCard from "./VideoOpinionCard";
import type { VideoOpinionGroup } from "@/lib/youtubeVideoHistory";

const pageSize = 20;

export default function OpinionList() {
  const c = useCopy();
  const { t } = useTranslation();
  const router = useRouter();
  const [videos, setVideos] = useState<VideoOpinionGroup[]>([]);
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
    const controller = new AbortController();
    active.current = true;
    setLoading(true);
    setError(false);
    getYouTubeVideoFeed(pageSize, 0, controller.signal)
      .then((result) => {
        if (!alive) return;
        setVideos(result.videos);
        setTotal(result.pagination.total);
        offset.current = result.videos.length;
        setHasMore(result.pagination.has_more);
      })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; active.current = false; controller.abort(); };
  }, [revision]);

  async function loadMore() {
    if (pending.current || loading || !hasMore) return;
    pending.current = true;
    setMoreLoading(true);
    setError(false);
    try {
      const result = await getYouTubeVideoFeed(pageSize, offset.current);
      if (!active.current) return;
      setVideos((current) => {
        const ids = new Set(current.map((video) => video.videoId));
        return [...current, ...result.videos.filter((video) => !ids.has(video.videoId))];
      });
      offset.current += result.videos.length;
      setTotal(result.pagination.total);
      setHasMore(result.videos.length > 0 && result.pagination.has_more);
    } catch {
      if (active.current) setError(true);
    } finally {
      pending.current = false;
      if (active.current) setMoreLoading(false);
    }
  }

  return (
    <DashboardLayout title={c("All opinions", "全部观点")} breadcrumb={<PageBreadcrumb items={[
      { label: t("youtubeOpinions.title"), href: "/dashboard/youtube-opinions" },
      { label: c("All opinions", "全部观点") },
    ]} />}>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-[16px] pb-16 pt-6 md:px-8 md:pt-8">
          <header className="mb-6">
            <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">{c("All opinions", "全部观点")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{c("Grouped by video, newest publication first", "按视频归并，按视频发布时间排序")}</p>
          </header>
          <ListCard>
            <div aria-busy={loading || moreLoading}>
              {loading ? (
                <div role="status" aria-label={t("common.loadingStatus")} className="space-y-3 py-2">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-32 w-full" />)}</div>
              ) : (
                <>
                  {!error && <p role="status" className="mb-1 border-b border-border pb-3 text-xs tabular-nums text-muted-foreground">{c(`${videos.length} of ${total} videos`, `已显示 ${videos.length} / ${total} 期视频`)}</p>}
                  {videos.length ? (
                    <ListRows aria-label={c("All opinions", "全部观点")}>
                      {videos.map((group) => <li key={group.videoId} className={listFeedGroupRowClass}><VideoOpinionCard group={group} t={t} showCreator onStock={(ticker) => router.push(`/dashboard/youtube-opinions?tab=stocks&stock=${encodeURIComponent(ticker)}`)} /></li>)}
                    </ListRows>
                  ) : !error ? <Empty>{t("youtubeOpinions.noOpinionsYet")}</Empty> : null}
                </>
              )}
            </div>
            {!loading && error && <div role="alert" className="flex flex-wrap items-center gap-3 py-6"><p className="text-sm text-muted-foreground">{c("Opinions could not be loaded. Try again.", "暂时无法加载观点，请重试。")}</p><Button variant="outline" onClick={() => videos.length ? loadMore() : setRevision((value) => value + 1)}>{t("common.retry")}</Button></div>}
            {!loading && !error && hasMore && <ListLoadMore loading={moreLoading} onClick={loadMore}>{c("Load more videos", "加载更多视频")}</ListLoadMore>}
          </ListCard>
        </div>
      </main>
    </DashboardLayout>
  );
}
