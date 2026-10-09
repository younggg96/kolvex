"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { ArrowUpRight, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import OpinionStrength from "@/components/youtube/OpinionStrength";
import { latestCreatorOpinions } from "@/lib/decision";
import { useTranslation } from "@/lib/i18n";
import type { YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import { cn } from "@/lib/utils";
import { Empty, Panel, TextLink, useCopy } from "./shared";

type Side = "bullish" | "neutral" | "bearish";
const sideOf = (opinion: YouTubeOpinion): Side =>
  opinion.sentiment === "bullish" ? "bullish" : opinion.sentiment === "bearish" ? "bearish" : "neutral";
const tones: Record<Side, { text: string; dot: string }> = {
  bullish: { text: "text-positive", dot: "bg-positive-fill" },
  neutral: { text: "text-muted-foreground", dot: "bg-muted-foreground" },
  bearish: { text: "text-negative", dot: "bg-negative-fill" },
};

export default function CreatorIntelligence({
  ticker,
  opinions,
  loading = false,
  error = false,
  onRetry,
}: {
  ticker: string;
  opinions: YouTubeOpinion[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const c = useCopy();
  const { t } = useTranslation();
  const detailId = useId();
  const detailRef = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Side[]>([]);
  const [allDates, setAllDates] = useState(false);
  const history = [...opinions].sort((a, b) => b.opinion_date.localeCompare(a.opinion_date));
  const latest = latestCreatorOpinions(opinions);
  const selected = history.find((opinion) => opinion.id === selectedId) ?? history[0];
  const selectedDay = selected?.opinion_date.slice(0, 10);
  const days = [...new Set(history.map((opinion) => opinion.opinion_date.slice(0, 10)))];
  const visibleDays = allDates ? days : [...new Set([...days.slice(0, 7), ...(selectedDay ? [selectedDay] : [])])].sort((a, b) => b.localeCompare(a));
  const dayOpinions = history.filter((opinion) => opinion.opinion_date.slice(0, 10) === selectedDay);
  const date = (value: string, compact = false) => {
    const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(t("common.intlLocale"), { year: compact ? undefined : "numeric", month: "short", day: "numeric" }).format(parsed);
  };
  const groups: Array<{ side: Side; label: string; empty: string }> = [
    { side: "bullish", label: c("Bullish", "看多"), empty: c("No bullish calls in the past 30 days", "近 30 天暂无看多观点") },
    { side: "neutral", label: c("Neutral or mixed", "中性或分歧"), empty: c("No neutral or mixed calls in the past 30 days", "近 30 天暂无中性或分歧观点") },
    { side: "bearish", label: c("Bearish", "看空"), empty: c("No bearish calls in the past 30 days", "近 30 天暂无看空观点") },
  ];
  function selectOpinion(opinion: YouTubeOpinion, reveal = false) {
    setSelectedId(opinion.id);
    if (reveal) {
      // Focus the persistent reading region; its content updates in the next render.
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }
  const creatorName = (opinion: YouTubeOpinion) => opinion.channel_title || opinion.channel_id;

  return (
    <Panel
      id="creator-intelligence"
      className="[container-name:creator-intelligence] [container-type:inline-size]"
      title={c("Creator Intelligence", "博主情报")}
      description={c("Latest opinion from each tracked creator in the past 30 days. Select a creator or date to read the evidence.", "按近 30 天每位博主的最新观点分组。点击博主或日期，查看对应观点。")}
      action={<TextLink href={`/dashboard/youtube-opinions?tab=stocks&stock=${encodeURIComponent(ticker)}`}>{c("Full record", "完整记录")}</TextLink>}
    >
      {loading ? (
        <div className="pt-5" role="status" aria-label={t("common.loadingStatus")}>
          <div className="creator-opinion-groups grid gap-4">{groups.map((group) => <div key={group.side} className="space-y-4 rounded-xl border border-border bg-card p-4"><Skeleton className="h-6 w-24" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>)}</div>
          <Skeleton className="mt-8 h-28 w-full" />
        </div>
      ) : error ? (
        <div role="alert"><Empty action={onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("common.retry")}</Button>}>{c("Creator opinions could not be loaded.", "暂时无法加载博主观点。")}</Empty></div>
      ) : !history.length ? (
        <Empty action={<TextLink href="/dashboard/youtube-opinions">{c("Browse creators", "浏览博主观点")}</TextLink>}>{c("No creator opinions for this stock yet. You can still use AI analysis and AI research on this page.", "这只股票暂时没有博主观点，仍可在本页使用 AI 分析和 AI 研究。")}</Empty>
      ) : (
        <>
          <div className="mt-5 creator-opinion-groups grid items-start gap-4">
            {groups.map((group) => {
              const items = latest.filter((opinion) => sideOf(opinion) === group.side);
              const expanded = expandedGroups.includes(group.side);
              return (
                <section key={group.side} aria-label={group.label} className="min-w-0 rounded-xl border border-border bg-card">
                  <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-4">
                    <h3 className={cn("flex items-center gap-2 text-sm font-semibold", tones[group.side].text)}><span aria-hidden className={cn("h-2 w-2 rounded-full", tones[group.side].dot)} />{group.label}</h3>
                    <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">{c(`${items.length} creators`, `${items.length} 位博主`)}</span>
                  </header>
                  {items.length ? (
                    <ul className="divide-y divide-border">
                      {(expanded ? items : items.slice(0, 3)).map((opinion) => (
                        <li key={opinion.id}>
                          <button type="button" aria-controls={detailId} aria-pressed={selected?.id === opinion.id} onClick={() => selectOpinion(opinion, true)} className={cn("group w-full cursor-pointer px-4 py-4 text-left transition-colors hover:bg-muted/60 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary", selected?.id === opinion.id && "bg-muted/50")}>
                            <span className="flex min-w-0 items-start gap-2.5"><CreatorAvatar name={creatorName(opinion)} avatarUrl={opinion.channel_avatar_url} size="sm" /><span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-5">{creatorName(opinion)}</span><time dateTime={opinion.opinion_date} className="mt-1 block text-xs text-muted-foreground tabular-nums">{date(opinion.opinion_date)}</time></span></span>
                            <span className="mt-3 line-clamp-2 text-sm leading-6 text-foreground/85">{opinion.summary || opinion.thesis || c("Read this opinion", "查看这条观点")}</span>
                            <span className="mt-3 flex items-center justify-between gap-2 text-xs font-medium"><span>{c("Read opinion", "查看观点")}</span><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" aria-hidden /></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="px-4 py-6 text-sm leading-6 text-muted-foreground">{group.empty}</p>}
                  {items.length > 3 && <div className="border-t border-border px-4 py-3"><button type="button" aria-expanded={expanded} onClick={() => setExpandedGroups((current) => expanded ? current.filter((side) => side !== group.side) : [...current, group.side])} className="inline-flex min-h-11 cursor-pointer items-center rounded-sm text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{expanded ? c("Show fewer creators", "收起博主") : c(`View ${items.length - 3} more creators`, `查看另外 ${items.length - 3} 位博主`)}</button></div>}
                </section>
              );
            })}
          </div>

          <section className="mt-8" aria-labelledby={`${detailId}-timeline-title`}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 id={`${detailId}-timeline-title`} className="text-base font-semibold">{c("Opinion timeline", "观点时间线")}</h3>
              <p className="text-xs text-muted-foreground">{c("Newest first · Includes historical opinions", "由新到旧 · 包含历史观点")}</p>
            </div>
            <div className="mt-4 overflow-x-auto pb-2">
              <ol className="flex min-w-full w-max" aria-label={c("Select an opinion date", "选择观点日期")}>
                {visibleDays.map((day) => {
                  const items = history.filter((opinion) => opinion.opinion_date.slice(0, 10) === day);
                  const active = selectedDay === day;
                  return <li key={day} className="relative w-32 shrink-0"><span aria-hidden className="absolute left-0 right-0 top-5 h-px bg-border" /><button type="button" aria-pressed={active} aria-controls={detailId} onClick={() => selectOpinion(items[0])} className={cn("relative flex w-full cursor-pointer flex-col items-start gap-2 rounded-lg px-3 pb-3 pt-3 text-left transition-colors hover:bg-muted/60 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary", active && "bg-muted/70")}><span aria-hidden className={cn("h-4 w-4 rounded-full border-[3px] border-background", active ? "bg-foreground" : "bg-muted-foreground")} /><time dateTime={day} className={cn("text-sm tabular-nums", active ? "font-semibold" : "text-muted-foreground")}>{date(day, true)}</time><span className="text-xs text-muted-foreground">{c(`${items.length} opinions`, `${items.length} 条观点`)}</span></button></li>;
                })}
              </ol>
            </div>
            {days.length > 7 && <button type="button" aria-expanded={allDates} onClick={() => setAllDates((value) => !value)} className="mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-sm text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{allDates ? c("Show recent dates", "收起历史日期") : c(`View all ${days.length} dates`, `查看全部 ${days.length} 个日期`)}</button>}
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={c("Opinions on the selected date", "所选日期的观点")}>
              {dayOpinions.map((opinion) => <button key={opinion.id} type="button" aria-pressed={selected?.id === opinion.id} aria-controls={detailId} onClick={() => selectOpinion(opinion)} className={cn("inline-flex max-w-full cursor-pointer items-center gap-2 rounded-full border px-3 py-3 text-left text-xs font-medium transition-colors hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", selected?.id === opinion.id ? "border-foreground bg-muted" : "border-border")}><CreatorAvatar name={creatorName(opinion)} avatarUrl={opinion.channel_avatar_url} size="xs" /><span className="truncate">{creatorName(opinion)}</span><span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tones[sideOf(opinion)].dot)} /><span className="sr-only">{groups.find((group) => group.side === sideOf(opinion))?.label}</span><ChevronRight className="h-3 w-3 shrink-0" aria-hidden /></button>)}
            </div>
          </section>

          {selected && <article ref={detailRef} id={detailId} tabIndex={-1} className="mt-6 scroll-mt-6 border-t border-border pt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-labelledby={`${detailId}-detail-title`}>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0"><h3 id={`${detailId}-detail-title`} className="text-base font-semibold">{c("Opinion details", "观点内容")}</h3><Link href={`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(selected.channel_id)}`} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-sm text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><CreatorAvatar name={creatorName(selected)} avatarUrl={selected.channel_avatar_url} size="sm" /><span className="break-words">{creatorName(selected)}</span></Link></div>
              <div className="space-y-2 text-right"><time dateTime={selected.opinion_date} className="block text-xs text-muted-foreground tabular-nums">{date(selected.opinion_date)}</time><span className="block">{sideOf(selected) === "neutral" ? <span className="text-sm font-semibold text-muted-foreground">{selected.sentiment === "mixed" ? c("Mixed", "分歧") : c("Neutral", "中性")}</span> : <OpinionStrength value={selected.direction_score} />}</span></div>
            </header>
            {(selected.time_horizon || selected.confidence != null) && <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {selected.time_horizon && <div className="flex gap-2"><dt>{c("Time horizon", "时间范围")}</dt><dd className="font-medium text-foreground">{selected.time_horizon}</dd></div>}
              {selected.confidence != null && <div className="flex gap-2"><dt>{c("Confidence", "置信度")}</dt><dd className="font-medium text-foreground tabular-nums">{Math.round(selected.confidence * 100)}%</dd></div>}
            </dl>}
            <div className="mt-5 space-y-5 text-sm leading-7 [overflow-wrap:anywhere]">
              {selected.summary && <p className="whitespace-pre-wrap">{selected.summary}</p>}
              {selected.thesis && selected.thesis !== selected.summary && <div><h4 className="mb-1 text-xs font-semibold text-muted-foreground">{c("Investment view", "投资判断")}</h4><p className="whitespace-pre-wrap">{selected.thesis}</p></div>}
              {!!selected.key_points?.length && <div><h4 className="text-xs font-semibold text-muted-foreground">{c("Key points", "核心依据")}</h4><ul className="mt-2 list-disc space-y-1 pl-5">{selected.key_points.map((point, index) => <li key={index}>{point}</li>)}</ul></div>}
              {!!selected.risks?.length && <div><h4 className="text-xs font-semibold text-muted-foreground">{c("Risks mentioned", "提到的风险")}</h4><ul className="mt-2 list-disc space-y-1 pl-5">{selected.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul></div>}
              {!selected.summary && !selected.thesis && <p className="text-muted-foreground">{c("Read the source video for this opinion.", "查看原始视频了解这条观点。")}</p>}
            </div>
            {(selected.video_url || selected.video_id) && <a href={selected.video_url || `https://www.youtube.com/watch?v=${encodeURIComponent(selected.video_id)}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex max-w-full items-center gap-2 rounded-sm text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ExternalLink className="h-4 w-4 shrink-0" aria-hidden /><span className="break-words">{selected.video_title || c("Watch source video", "查看原始视频")}</span></a>}
          </article>}
        </>
      )}
    </Panel>
  );
}
