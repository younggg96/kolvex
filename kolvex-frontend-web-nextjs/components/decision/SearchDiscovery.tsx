"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUpRight, Clock, FileText, Newspaper, X } from "lucide-react";
import { useBriefData } from "@/components/briefs/useBriefData";
import { RedditIcon, XIcon, YouTubeIcon } from "@/components/common/PlatformIcons";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/ui/company-logo";
import { ContentLoading } from "@/components/ui/content-loading";
import { ListCard, ListEmptyState, ListFooterLink, ListRow, ListRows, ListToolbar, listCompactRowClass } from "@/components/ui/list-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import { useCachedResource } from "@/hooks/useCachedResource";
import type { BriefList } from "@/lib/dailyBriefs";
import type { FeedResponse } from "@/lib/newsFeed";
import { isProductFeatureEnabled } from "@/lib/productFeatures";
import type { RedditRanking } from "@/lib/redditOpinions";
import type { SearchHistoryItem } from "@/lib/searchHistory";
import { marketStockHref } from "@/lib/stockLinks";
import { getPublishedAnalyses, publishedAnalysesKey } from "@/lib/tradingAnalysisApi";
import { cn } from "@/lib/utils";
import type { XCreator } from "@/lib/xContentApi";
import type { YouTubeOpinionDashboard } from "@/lib/youtubeOpinionsApi";
import { useCopy, useDayLabel } from "./shared";
import styles from "./search-page.module.css";

const PICK_COUNT = 8;
type Resource<T> = { data?: T; loading: boolean; error: unknown; refresh: () => void };
type Remember = (item: SearchHistoryItem) => void;

function ViewAll({ href, label }: { href: string; label: string }) {
  const c = useCopy();
  return <Link href={href} aria-label={label} className="group flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:text-foreground active:bg-foreground/[0.1] motion-reduce:transition-none">
    {c("View all", "查看全部")}<ArrowUpRight aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" />
  </Link>;
}

function DiscoverySection({ id, title, icon, href, linkLabel, className, children }: { id: string; title: string; icon?: ReactNode; href?: string; linkLabel?: string; className?: string; children: ReactNode }) {
  return <section aria-labelledby={id} className={cn("min-w-0", className)}>
    <header className={styles.sectionHeader}>
      <h2 id={id} className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight">{icon}{title}</h2>
      {href && <ViewAll href={href} label={linkLabel || title} />}
    </header>
    {children}
  </section>;
}

function SourceState({ loading, error, retry, className }: { loading: boolean; error: unknown; retry: () => void; className?: string }) {
  const c = useCopy();
  return <div className={cn("flex min-h-40 items-center justify-center", className)}>
    {loading ? <ContentLoading /> : <ListEmptyState
      title={error ? c("This source is unavailable", "这个来源暂时不可用") : c("Nothing here yet", "暂时还没有内容")}
      description={error ? c("Try again, or explore another source.", "可以重试，或切换到其他来源。") : c("Try another source, or search for a stock above.", "可以切换来源，或在上方搜索股票。")}
      action={error ? <Button type="button" variant="outline" size="sm" onClick={retry}>{c("Retry", "重试")}</Button> : undefined}
      alert={Boolean(error)}
    />}
  </div>;
}

function PartialError({ error, retry }: { error: unknown; retry: () => void }) {
  const c = useCopy();
  if (!error) return null;
  return <p role="status" className="flex flex-wrap items-center gap-x-2 px-2 pt-2 text-xs text-muted-foreground">
    {c("Showing saved content. Refresh failed.", "刷新失败，当前显示已加载内容。")}
    <button type="button" onClick={retry} className="min-h-9 rounded-full px-2 font-medium text-foreground underline underline-offset-4">{c("Retry", "重试")}</button>
  </p>;
}

