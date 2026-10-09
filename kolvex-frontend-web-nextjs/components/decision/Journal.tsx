"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import OpinionStrength from "@/components/youtube/OpinionStrength";
import { Empty, HeldMark, Panel, TextLink, WorkspaceLink, useCopy, useCreatorCatalogue, useDayLabel, useHeldTickers } from "./shared";

/** A read-only feed from imported opinions, never dependent on personal plans. */
export default function Journal() {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const [attempt, setAttempt] = useState(0);
  const [scope, setScope] = useState<"all" | "holdings">("all");
  const catalogue = useCreatorCatalogue(attempt);
  const held = useHeldTickers(attempt);
  const heldSet = useMemo(() => new Set(held.tickers), [held.tickers]);
  const inScope = (ticker: string) => scope === "all" || heldSet.has(ticker);
  const changes = [...(catalogue.data?.changes ?? [])].filter((item) => inScope(item.ticker)).sort((a, b) => b.current_date.localeCompare(a.current_date));
  const opinions = [...(catalogue.data?.latest ?? [])].filter((item) => inScope(item.ticker)).sort((a, b) => b.opinion_date.localeCompare(a.opinion_date));
  const loading = catalogue.loading || (scope === "holdings" && held.loading);
  const error = catalogue.error || (scope === "holdings" && held.error);
  const skeleton = <div className="space-y-4 py-5">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-16 w-full" />)}</div>;
  return (
    <DashboardLayout title={c("Updates", "变化动态")}>
      <main className="flex-1 overflow-y-auto" aria-busy={loading}>
        <div className="mx-auto  space-y-10 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <section className="border-b border-border pb-7">
            <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">{c("What changed in creator views", "博主观点有什么变化")}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{c("Latest imported opinions and changes from the previous day with coverage. Open a stock to read the evidence and source videos.", "查看最新收录的观点，以及相较上一次有观点的日期发生的变化。点击股票，查看分析依据和原始视频。")}</p>
            <div className="mt-5 flex gap-2" role="group" aria-label={c("Update scope", "动态范围")}>
              {([['all', c('All stocks', '全部股票')], ['holdings', c('My holdings', '我的持仓')]] as const).map(([value, label]) => <Button key={value} size="sm" variant={scope === value ? 'default' : 'outline'} aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</Button>)}
            </div>
          </section>
          {error ? <div role="alert" className="space-y-3"><p>{c("Updates could not be loaded. Try again.", "暂时无法加载动态，请重试。")}</p><Button onClick={() => setAttempt((n) => n + 1)}>{c("Retry", "重试")}</Button></div> : scope === 'holdings' && !held.loading && !held.tickers.length ? <Empty action={<TextLink href="/dashboard/portfolio">{c("View portfolio", "查看投资组合")}</TextLink>}>{c("No linked equity holdings yet. Browse all stocks to see updates.", "暂时没有已连接的股票持仓。切换到全部股票即可查看动态。")}</Empty> : <>
            <Panel title={c("Opinion changes", "观点变化")} description={c("Daily creator averages; a new opinion is shown separately from a change.", "按有观点的日期比较博主平均倾向；首次观点单独标记。")}>
              {loading ? skeleton : changes.length ? <ul className="divide-y divide-border">{changes.map((item) => <li key={`${item.current_date}-${item.ticker}`} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div><WorkspaceLink ticker={item.ticker} held={heldSet.has(item.ticker)} /><p className="mt-1 text-xs text-muted-foreground">{dayLabel(item.current_date)} · {c(`${item.opinion_count} opinions`, `${item.opinion_count} 条观点`)}</p></div>
                <div className="flex flex-col items-end gap-1">{item.change == null ? <><OpinionStrength value={item.current_score} /><span className="text-xs text-muted-foreground">{c("First opinion in range", "首次出现观点")}</span></> : <><OpinionStrength value={item.change} change /><div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground"><span>{dayLabel(item.previous_date || item.current_date)}</span><OpinionStrength value={item.previous_score} className="text-xs" /><span aria-hidden>→</span><OpinionStrength value={item.current_score} className="text-xs" /></div></>}</div>
              </li>)}</ul> : <Empty>{c("No opinion changes in the available data.", "现有数据中暂无观点变化。")}</Empty>}
            </Panel>
            <Panel title={c("Latest opinions", "最新观点")} action={<TextLink href="/dashboard/youtube-opinions?tab=stocks">{c("Full opinion history", "完整观点历史")}</TextLink>}>
              {loading ? skeleton : opinions.length ? <ul className="divide-y divide-border">{opinions.map((opinion) => <li key={opinion.id} className="space-y-3 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/dashboard/market/${encodeURIComponent(opinion.ticker)}`} className="font-semibold hover:underline">{opinion.ticker}{heldSet.has(opinion.ticker) && <HeldMark />}</Link><time className="text-xs text-muted-foreground" dateTime={opinion.opinion_date}>{dayLabel(opinion.opinion_date)}</time></div>
                <Link href={`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(opinion.channel_id)}`} className="inline-flex items-center gap-2 text-sm hover:underline"><CreatorAvatar name={opinion.channel_title || opinion.channel_id} avatarUrl={opinion.channel_avatar_url} size="xs" />{opinion.channel_title || opinion.channel_id}</Link>
                <OpinionStrength value={opinion.direction_score} />
                <p className="max-w-[72ch] whitespace-pre-wrap text-sm leading-6">{opinion.summary || opinion.thesis || c("See source video for details.", "查看原始视频了解详情。")}</p>
                {!!opinion.risks?.length && <p className="text-sm leading-6 text-muted-foreground">{c("Risks mentioned", "提到的风险")}：{opinion.risks.join(c("; ", "；"))}</p>}
                <a href={opinion.video_url || `https://www.youtube.com/watch?v=${encodeURIComponent(opinion.video_id)}`} target="_blank" rel="noreferrer" className="inline-block text-xs font-medium underline-offset-4 hover:underline">{c("Watch source video", "查看原始视频")}</a>
              </li>)}</ul> : <Empty>{c("No imported opinions in this view yet.", "此范围内暂时没有已收录的观点。")}</Empty>}
            </Panel>
          </>}
        </div>
      </main>
    </DashboardLayout>
  );
}
