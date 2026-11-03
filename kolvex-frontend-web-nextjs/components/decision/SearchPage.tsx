"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, Clock, Plus, Search, X } from "lucide-react";
import { useBriefData } from "@/components/briefs/useBriefData";
import { XIcon, YouTubeIcon } from "@/components/common/PlatformIcons";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanyLogo from "@/components/ui/company-logo";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { BriefList } from "@/lib/dailyBriefs";
import { validTicker } from "@/lib/decision";
import type { FeedResponse } from "@/lib/newsFeed";
import { isProductFeatureEnabled } from "@/lib/productFeatures";
import type { RedditRanking } from "@/lib/redditOpinions";
import { addToSearchHistory, readSearchHistory, writeSearchHistory, type SearchHistoryItem } from "@/lib/searchHistory";
import { marketStockHref } from "@/lib/stockLinks";
import { getPublishedAnalyses, publishedAnalysesKey, type TradingAnalysis } from "@/lib/tradingAnalysisApi";
import { cn } from "@/lib/utils";
import { xRequest, type XCreator } from "@/lib/xContentApi";
import { getYouTubeOpinionDashboard } from "@/lib/youtubeOpinionsApi";
import { useCopy, useDayLabel } from "./shared";

type Filter = "all" | "stocks" | "creators" | "research";
type StockResult = { ticker: string; name: string };

const PILL_COUNT = 8;
const NEWS_COUNT = 3;
const BRIEF_COUNT = 2;
const RESULT_LIMIT = 8;
const RESEARCH_LIMIT = 5;
const RESEARCH_DEBOUNCE_MS = 250;