function TrendingStocks({ youtube, reddit, onRemember }: { youtube: Resource<YouTubeOpinionDashboard>; reddit: Resource<RedditRanking>; onRemember: Remember }) {
  const c = useCopy();
  const [source, setSource] = useState<"youtube" | "reddit">("youtube");
  const resource = source === "youtube" ? youtube : reddit;
  const stocks = useMemo(() => source === "youtube"
    ? [...(youtube.data?.stocks ?? [])].sort((a, b) => b.total_opinions - a.total_opinions).slice(0, PICK_COUNT).map(stock => ({ ticker: stock.ticker, name: stock.company_name || stock.ticker, count: stock.total_opinions }))
    : (reddit.data?.results ?? []).slice(0, PICK_COUNT).map(stock => ({ ticker: stock.ticker, name: stock.name, count: stock.mentions })),
  [source, youtube.data, reddit.data]);
  const href = source === "youtube" ? "/dashboard/youtube-opinions" : "/dashboard/reddit-opinions";
  const metric = source === "youtube" ? c("opinions", "条观点") : c("mentions", "次提及");

  return <DiscoverySection id="search-trending" title={c("Trending stocks", "热议股票")} href={href} linkLabel={source === "youtube" ? c("View all YouTube stocks", "查看全部 YouTube 热议股票") : c("View all Reddit stocks", "查看全部 Reddit 热议股票")}>
    <ListCard>
      <ListToolbar className="mb-3 gap-x-2">
        <SegmentedControl
          label={c("Trending source", "热议来源")}
          semantics="radio"
          size="sm"
          value={source}
          onChange={setSource}
          itemClassName="min-h-9 px-3"
          options={[
            { value: "youtube", label: <span className="flex items-center gap-1.5"><YouTubeIcon className="h-3.5 w-3.5" />YouTube</span>, ariaLabel: "YouTube" },
            { value: "reddit", label: <span className="flex items-center gap-1.5"><RedditIcon className="h-3.5 w-3.5" />Reddit</span>, ariaLabel: "Reddit" },
          ]}
        />
        <span className="pr-1 text-xs text-muted-foreground">{source === "youtube" ? c("By total opinions", "按累计观点数") : c("Past 24 hours", "过去 24 小时")}</span>
      </ListToolbar>
      <div key={source} className={styles.sourcePanel} aria-label={source === "youtube" ? c("YouTube trending stocks", "YouTube 热议股票") : c("Reddit trending stocks", "Reddit 热议股票")}>
        {stocks.length ? <ol className={styles.stockList}>
          {stocks.map((stock, index) => <ListRow key={stock.ticker} className={cn("pr-0", styles.stockItem)} style={{ "--search-row": index } as CSSProperties}>
            <Link href={marketStockHref(stock.ticker)} title={stock.name} onClick={() => onRemember({ title: stock.name, detail: stock.ticker, href: marketStockHref(stock.ticker) })} className={cn(listCompactRowClass, styles.stockLink)}>
              <span aria-hidden className={styles.rank}>{index + 1}</span>
              <span aria-hidden className={styles.stockLogo}><CompanyLogo symbol={stock.ticker} name={stock.name} customSize={32} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{stock.ticker}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{stock.name}</span></span>
              <span className="shrink-0 text-right"><span className="block text-sm font-medium tabular-nums">{stock.count.toLocaleString(c("en-US", "zh-CN"))}</span><span className="mt-1 block text-[0.6875rem] text-muted-foreground">{metric}</span></span>
            </Link>
          </ListRow>)}
        </ol> : <SourceState {...resource} retry={resource.refresh} className="min-h-[22rem] xl:min-h-[26rem]" />}
      </div>
      {stocks.length > 0 && <PartialError error={resource.error} retry={resource.refresh} />}
      <ListFooterLink href={href}>{source === "youtube" ? c("Explore creator opinions", "探索博主的完整观点") : c("Explore Reddit discussions", "查看 Reddit 完整讨论榜")}</ListFooterLink>
    </ListCard>
  </DiscoverySection>;
}

