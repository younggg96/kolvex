"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import OpinionStrength from "@/components/youtube/OpinionStrength";
import CompanyLogo from "@/components/ui/company-logo";
import type { YouTubeDailyChange, YouTubeOpinion } from "@/lib/youtubeOpinionsApi";
import { cn, proxyImageUrl } from "@/lib/utils";
import {
  Empty,
  HeldMark,
  Panel,
  TextLink,
  useCopy,
  useCreatorCatalogue,
  useDayLabel,
  useHeldTickers,
} from "./shared";
import { useDecisionCommand } from "./CommandLayer";

const WEEK_MS = 7 * 86_400_000;
const sentimentTone = (sentiment: YouTubeOpinion["sentiment"]) =>
  sentiment === "bullish" ? "text-positive" : sentiment === "bearish" ? "text-negative" : "text-muted-foreground";

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return [...groups.entries()];
}

export default function ResearchHome() {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const { setContext } = useDecisionCommand();
  const [attempt, setAttempt] = useState(0);
  const { data: dashboard, loading, error } = useCreatorCatalogue(attempt);
  const held = useHeldTickers(attempt);
  const heldSet = useMemo(() => new Set(held.tickers), [held.tickers]);

  const context = JSON.stringify({ workspace: "Research", creatorCoverage: dashboard?.stocks.slice(0, 8), creators: dashboard?.creators.slice(0, 8), recentCreatorChanges: dashboard?.changes.slice(0, 6), unavailable: error });
  useEffect(() => {
    setContext(context);
    return () => setContext("");
  }, [context, setContext]);

  const changes = [...(dashboard?.changes ?? [])].sort((a, b) => b.current_date.localeCompare(a.current_date));
  const weekStart = Date.now() - WEEK_MS;
  const thisWeek = changes.filter((change) => Date.parse(`${change.current_date}T23:59:59`) >= weekStart);
  const stronger = thisWeek.filter((change) => (change.change ?? 0) > 0).length;
  const weaker = thisWeek.filter((change) => (change.change ?? 0) < 0).length;
  const fresh = thisWeek.filter((change) => change.change == null).length;
  const timeline = groupBy(changes.slice(0, 14), (change) => change.current_date);
  const videos = groupBy(dashboard?.latest ?? [], (opinion) => opinion.video_id).slice(0, 6);
  const consensus = new Map(dashboard?.stocks.map((stock) => [stock.ticker, stock]) ?? []);
  const heldCovered = held.tickers.filter((ticker) => consensus.has(ticker));
  const heldUncovered = held.tickers.length - heldCovered.length;
  const latestDate = changes[0]?.current_date;

  const changeRow = (change: YouTubeDailyChange) => {
    const stock = consensus.get(change.ticker);
    return (
      <li key={`${change.current_date}-${change.ticker}`}>
        <Link
          href={`/dashboard/research/${encodeURIComponent(change.ticker)}`}
          className="-mx-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-3 py-3.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span aria-hidden><CompanyLogo symbol={change.ticker} size="md" /></span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">
                {change.ticker}
                {heldSet.has(change.ticker) && <HeldMark />}
              </span>
              <span className="block truncate text-[13px] text-muted-foreground">
                {stock?.company_name || change.ticker}
              </span>
            </span>
          </span>
          <span className="flex flex-col items-end gap-0.5 text-right">
            {change.change == null ? (
              <>
                <OpinionStrength value={change.current_score} />
                <span className="text-xs text-muted-foreground">{c("First opinion in range", "首次出现观点")}</span>
              </>
            ) : (
              <>
                <OpinionStrength value={change.change} change />
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {c("now", "现为")}
                  <OpinionStrength value={change.current_score} className="text-xs font-medium [&>span:first-child]:hidden" />
                </span>
              </>
            )}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <DashboardLayout title={c("Research", "研究")}>
      <main className="flex-1 overflow-y-auto" aria-busy={loading}>
        <div className="mx-auto px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <section className="flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0" aria-live="polite">
              {loading && !dashboard ? (
                <>
                  <Skeleton className="h-10 w-80 max-w-full" />
                  <Skeleton className="mt-3 h-4 w-60" />
                </>
              ) : error ? (
                <>
                  <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[32px]">
                    {c("Creator research is unavailable", "博主观点暂时无法加载")}
                  </h1>
                  <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => setAttempt((n) => n + 1)}>
                    {c("Retry", "重试")}
                  </Button>
                </>
              ) : (
                <>
                  <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[32px]">
                    {thisWeek.length
                      ? c(
                          `${thisWeek.length} ${thisWeek.length === 1 ? "stock has" : "stocks have"} new creator calls this week`,
                          `这周有 ${thisWeek.length} 只股票出现新观点`,
                        )
                      : c("No new creator calls this week", "这周博主还没有新观点")}
                  </h1>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {thisWeek.length ? (
                      <>
                        {stronger > 0 && <span><span className="font-semibold text-positive">{stronger}</span> {c("strengthening", "只转强")}</span>}
                        {weaker > 0 && <span><span className="font-semibold text-negative">{weaker}</span> {c("weakening", "只转弱")}</span>}
                        {fresh > 0 && <span><span className="font-semibold text-foreground">{fresh}</span> {c("first opinions", "只首次出现")}</span>}
                      </>
                    ) : latestDate ? (
                      <span>{c("Last update", "最近一次更新")}：{dayLabel(latestDate)}</span>
                    ) : null}
                  </p>
                </>
              )}
            </div>
            <TextLink href="/dashboard/youtube-opinions?tab=stocks">{c("Browse all stocks", "浏览全部股票")}</TextLink>
          </section>

          <div className="mt-10 grid gap-x-12 gap-y-12 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-12">
              <Panel
                title={c("Opinion changes", "观点变化")}
                description={c("Each stock's latest creator consensus compared with its previous day of opinions.", "每只股票最新一天的博主共识，与它上一次有观点的那天相比。")}
                action={<TextLink href="/dashboard/youtube-opinions?tab=stocks">{c("All stocks", "全部股票")}</TextLink>}
              >
                {loading && !dashboard ? (
                  <div className="space-y-3 py-4">
                    {[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-11 w-full" />)}
                  </div>
                ) : timeline.length ? (
                  <ol>
                    {timeline.map(([date, items]) => (
                      <li key={date} className="pt-5">
                        <h3 className="text-[13px] font-semibold text-muted-foreground">
                          <time dateTime={date}>{dayLabel(date)}</time>
                        </h3>
                        <ul className="mt-1 divide-y divide-border">{items.map(changeRow)}</ul>
                      </li>
                    ))}
                  </ol>
                ) : (
                  !error && <Empty>{c("Changes will appear once creator opinions are imported.", "导入博主观点后，变化会出现在这里。")}</Empty>
                )}
              </Panel>

              <Panel
                title={c("Latest videos", "最新视频")}
                action={<TextLink href="/dashboard/youtube-opinions?tab=creators">{c("All creators", "全部博主")}</TextLink>}
              >
                {loading && !dashboard ? (
                  <div className="space-y-4 py-4">
                    {[0, 1, 2].map((row) => <Skeleton key={row} className="h-[72px] w-full" />)}
                  </div>
                ) : videos.length ? (
                  <ul className="divide-y divide-border">
                    {videos.map(([videoId, opinions]) => {
                      const first = opinions[0];
                      const href = first.video_url || `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
                      return (
                        <li key={videoId} className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[148px_minmax(0,1fr)]">
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="relative block aspect-video overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={c(`Watch: ${first.video_title || videoId}`, `观看：${first.video_title || videoId}`)}
                          >
                            {first.thumbnail_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={proxyImageUrl(first.thumbnail_url)}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                              />
                            )}
                          </a>
                          <div className="min-w-0">
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="line-clamp-2 rounded-sm text-[15px] font-semibold leading-snug underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              {first.video_title || videoId}
                            </a>
                            <Link
                              href={`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(first.channel_id)}`}
                              className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-sm text-[13px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <CreatorAvatar name={first.channel_title || first.channel_id} avatarUrl={first.channel_avatar_url} size="xs" />
                              <span className="truncate">{first.channel_title || first.channel_id}</span>
                              <span className="shrink-0 tabular-nums">{dayLabel(first.opinion_date)}</span>
                            </Link>
                            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                              {opinions.map((opinion) => (
                                <Link
                                  key={opinion.id}
                                  href={`/dashboard/research/${encodeURIComponent(opinion.ticker)}`}
                                  className={cn("rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", sentimentTone(opinion.sentiment))}
                                >
                                  {opinion.ticker}
                                </Link>
                              ))}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  !error && <Empty>{c("No videos imported yet.", "暂时没有导入的视频。")}</Empty>
                )}
              </Panel>
            </div>

            <aside className="min-w-0 space-y-12 xl:sticky xl:top-8 xl:self-start">
              <Panel title={c("Your holdings, per creators", "博主怎么看你的持仓")}>
                {held.loading ? (
                  <div className="space-y-3 py-4">
                    {[0, 1, 2].map((row) => <Skeleton key={row} className="h-9 w-full" />)}
                  </div>
                ) : held.error || !held.tickers.length ? (
                  <Empty action={<TextLink href="/dashboard/portfolio">{c("Connect an account", "连接账户")}</TextLink>}>
                    {c("Connect a brokerage account to see creator views on what you own.", "连接券商账户后，这里会显示博主对你持仓的看法。")}
                  </Empty>
                ) : (
                  <>
                    <ul className="divide-y divide-border">
                      {heldCovered.map((ticker) => {
                        const stock = consensus.get(ticker)!;
                        return (
                          <li key={ticker}>
                            <Link
                              href={`/dashboard/research/${encodeURIComponent(ticker)}`}
                              className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <span className="flex min-w-0 items-center gap-2.5">
                                <span aria-hidden><CompanyLogo symbol={ticker} size="sm" /></span>
                                <span className="min-w-0">
                                  <span className="block font-semibold">{ticker}</span>
                                  <span className="block text-xs tabular-nums text-muted-foreground">
                                    {c(`${stock.creator_count} creators`, `${stock.creator_count} 位博主`)}
                                  </span>
                                </span>
                              </span>
                              <OpinionStrength value={stock.avg_score} className="text-[13px]" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    {heldUncovered > 0 && (
                      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                        {c(`${heldUncovered} other holdings have no creator opinions yet.`, `另外 ${heldUncovered} 只持仓暂时没有博主观点。`)}
                      </p>
                    )}
                  </>
                )}
              </Panel>

              <Panel
                title={c("Creators", "博主")}
                action={<TextLink href="/dashboard/youtube-opinions?tab=creators">{c("All", "全部")}</TextLink>}
              >
                <ul className="divide-y divide-border">
                  {[...(dashboard?.creators ?? [])]
                    .sort((a, b) => (b.latest_opinion_at ?? "").localeCompare(a.latest_opinion_at ?? ""))
                    .slice(0, 6)
                    .map((creator) => (
                      <li key={creator.channel_id}>
                        <Link
                          href={`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(creator.channel_id)}`}
                          className="-mx-2 flex min-w-0 items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <CreatorAvatar name={creator.channel_title || creator.channel_id} avatarUrl={creator.channel_avatar_url} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{creator.channel_title || creator.channel_id}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {creator.top_tickers.slice(0, 3).map((stock) => stock.ticker).join("、")}
                            </span>
                          </span>
                          {creator.latest_opinion_at && (
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{dayLabel(creator.latest_opinion_at)}</span>
                          )}
                        </Link>
                      </li>
                    ))}
                </ul>
              </Panel>
            </aside>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
