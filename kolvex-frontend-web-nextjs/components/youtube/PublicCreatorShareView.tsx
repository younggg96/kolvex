"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { formatOpinionDate } from "@/lib/opinionDates";
import { sourceVideoUrl } from "@/lib/creatorSharing";
import type { CreatorLatestVideo } from "@/lib/youtubeOpinionsApi";
import CreatorShare from "./CreatorShare";
import CreatorAvatar from "./CreatorAvatar";
import { ReadingLayout } from "@/components/public/ReadingLayout";
import { OpinionList } from "@/components/public/ReadingElements";

export default function PublicCreatorShareView({ data }: { data: CreatorLatestVideo }) {
  const c = useCopy();
  const { t } = useTranslation();
  if (!data.creator || !data.video) return null;
  const creator = data.creator;
  const name = creator.channel_title || creator.channel_handle || creator.channel_id;
  const source = sourceVideoUrl(data.video);
  const opinions = data.opinions.map((opinion) => ({
    ...opinion,
    channel_title: opinion.channel_title || creator.channel_title,
    channel_handle: opinion.channel_handle || creator.channel_handle,
    channel_avatar_url: opinion.channel_avatar_url || creator.channel_avatar_url,
  }));
  return <ReadingLayout>
    <div className="mx-auto max-w-[1080px] space-y-8">
      <div className="space-y-4 border-b border-border pb-6">
        <div className="flex items-center gap-4"><CreatorAvatar name={name} avatarUrl={creator.channel_avatar_url} size="lg" /><div className="min-w-0"><h1 className="break-words text-[28px] font-semibold leading-tight tracking-[-0.025em] md:text-[32px]">{name}</h1><p className="mt-1 text-sm text-muted-foreground">{c("Latest imported video opinions", "最新一期已收录视频观点")}</p></div></div>
        <p className="text-sm text-muted-foreground"><time dateTime={data.video.opinion_date}>{formatOpinionDate(data.video.opinion_date || data.video.video_published_at, t("common.intlLocale"))}</time> · {c("New York date", "美东日期")} · {data.opinions.length} {c("stocks", "只股票")}</p>
        <h2 className="break-words text-base font-medium leading-relaxed">{data.video.video_title}</h2>
        {source && <a href={source} target="_blank" rel="noopener noreferrer" className="inline-block rounded-sm text-sm text-positive underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{c("View source video", "查看原视频")}</a>}
      </div>
      <OpinionList opinions={opinions} />
      <div className="flex flex-wrap items-center gap-3"><CreatorShare creator={creator} /><Button variant="outline" asChild><Link href={`/dashboard/youtube-opinions?${new URLSearchParams({ tab: "creators", creator: creator.channel_id })}`}>{c("View creator history", "查看博主历史观点")}</Link></Button></div>
      <p className="text-xs text-muted-foreground">{c("This link follows the creator's latest imported video. Dates and video sources are shown above.", "此链接展示博主最新一期已收录视频的观点，日期及原视频来源见上方。")}</p>
    </div>
  </ReadingLayout>;
}