function CreatorPicks({ youtube, x, onRemember }: { youtube: Resource<YouTubeOpinionDashboard>; x: Resource<{ creators: XCreator[] }>; onRemember: Remember }) {
  const c = useCopy();
  const [source, setSource] = useState<"youtube" | "x">("youtube");
  const resource = source === "youtube" ? youtube : x;
  const creators = useMemo(() => source === "youtube"
    ? [...(youtube.data?.creators ?? [])].sort((a, b) => b.total_opinions - a.total_opinions).slice(0, PICK_COUNT).map(creator => ({
      title: creator.channel_title || creator.channel_id,
      detail: creator.channel_handle || "YouTube",
      avatar: creator.channel_avatar_url,
      href: `/dashboard/youtube-opinions?${new URLSearchParams({ tab: "creators", creator: creator.channel_id })}`,
    }))
    : (x.data?.creators ?? []).slice(0, PICK_COUNT).map(creator => ({
      title: creator.display_name || `@${creator.username}`,
      detail: `@${creator.username}`,
      avatar: creator.avatar_url,
      href: `/dashboard/x-opinions?${new URLSearchParams({ author: creator.username })}`,
    })), [source, youtube.data, x.data]);
  const href = source === "youtube" ? "/dashboard/youtube-opinions?tab=creators" : "/dashboard/x-opinions";

  return <DiscoverySection id="search-creators" title={c("Discover creators", "发现创作者")} href={href} linkLabel={c("View all creators", "查看全部创作者")}>
    <ListCard>
      <ListToolbar className="mb-3 min-h-11">
        <SegmentedControl
          label={c("Creator platform", "创作者平台")}
          semantics="radio"
          size="sm"
          value={source}
          onChange={setSource}
          itemClassName="min-h-9 px-3"
          options={[
            { value: "youtube", label: <span className="flex items-center gap-1.5"><YouTubeIcon className="h-3.5 w-3.5" />YouTube</span>, ariaLabel: "YouTube" },
            { value: "x", label: <span className="flex items-center gap-1.5"><XIcon className="h-3 w-3" /><span>{c("Creators", "创作者")}</span></span>, ariaLabel: c("X creators", "X 创作者") },
          ]}
        />
      </ListToolbar>
      <div key={source} className={styles.sourcePanel}>
        {creators.length ? <ListRows className={styles.creatorList}>
          {creators.map(creator => <ListRow key={creator.href} className="pr-0">
            <Link href={creator.href} title={`${creator.title} ${creator.detail}`} onClick={() => onRemember({ title: creator.title, detail: creator.detail, href: creator.href })} className={cn(listCompactRowClass, styles.creatorLink, styles.rowLink, "w-full")}>
              <CreatorAvatar name={creator.title} avatarUrl={creator.avatar} size="sm" className="h-8 w-8" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{creator.title}</span><span className="block truncate text-[0.6875rem] text-muted-foreground">{creator.detail}</span></span>
              <ArrowUpRight aria-hidden className={cn("h-3.5 w-3.5", styles.rowArrow)} />
            </Link>
          </ListRow>)}
        </ListRows> : <SourceState {...resource} retry={resource.refresh} className="min-h-[22rem] xl:min-h-[26rem]" />}
      </div>
      {creators.length > 0 && <PartialError error={resource.error} retry={resource.refresh} />}
      <ListFooterLink href={href}>{source === "youtube" ? c("Browse YouTube creators", "浏览 YouTube 创作者") : c("Browse X creators", "浏览 X 创作者")}</ListFooterLink>
    </ListCard>
  </DiscoverySection>;
}

function ResearchPicks({ onRemember }: { onRemember: Remember }) {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const params = { limit: 4 };
  const resource = useCachedResource(publishedAnalysesKey(params), signal => getPublishedAnalyses(params, signal), { ttl: 60_000 });
  const reports = resource.data?.items ?? [];
  return <DiscoverySection id="search-research" title={c("Latest research", "最新研究")} icon={<FileText aria-hidden className="h-4 w-4 text-muted-foreground" />} href="/dashboard/ai-research" linkLabel={c("View all research", "查看全部研究")}>
    <ListCard>
      {reports.length ? <ListRows>{reports.map(report => {
        const item = { href: `/dashboard/trading-analysis/explore/${encodeURIComponent(report.id)}`, title: c(`${report.ticker} research report`, `${report.ticker} 研究报告`), detail: dayLabel(report.trade_date) };
        return <ListRow key={report.id} className="pr-0">
          <Link href={item.href} onClick={() => onRemember(item)} className={cn(listCompactRowClass, styles.rowLink, "min-h-[4.5rem] w-full gap-3 px-2")}>
            <span aria-hidden><CompanyLogo symbol={report.ticker} customSize={32} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{report.ticker}</span><span className="mt-0.5 block text-xs text-muted-foreground">{c("AI research report", "AI 研究报告")}</span></span>
            <span className="shrink-0 text-xs text-muted-foreground">{item.detail}</span>
            <ArrowUpRight aria-hidden className={cn("h-4 w-4", styles.rowArrow)} />
          </Link>
        </ListRow>;
      })}</ListRows> : <SourceState {...resource} retry={resource.refresh} className="min-h-72" />}
      {reports.length > 0 && <PartialError error={resource.error} retry={resource.refresh} />}
    </ListCard>
  </DiscoverySection>;
}