/** Lower scores list first; null means the stock doesn't match. */
function stockMatchScore({ ticker, name }: StockResult, query: string) {
  const symbol = ticker.toLowerCase();
  const company = name.toLowerCase();
  if (symbol === query) return 0;
  if (symbol.startsWith(query)) return 1;
  if (company.startsWith(query)) return 2;
  if (company.includes(` ${query}`)) return 3;
  return company.includes(query) ? 4 : null;
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** One content source's picks; a source with nothing to show leaves no empty heading behind. */
function PickGroup({ title, href, loading, empty, children }: { title: string; href: string; loading: boolean; empty: boolean; children: ReactNode }) {
  const c = useCopy();
  if (!loading && empty) return null;
  return (
    <Section
      title={title}
      action={<Link href={href} className="-my-2 flex h-10 shrink-0 items-center rounded-full px-2 text-sm text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none">{c("View all", "查看全部")}</Link>}
    >
      {loading && empty ? <Skeleton className="h-11 w-full rounded-full" /> : children}
    </Section>
  );
}

function PillRow({ children }: { children: ReactNode }) {
  return <ul className="-mx-[16px] flex gap-2 overflow-x-auto px-[16px] py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">{children}</ul>;
}

function Pill({ href, label, title, symbol, avatar, onOpen }: { href: string; label: string; title?: string; symbol?: string; avatar?: ReactNode; onOpen: () => void }) {
  return (
    <li className="shrink-0">
      <Link
        href={href}
        title={title}
        onClick={onOpen}
        className={cn("flex h-11 max-w-[240px] items-center gap-2 rounded-full border border-border bg-muted pr-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.1] motion-reduce:transition-none", symbol || avatar ? "pl-1.5" : "pl-4")}
      >
        {symbol && <CompanyLogo symbol={symbol} name={title} customSize={28} />}
        {avatar}
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}

function ResearchPicks({ onOpen }: { onOpen: (item: SearchHistoryItem) => void }) {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const params = { limit: PILL_COUNT };
  const resource = useCachedResource(publishedAnalysesKey(params), (signal) => getPublishedAnalyses(params, signal), { ttl: 60_000 });
  const reports = resource.data?.items ?? [];
  return (
    <PickGroup title={c("Latest research", "最新研究")} href="/dashboard/ai-research" loading={resource.loading} empty={!reports.length}>
      <PillRow>
        {reports.map((report) => {
          const item = { href: `/dashboard/trading-analysis/explore/${encodeURIComponent(report.id)}`, title: c(`${report.ticker} research report`, `${report.ticker} 研究报告`), detail: dayLabel(report.trade_date) };
          return <Pill key={report.id} href={item.href} label={item.title} title={report.ticker} symbol={report.ticker} onOpen={() => onOpen(item)} />;
        })}
      </PillRow>
    </PickGroup>
  );
}

function NewsPicks() {
  const c = useCopy();
  const resource = useCachedResource<FeedResponse>("/api/news", async (signal) => {
    const response = await fetch("/api/news", { signal, cache: "no-store" });
    if (!response.ok) throw new Error("News unavailable");
    const result: FeedResponse = await response.json();
    if (!Array.isArray(result.articles)) throw new Error("Invalid feed");
    return result;
  }, { ttl: 30_000, maxAge: 5 * 60_000 });
  const articles = (resource.data?.articles ?? [])
    .filter((article) => /^https?:\/\//.test(article.link))
    .sort((a, b) => (b.publish_time ?? 0) - (a.publish_time ?? 0))
    .slice(0, NEWS_COUNT);
  return (
    <PickGroup title={c("Latest news", "最新新闻")} href="/dashboard/news" loading={resource.loading} empty={!articles.length}>
      {articles.map((article) => <ResultRow key={article.id} href={article.link} external title={article.title} detail={article.publisher ?? c("News source", "新闻来源")} />)}
    </PickGroup>
  );
}

function BriefPicks({ onOpen }: { onOpen: (item: SearchHistoryItem) => void }) {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const resource = useBriefData<BriefList>("?page=1");
  const briefs =(resource.data?.items ?? []).slice(0, BRIEF_COUNT);
  return (
    <PickGroup title={c("Latest briefs", "最新日报")} href="/dashboard/briefs" loading={resource.loading} empty={!briefs.length}>
      {briefs.map((brief) => {
        const item = { href: `/dashboard/briefs/${encodeURIComponent(brief.id)}`, title: brief.headline || brief.title, detail: dayLabel(brief.brief_date) };
        return <ResultRow key={brief.id} {...item} onOpen={() => onOpen(item)} />;
      })}
    </PickGroup>
  );
}

function ResultRow({ href, title, detail, trailing, onOpen, external }: { href: string; title: string; detail: string; trailing?: ReactNode; onOpen?: () => void; external?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-border last:border-b-0">
      <Link href={href} onClick={onOpen} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="min-w-0 flex-1 py-3.5 transition-opacity hover:opacity-70 motion-reduce:transition-none">
        <span className="block truncate text-base text-foreground">{title}</span>
        <span className="mt-0.5 block truncate text-sm text-muted-foreground">{detail}</span>
      </Link>
      {trailing}
    </div>
  );
}

function WatchToggle({ ticker }: { ticker: string }) {
  const c = useCopy();
  const { watchlist, canEdit, toggle } = useWatchlist();
  const watched = watchlist.includes(ticker);
  return (
    <button
      type="button"
      disabled={!canEdit}
      aria-pressed={watched}
      aria-label={watched ? c(`Remove ${ticker} from watchlist`, `从自选移除 ${ticker}`) : c(`Add ${ticker} to watchlist`, `将 ${ticker} 加入自选`)}
      onClick={() => toggle(ticker)}
      className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
    >
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary", watched ? "bg-primary text-primary-foreground" : "text-primary")}>
        {watched ? <Check aria-hidden className="h-4 w-4" strokeWidth={3} /> : <Plus aria-hidden className="h-4 w-4" strokeWidth={2.5} />}
      </span>
    </button>
  );
}

export default function SearchPage() {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const router = useRouter();
  const { error: watchlistError, userId } = useWatchlist();
  const input = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [value, setValue] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [submitFailed, setSubmitFailed] = useState(false);
  const [research, setResearch] = useState<{ ticker: string; items: TradingAnalysis[] } | null>(null);

  const opinions = useCachedResource("/api/youtube-opinions/dashboard?limit=12", () => getYouTubeOpinionDashboard({ limit: 12 }), { ttl: 60_000 });
  const reddit = useCachedResource("/api/reddit-opinions?community=all-stocks", async (signal) => {
    const response = await fetch("/api/reddit-opinions?community=all-stocks", { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Reddit ranking request failed");
    return (await response.json()) as RedditRanking;
  }, { ttl: 60_000 });
  const xCreators = useCachedResource("/api/x-content/creators", (signal) => xRequest<{ creators: XCreator[] }>("creators", { signal }), { ttl: 60_000 });

  useEffect(() => {
    setHistory(userId ? readSearchHistory(userId) : []);
  }, [userId]);

  function saveHistory(next: SearchHistoryItem[]) {
    setHistory(next);
    if (userId) writeSearchHistory(userId, next);
  }
  const remember = (item: SearchHistoryItem) => saveHistory(addToSearchHistory(history, item));
  const rememberStock = ({ ticker, name }: StockResult) => remember({ title: name, detail: ticker, href: marketStockHref(ticker) });

  const query = value.trim().toLowerCase();
  const catalogue = useMemo(() => {
    const stocks = new Map<string, StockResult>();
    for (const stock of opinions.data?.stocks ?? []) stocks.set(stock.ticker, { ticker: stock.ticker, name: stock.company_name || stock.ticker });
    for (const stock of reddit.data?.results ?? []) if (!stocks.has(stock.ticker)) stocks.set(stock.ticker, { ticker: stock.ticker, name: stock.name });
    return [...stocks.values()];
  }, [opinions.data, reddit.data]);

  const stockResults = useMemo(() => {
    if (!query) return [];
    const matches = catalogue
      .map((stock) => ({ stock, score: stockMatchScore(stock, query) }))
      .filter((match): match is { stock: StockResult; score: number } => match.score !== null)
      .sort((a, b) => a.score - b.score)
      .map((match) => match.stock);
    // Tickers outside the catalogue still open directly: coverage doesn't limit lookup.
    const typed = query.toUpperCase();
    if (validTicker(typed) && !matches.some((stock) => stock.ticker === typed)) matches.unshift({ ticker: typed, name: typed });
    return matches.slice(0, RESULT_LIMIT);
  }, [catalogue, query]);

  const creatorResults = useMemo(() => {
    if (!query) return [];
    const youtube = (opinions.data?.creators ?? [])
      .filter((creator) => [creator.channel_title, creator.channel_handle].some((name) => name?.toLowerCase().includes(query)))
      .map((creator) => ({
        key: `youtube:${creator.channel_id}`,
        title: creator.channel_title || creator.channel_id,
        detail: creator.channel_handle || "YouTube",
        href: `/dashboard/youtube-opinions?${new URLSearchParams({ tab: "creators", creator: creator.channel_id })}`,
        Icon: YouTubeIcon,
      }));
    const x = (xCreators.data?.creators ?? [])
      .filter((creator) => creator.display_name?.toLowerCase().includes(query) || creator.username.toLowerCase().includes(query))
      .map((creator) => ({
        key: `x:${creator.username}`,
        title: creator.display_name || `@${creator.username}`,
        detail: `@${creator.username}`,
        href: `/dashboard/x-opinions?${new URLSearchParams({ author: creator.username })}`,
        Icon: XIcon,
      }));
    return [...youtube, ...x].slice(0, RESULT_LIMIT);
  }, [opinions.data, xCreators.data, query]);

  const youtubePicks = useMemo(
    () => [...(opinions.data?.stocks ?? [])].sort((a, b) => b.total_opinions - a.total_opinions).slice(0, PILL_COUNT),
    [opinions.data],
  );
  const youtubeCreatorPicks = useMemo(
    () => [...(opinions.data?.creators ?? [])].sort((a, b) => b.total_opinions - a.total_opinions).slice(0, PILL_COUNT),
    [opinions.data],
  );
  const redditPicks = (reddit.data?.results ?? []).slice(0, PILL_COUNT);
  const xPicks = (xCreators.data?.creators ?? []).slice(0, PILL_COUNT);

  const topTicker = stockResults[0]?.ticker;
  useEffect(() => {
    if (!topTicker) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getPublishedAnalyses({ ticker: topTicker, limit: RESEARCH_LIMIT }, controller.signal)
        .then((response) => setResearch({ ticker: topTicker, items: response.items }))
        .catch(() => { if (!controller.signal.aborted) setResearch({ ticker: topTicker, items: [] }); });
    }, RESEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [topTicker]);
  const researchResults = research && research.ticker === topTicker ? research.items : [];

  const catalogueLoading = opinions.loading || reddit.loading || xCreators.loading;
  const catalogueFailed = Boolean(opinions.error || reddit.error || xCreators.error);
  const showStocks = (filter === "all" || filter === "stocks") && stockResults.length > 0;
  const showCreators = (filter === "all" || filter === "creators") && creatorResults.length > 0;
  const showResearch = (filter === "all" || filter === "research") && researchResults.length > 0;
  const hasResults = showStocks || showCreators || showResearch;

  const filters: [Filter, string][] = [
    ["all", c("All", "全部")],
    ["stocks", c("Stocks", "股票")],
    ["creators", c("Creators", "创作者")],
    ["research", c("AI research", "AI 研究")],
  ];

  function changeValue(next: string) {
    setValue(next);
    setSubmitFailed(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (stockResults[0]) {
      rememberStock(stockResults[0]);
      router.push(marketStockHref(stockResults[0].ticker));
    } else if (query) setSubmitFailed(true);
  }

  return (
    <DashboardLayout title={c("Search", "搜索")}>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full min-w-0 max-w-2xl px-[16px] pb-28 pt-4 md:px-8 md:pt-8">
          <div className="flex items-center gap-3">
            <form role="search" noValidate onSubmit={submit} className="min-w-0 flex-1">
              <div className="relative flex h-12 items-center rounded-full border border-border bg-muted transition-colors focus-within:border-foreground/30 motion-reduce:transition-none">
                <Search aria-hidden className="pointer-events-none absolute left-4 h-5 w-5 text-foreground" />
                <input
                  ref={input}
                  autoFocus
                  value={value}
                  onChange={(event) => changeValue(event.target.value)}
                  aria-label={c("Search stocks and creators", "搜索股票和创作者")}
                  aria-invalid={submitFailed || undefined}
                  placeholder={c("Stocks, companies, creators", "搜索股票、公司、创作者")}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  maxLength={40}
                  className="h-full w-full rounded-full bg-transparent pl-12 pr-11 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:bg-transparent focus-visible:no-underline focus-visible:outline-none"
                />
                {value && (
                  <button
                    type="button"
                    aria-label={c("Clear search", "清空搜索")}
                    onClick={() => { changeValue(""); input.current?.focus(); }}
                    className="absolute right-0.5 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground"
                  >
                    <X aria-hidden className="h-4 w-4" />
                  </button>
                )}
              </div>
            </form>
            <button type="button" onClick={() => router.back()} className="-mr-1 h-11 shrink-0 rounded-full px-1 text-base text-foreground">
              {c("Cancel", "取消")}
            </button>
          </div>

          {submitFailed && <p role="alert" className="mt-3 pl-4 text-sm text-negative">{c("No matching stock. Try a ticker like AAPL or BRK-B.", "没有匹配的股票。试试股票代码，如 AAPL、BRK-B。")}</p>}
          {watchlistError && <p role="alert" className="mt-3 pl-4 text-sm text-negative">{c("Your watchlist couldn't be updated. Try again.", "自选更新失败，请重试。")}</p>}

          {!query ? (
            <>
              {history.length > 0 && (
                <Section
                  title={c("Recent searches", "最近搜索")}
                  action={<button type="button" onClick={() => saveHistory([])} className="-my-2 h-10 rounded-full px-2 text-sm text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none">{c("Clear", "清除")}</button>}
                >
                  <ul>
                    {history.map((item) => (
                      <li key={item.href} className="flex items-center gap-3">
                        <Clock aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Link href={item.href} onClick={() => remember(item)} className="flex min-h-11 min-w-0 flex-1 items-baseline gap-2 py-2.5 transition-opacity hover:opacity-70 motion-reduce:transition-none">
                          <span className="truncate text-base text-foreground">{item.title}</span>
                          {item.detail !== item.title && <span className="shrink-0 text-sm text-muted-foreground">{item.detail}</span>}
                        </Link>
                        <button
                          type="button"
                          aria-label={c(`Remove ${item.title} from recent searches`, `从最近搜索中移除 ${item.title}`)}
                          onClick={() => saveHistory(history.filter((existing) => existing.href !== item.href))}
                          className="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
                        >
                          <X aria-hidden className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {isProductFeatureEnabled("youtubeOpinions") && (
                <>
                  <PickGroup title={c("Most discussed by creators", "YouTube 博主热议")} href="/dashboard/youtube-opinions" loading={opinions.loading} empty={!youtubePicks.length && !youtubeCreatorPicks.length}>
                    <div className="space-y-1">
                      {youtubePicks.length > 0 && (
                        <PillRow>
                          {youtubePicks.map((stock) => {
                            const pick = { ticker: stock.ticker, name: stock.company_name || stock.ticker };
                            return <Pill key={stock.ticker} href={marketStockHref(stock.ticker)} label={stock.ticker} title={pick.name} symbol={stock.ticker} onOpen={() => rememberStock(pick)} />;
                          })}
                        </PillRow>
                      )}
                      {youtubeCreatorPicks.length > 0 && (
                        <PillRow>
                          {youtubeCreatorPicks.map((creator) => {
                            const name = creator.channel_title || creator.channel_id;
                            const item = { title: name, detail: creator.channel_handle || "YouTube", href: `/dashboard/youtube-opinions?${new URLSearchParams({ tab: "creators", creator: creator.channel_id })}` };
                            return <Pill key={creator.channel_id} href={item.href} label={name} title={item.detail} avatar={<CreatorAvatar name={name} avatarUrl={creator.channel_avatar_url} size="sm" />} onOpen={() => remember(item)} />;
                          })}
                        </PillRow>
                      )}
                    </div>
                  </PickGroup>
                  <PickGroup title={c("Most discussed on Reddit", "Reddit 讨论最热")} href="/dashboard/reddit-opinions" loading={reddit.loading} empty={!redditPicks.length}>
                    <PillRow>
                      {redditPicks.map((stock) => (
                        <Pill key={stock.ticker} href={marketStockHref(stock.ticker)} label={stock.ticker} title={stock.name} symbol={stock.ticker} onOpen={() => rememberStock(stock)} />
                      ))}
                    </PillRow>
                  </PickGroup>
                  <PickGroup title={c("X creators", "X 创作者")} href="/dashboard/x-opinions" loading={xCreators.loading} empty={!xPicks.length}>
                    <PillRow>
                      {xPicks.map((creator) => {
                        const item = { title: creator.display_name || `@${creator.username}`, detail: `@${creator.username}`, href: `/dashboard/x-opinions?${new URLSearchParams({ author: creator.username })}` };
                        return <Pill key={creator.username} href={item.href} label={item.title} title={item.detail} onOpen={() => remember(item)} />;
                      })}
                    </PillRow>
                  </PickGroup>
                </>
              )}
              {isProductFeatureEnabled("tradingAnalysis") && <ResearchPicks onOpen={remember} />}
              {isProductFeatureEnabled("news") && <NewsPicks />}
              {isProductFeatureEnabled("briefs") && <BriefPicks onOpen={remember} />}
            </>
          ) : (
            <>
              <div role="group" aria-label={c("Filter results", "筛选结果")} className="-mx-[16px] mt-4 flex gap-1 overflow-x-auto px-[16px] [scrollbar-width:none] md:mx-0 md:px-0">
                {filters.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                    className={cn("h-9 shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors motion-reduce:transition-none", filter === key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {showStocks && (
                <Section title={c("Stocks", "股票")}>
                  {stockResults.map((stock) => (
                    <ResultRow
                      key={stock.ticker}
                      href={marketStockHref(stock.ticker)}
                      title={stock.name}
                      detail={stock.name === stock.ticker ? c("Open stock page", "打开股票页") : stock.ticker}
                      onOpen={() => rememberStock(stock)}
                      trailing={<WatchToggle ticker={stock.ticker} />}
                    />
                  ))}
                </Section>
              )}
              {showCreators && (
                <Section title={c("Creators", "创作者")}>
                  {creatorResults.map(({ key, Icon, ...creator }) => (
                    <ResultRow key={key} {...creator} onOpen={() => remember(creator)} trailing={<Icon aria-hidden className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />} />
                  ))}
                </Section>
              )}
              {showResearch && (
                <Section title={c("AI research", "AI 研究")}>
                  {researchResults.map((report) => {
                    const item = { href: `/dashboard/trading-analysis/explore/${encodeURIComponent(report.id)}`, title: c(`${report.ticker} research report`, `${report.ticker} 研究报告`), detail: dayLabel(report.trade_date) };
                    return <ResultRow key={report.id} {...item} onOpen={() => remember(item)} />;
                  })}
                </Section>
              )}

              {catalogueLoading && !hasResults && <Skeleton className="mt-7 h-48 w-full rounded-2xl" />}
              {!catalogueLoading && !hasResults && (
                <p className="mt-10 text-center text-sm text-muted-foreground">
                  {filter === "all"
                    ? c(`Nothing found for “${value.trim()}”. Try a ticker or company name.`, `没有找到“${value.trim()}”。试试股票代码或公司名称。`)
                    : c("Nothing in this category. Switch to All to see other results.", "这个分类下没有结果，切换到“全部”看看其他内容。")}
                </p>
              )}
              {catalogueFailed && <p className="mt-6 text-sm text-muted-foreground">{c("Some sources are unavailable, so results may be incomplete.", "部分来源暂时不可用，结果可能不完整。")}</p>}
            </>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