function NewsPicks() {
  const c = useCopy();
  const resource = useCachedResource<FeedResponse>("/api/news", async signal => {
    const response = await fetch("/api/news", { signal, cache: "no-store" });
    if (!response.ok) throw new Error("News unavailable");
    const result: FeedResponse = await response.json();
    if (!Array.isArray(result.articles)) throw new Error("Invalid feed");
    return result;
  }, { ttl: 30_000, maxAge: 5 * 60_000 });
  const articles = (resource.data?.articles ?? []).filter(article => /^https?:\/\//.test(article.link)).sort((a, b) => (b.publish_time ?? 0) - (a.publish_time ?? 0)).slice(0, 3);
  return <DiscoverySection id="search-news" title={c("Latest news", "最新新闻")} icon={<Newspaper aria-hidden className="h-4 w-4 text-muted-foreground" />} href="/dashboard/news" linkLabel={c("View all news", "查看全部新闻")}>
    <ListCard>
      {articles.length ? <ListRows>{articles.map(article => <ListRow key={article.id} className="pr-0">
        <Link href={article.link} target="_blank" rel="noopener noreferrer" className={cn(listCompactRowClass, styles.rowLink, "min-h-24 w-full items-start gap-3 px-2 py-4")}>
          <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm leading-relaxed">{article.title}</span><span className="mt-1.5 block text-xs text-muted-foreground">{article.publisher || c("News source", "新闻来源")}</span></span>
          <ArrowUpRight aria-hidden className={cn("mt-1 h-4 w-4", styles.rowArrow)} />
        </Link>
      </ListRow>)}</ListRows> : <SourceState {...resource} retry={resource.refresh} className="min-h-72" />}
      {articles.length > 0 && <PartialError error={resource.error} retry={resource.refresh} />}
    </ListCard>
  </DiscoverySection>;
}

function BriefPicks({ onRemember }: { onRemember: Remember }) {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const resource = useBriefData<BriefList>("?page=1");
  const briefs = (resource.data?.items ?? []).slice(0, 2);
  if (!resource.loading && !briefs.length && !resource.error) return null;
  return <DiscoverySection id="search-briefs" title={c("Latest briefs", "最新日报")} href="/dashboard/briefs" linkLabel={c("View all briefs", "查看全部日报")} className={styles.briefs}>
    <ListCard>
      {briefs.length ? <ListRows className={styles.briefList}>{briefs.map(brief => {
        const item = { href: `/dashboard/briefs/${encodeURIComponent(brief.id)}`, title: brief.headline || brief.title, detail: dayLabel(brief.brief_date) };
        return <ListRow key={brief.id} className="pr-0"><Link href={item.href} onClick={() => onRemember(item)} className={cn(listCompactRowClass, styles.rowLink, "min-h-24 w-full items-start gap-3 px-2 py-4")}>
          <span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm font-medium leading-relaxed">{item.title}</span><span className="mt-2 block text-xs text-muted-foreground">{item.detail}</span></span>
          <ArrowUpRight aria-hidden className={cn("mt-1 h-4 w-4", styles.rowArrow)} />
        </Link></ListRow>;
      })}</ListRows> : <SourceState {...resource} retry={resource.retry} />}
      {briefs.length > 0 && <PartialError error={resource.error} retry={resource.retry} />}
    </ListCard>
  </DiscoverySection>;
}

export default function SearchDiscovery({ youtube, reddit, x, history, onHistoryChange, onRemember }: { youtube: Resource<YouTubeOpinionDashboard>; reddit: Resource<RedditRanking>; x: Resource<{ creators: XCreator[] }>; history: SearchHistoryItem[]; onHistoryChange: (items: SearchHistoryItem[]) => void; onRemember: Remember }) {
  const c = useCopy();
  return <div className={styles.discovery}>
    {history.length > 0 && <section aria-labelledby="search-recent" className="mb-8">
      <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
        <h2 id="search-recent" className="text-sm font-medium text-muted-foreground">{c("Recent searches", "最近搜索")}</h2>
        <button type="button" onClick={() => onHistoryChange([])} className="min-h-9 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none">{c("Clear", "清除")}</button>
      </div>
      <ul className="flex flex-wrap gap-2">{history.map(item => <li key={item.href} className={cn("flex min-w-0 items-center rounded-full border border-border", styles.recentItem)}>
        <Link href={item.href} title={item.title} onClick={() => onRemember(item)} className="flex min-h-11 min-w-0 items-center gap-2 rounded-full py-2 pl-3 pr-1 text-sm transition-colors hover:bg-foreground/[0.06] active:bg-foreground/[0.1] motion-reduce:transition-none">
          <Clock aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{item.title}</span>
        </Link>
        <button type="button" aria-label={c(`Remove ${item.title} from recent searches`, `从最近搜索中移除 ${item.title}`)} onClick={() => onHistoryChange(history.filter(existing => existing.href !== item.href))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground motion-reduce:transition-none"><X aria-hidden className="h-3.5 w-3.5" /></button>
      </li>)}</ul>
    </section>}
    {isProductFeatureEnabled("youtubeOpinions") && <div className={styles.discoveryGrid}>
      <TrendingStocks youtube={youtube} reddit={reddit} onRemember={onRemember} />
      <CreatorPicks youtube={youtube} x={x} onRemember={onRemember} />
    </div>}
    <div className={styles.latestGrid}>
      {isProductFeatureEnabled("tradingAnalysis") && <ResearchPicks onRemember={onRemember} />}
      {isProductFeatureEnabled("news") && <NewsPicks />}
      {isProductFeatureEnabled("briefs") && <BriefPicks onRemember={onRemember} />}
    </div>
  </div>;
}
