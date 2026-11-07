"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUpRight, Search, Star, X } from "lucide-react";
import { XIcon, YouTubeIcon } from "@/components/common/PlatformIcons";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/ui/company-logo";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { ListCard, ListEmptyState, ListRow, ListRows, listRowTargetClass } from "@/components/ui/list-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useWatchlist } from "@/hooks/useWatchlist";
import { validTicker } from "@/lib/decision";
import type { RedditRanking } from "@/lib/redditOpinions";
import { addToSearchHistory, readSearchHistory, writeSearchHistory, type SearchHistoryItem } from "@/lib/searchHistory";
import { marketStockHref } from "@/lib/stockLinks";
import { getPublishedAnalyses, type TradingAnalysis } from "@/lib/tradingAnalysisApi";
import { cn } from "@/lib/utils";
import { xRequest, type XCreator } from "@/lib/xContentApi";
import { getYouTubeOpinionDashboard } from "@/lib/youtubeOpinionsApi";
import SearchDiscovery from "./SearchDiscovery";
import { useCopy, useDayLabel } from "./shared";
import styles from "./search-page.module.css";

type Filter = "all" | "stocks" | "creators" | "research";
type StockResult = { ticker: string; name: string };
const RESULT_LIMIT = 8;
const RESEARCH_LIMIT = 5;
const RESEARCH_DEBOUNCE_MS = 300;

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-7">
    <h2 className="mb-3 text-lg font-semibold">{title}</h2>
    <ListCard><ListRows>{children}</ListRows></ListCard>
  </section>;
}

function ResultRow({ href, title, detail, leading, trailing, onOpen }: { href: string; title: string; detail: string; leading?: ReactNode; trailing?: ReactNode; onOpen?: () => void }) {
  return <ListRow>
    <Link href={href} onClick={onOpen} className={cn(listRowTargetClass, styles.rowLink, "flex gap-3")}>
      {leading}
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{detail}</span></span>
      <ArrowUpRight aria-hidden className={cn("h-4 w-4", styles.rowArrow)} />
    </Link>
    {trailing}
  </ListRow>;
}

function WatchToggle({ ticker }: { ticker: string }) {
  const c = useCopy();
  const { watchlist, canEdit, toggle } = useWatchlist();
  const watched = watchlist.includes(ticker);
  return <button
    type="button"
    disabled={!canEdit}
    aria-pressed={watched}
    aria-label={watched ? c(`Remove ${ticker} from watchlist`, `从自选移除 ${ticker}`) : c(`Add ${ticker} to watchlist`, `将 ${ticker} 加入自选`)}
    onClick={() => toggle(ticker)}
    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.06] active:bg-foreground/[0.1] disabled:opacity-40 motion-reduce:transition-none"
  >
    <Star aria-hidden className={cn("h-4 w-4", watched && "fill-current")} />
  </button>;
}

export default function SearchPage() {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const router = useRouter();
  const { error: watchlistError, userId } = useWatchlist();
  const input = useRef<HTMLInputElement>(null);
  const composition = useRef(false);
  const [composing, setComposing] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [value, setValue] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [submitFailed, setSubmitFailed] = useState(false);
  const [research, setResearch] = useState<{ ticker: string; items: TradingAnalysis[]; failed?: boolean } | null>(null);
  const [researchAttempt, setResearchAttempt] = useState(0);

  const opinions = useCachedResource("/api/youtube-opinions/dashboard?limit=12", () => getYouTubeOpinionDashboard({ limit: 12 }), { ttl: 60_000 });
  const reddit = useCachedResource("/api/reddit-opinions?community=all-stocks", async signal => {
    const response = await fetch("/api/reddit-opinions?community=all-stocks", { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Reddit ranking request failed");
    return (await response.json()) as RedditRanking;
  }, { ttl: 60_000 });
  const xCreators = useCachedResource("/api/x-content/creators", signal => xRequest<{ creators: XCreator[] }>("creators", { signal }), { ttl: 60_000 });

  useEffect(() => {
    setHistory(userId ? readSearchHistory(userId) : []);
  }, [userId]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) input.current?.focus();
  }, []);

  function saveHistory(next: SearchHistoryItem[]) {
    setHistory(next);
    if (userId) writeSearchHistory(userId, next);
  }
  const remember = (item: SearchHistoryItem) => saveHistory(addToSearchHistory(history, item));
  const rememberStock = ({ ticker, name }: StockResult) => remember({ title: name, detail: ticker, href: marketStockHref(ticker) });

  const query = searchValue.trim().toLowerCase();
  const catalogue = useMemo(() => {
    const stocks = new Map<string, StockResult>();
    for (const stock of opinions.data?.stocks ?? []) stocks.set(stock.ticker, { ticker: stock.ticker, name: stock.company_name || stock.ticker });
    for (const stock of reddit.data?.results ?? []) if (!stocks.has(stock.ticker)) stocks.set(stock.ticker, { ticker: stock.ticker, name: stock.name });
    return [...stocks.values()];
  }, [opinions.data, reddit.data]);

  const stockResults = useMemo(() => {
    if (!query) return [];
    const matches = catalogue
      .map(stock => ({ stock, score: stockMatchScore(stock, query) }))
      .filter((match): match is { stock: StockResult; score: number } => match.score !== null)
      .sort((a, b) => a.score - b.score)
      .map(match => match.stock);
    // Tickers outside the catalogue still open directly: coverage doesn't limit lookup.
    const typed = query.toUpperCase();
    if (validTicker(typed) && !matches.some(stock => stock.ticker === typed)) matches.unshift({ ticker: typed, name: typed });
    return matches.slice(0, RESULT_LIMIT);
  }, [catalogue, query]);

  const creatorResults = useMemo(() => {
    if (!query) return [];
    const youtube = (opinions.data?.creators ?? [])
      .filter(creator => [creator.channel_title, creator.channel_handle].some(name => name?.toLowerCase().includes(query)))
      .map(creator => ({
        key: `youtube:${creator.channel_id}`,
        title: creator.channel_title || creator.channel_id,
        detail: creator.channel_handle || "YouTube",
        avatar: creator.channel_avatar_url,
        href: `/dashboard/youtube-opinions?${new URLSearchParams({ tab: "creators", creator: creator.channel_id })}`,
        Icon: YouTubeIcon,
      }));
    const x = (xCreators.data?.creators ?? [])
      .filter(creator => creator.display_name?.toLowerCase().includes(query) || creator.username.toLowerCase().includes(query))
      .map(creator => ({
        key: `x:${creator.username}`,
        title: creator.display_name || `@${creator.username}`,
        detail: `@${creator.username}`,
        avatar: creator.avatar_url,
        href: `/dashboard/x-opinions?${new URLSearchParams({ author: creator.username })}`,
        Icon: XIcon,
      }));
    return [...youtube, ...x].slice(0, RESULT_LIMIT);
  }, [opinions.data, xCreators.data, query]);

  const topTicker = stockResults[0]?.ticker;
  useEffect(() => {
    if (!topTicker || composing) return;
    const controller = new AbortController();
    let timeout: number | undefined;
    const timer = window.setTimeout(() => {
      timeout = window.setTimeout(() => {
        controller.abort();
        setResearch({ ticker: topTicker, items: [], failed: true });
      }, 20_000);
      getPublishedAnalyses({ ticker: topTicker, limit: RESEARCH_LIMIT }, controller.signal)
        .then(response => { if (!controller.signal.aborted) setResearch({ ticker: topTicker, items: response.items }); })
        .catch(() => { if (!controller.signal.aborted) setResearch({ ticker: topTicker, items: [], failed: true }); })
        .finally(() => window.clearTimeout(timeout));
    }, RESEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [topTicker, researchAttempt, composing]);
  const researchResults = research && research.ticker === topTicker ? research.items : [];

  const catalogueLoading = opinions.loading || reddit.loading || xCreators.loading;
  const catalogueFailed = Boolean(opinions.error || reddit.error || xCreators.error);
  const includesResearch = filter === "all" || filter === "research";
  const researchPending = includesResearch && Boolean(topTicker) && research?.ticker !== topTicker;
  const researchFailed = includesResearch && research?.ticker === topTicker && research?.failed;
  const showStocks = (filter === "all" || filter === "stocks") && stockResults.length > 0;
  const showCreators = (filter === "all" || filter === "creators") && creatorResults.length > 0;
  const showResearch = includesResearch && researchResults.length > 0;
  const hasResults = showStocks || showCreators || showResearch;

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: c("All", "全部") },
    { value: "stocks", label: c("Stocks", "股票") },
    { value: "creators", label: c("Creators", "创作者") },
    { value: "research", label: c("AI research", "AI 研究") },
  ];

  function changeValue(next: string) {
    setValue(next);
    if (!composition.current) setSearchValue(next);
    setSubmitFailed(false);
  }

  function clearSearch() {
    composition.current = false;
    setComposing(false);
    changeValue("");
    input.current?.focus();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (composition.current) return;
    if (stockResults[0]) {
      rememberStock(stockResults[0]);
      router.push(marketStockHref(stockResults[0].ticker));
    } else if (query) setSubmitFailed(true);
  }

  return <DashboardLayout title={c("Search", "探索")}>
    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className={styles.page}>
        <header className="mb-7">
          <h1 className="text-[2rem] font-semibold tracking-tight">{c("Search", "探索")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{c("Explore stocks, creators and the ideas behind them.", "从一只股票、一位创作者，发现更多市场线索。")}</p>
          <div className="mt-6 flex items-center gap-3">
            <form role="search" noValidate onSubmit={submit} className="min-w-0 flex-1">
              <div className={cn("glass-field relative flex h-14 items-center rounded-full border border-transparent bg-foreground/[0.06]", styles.searchField)}>
                <Search aria-hidden className="pointer-events-none absolute left-5 h-5 w-5 text-muted-foreground" />
                <input
                  ref={input}
                  value={value}
                  onChange={event => changeValue(event.target.value)}
                  onCompositionStart={() => { composition.current = true; setComposing(true); }}
                  onCompositionEnd={event => { composition.current = false; setComposing(false); changeValue(event.currentTarget.value); }}
                  onKeyDown={event => {
                    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || composition.current) {
                      if (event.key === "Enter") event.preventDefault();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      if (value) clearSearch();
                      else router.back();
                    }
                  }}
                  aria-label={c("Search stocks and creators", "搜索股票和创作者")}
                  aria-invalid={submitFailed || undefined}
                  aria-describedby={submitFailed ? "search-error" : undefined}
                  placeholder={c("Search stocks, companies, creators", "搜索股票、公司、创作者")}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  maxLength={40}
                  className="h-full w-full rounded-full bg-transparent pl-14 pr-12 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:bg-transparent focus-visible:no-underline focus-visible:outline-none"
                />
                {value && <button type="button" aria-label={c("Clear search", "清空搜索")} onClick={clearSearch} className="absolute right-1 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground motion-reduce:transition-none"><X aria-hidden className="h-4 w-4" /></button>}
              </div>
            </form>
            <button type="button" onClick={() => router.back()} className="flex min-h-11 shrink-0 items-center gap-3 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground motion-reduce:transition-none">
              {c("Cancel", "取消")}<kbd aria-hidden className="glass-button glass-button-neutral hidden rounded-md bg-foreground/[0.08] px-1.5 py-0.5 text-[0.6875rem] font-normal sm:inline">Esc</kbd>
            </button>
          </div>
          {submitFailed && <p id="search-error" role="alert" className="mt-3 pl-5 text-sm text-negative">{c("No matching stock. Choose a result below, or try a ticker like AAPL.", "没有匹配的股票。请选择下方结果，或试试 AAPL 这样的股票代码。")}</p>}
          {watchlistError && <p role="alert" className="mt-3 pl-5 text-sm text-negative">{c("Your watchlist couldn't be updated. Try again.", "自选更新失败，请重试。")}</p>}
        </header>

        {!query ? <SearchDiscovery youtube={opinions} reddit={reddit} x={xCreators} history={history} onHistoryChange={saveHistory} onRemember={remember} /> : <div className="max-w-4xl">
          <SegmentedControl label={c("Filter results", "筛选结果")} semantics="radio" options={filters} value={filter} onChange={setFilter} size="sm" itemClassName="min-h-10 px-4" />
          <div key={filter} className={styles.results}>
            {showStocks && <Section title={c("Stocks", "股票")}>{stockResults.map(stock => <ResultRow
              key={stock.ticker}
              href={marketStockHref(stock.ticker)}
              title={stock.ticker}
              detail={stock.name === stock.ticker ? c("Open stock page", "打开股票页") : stock.name}
              leading={<span aria-hidden><CompanyLogo symbol={stock.ticker} name={stock.name} customSize={32} /></span>}
              onOpen={() => rememberStock(stock)}
              trailing={<WatchToggle ticker={stock.ticker} />}
            />)}</Section>}
            {showCreators && <Section title={c("Creators", "创作者")}>{creatorResults.map(({ key, Icon, avatar, ...creator }) => <ResultRow
              key={key}
              {...creator}
              leading={<CreatorAvatar name={creator.title} avatarUrl={avatar} size="md" className="h-8 w-8" />}
              onOpen={() => remember(creator)}
              trailing={<Icon aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />}
            />)}</Section>}
            {showResearch && <Section title={c("AI research", "AI 研究")}>{researchResults.map(report => {
              const item = { href: `/dashboard/trading-analysis/explore/${encodeURIComponent(report.id)}`, title: c(`${report.ticker} research report`, `${report.ticker} 研究报告`), detail: dayLabel(report.trade_date) };
              return <ResultRow key={report.id} {...item} leading={<span aria-hidden><CompanyLogo symbol={report.ticker} customSize={32} /></span>} onOpen={() => remember(item)} />;
            })}</Section>}

            {!hasResults && (catalogueLoading || researchPending) && <ContentLoading className="min-h-0">{[4, 3].map((rows, section) => <section key={section} className="mt-7">
              <Skeleton className="mb-3 h-6 w-20 rounded-md" />
              <ListCard>{Array.from({ length: rows }, (_, i) => <div key={i} className={cn(listRowTargetClass, "flex gap-3")}><Skeleton className="h-8 w-8 shrink-0 rounded-full" /><span className="flex min-w-0 flex-1 flex-col gap-2"><Skeleton className="h-4 w-16 rounded-md" /><Skeleton className={cn("h-3 rounded-md", i % 2 ? "w-28" : "w-40")} /></span></div>)}</ListCard>
            </section>)}</ContentLoading>}
            {!catalogueLoading && !researchPending && !researchFailed && !hasResults && <div className="mt-7"><ListCard><ListEmptyState
              title={c("No results found", "没有找到结果")}
              description={filter === "all" ? c(`Nothing found for “${value.trim()}”. Try a ticker or company name.`, `没有找到“${value.trim()}”。试试股票代码或公司名称。`) : c("Nothing in this category. Switch to All to see other results.", "这个分类下没有结果，切换到“全部”看看其他内容。")}
              action={<Button type="button" variant="outline" size="sm" onClick={filter === "all" ? clearSearch : () => setFilter("all")}>{filter === "all" ? c("Clear search", "清空搜索") : c("Show all results", "查看全部结果")}</Button>}
            /></ListCard></div>}
            {researchFailed && <div role="status" className="mt-5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">{c("Research is temporarily unavailable.", "研究暂时不可用。")}
              <Button type="button" variant="ghost" size="sm" onClick={() => { setResearch(null); setResearchAttempt(attempt => attempt + 1); }}>{c("Retry", "重试")}</Button>
            </div>}
            {catalogueFailed && <div role="status" className="mt-5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">{c("Some sources are unavailable, so results may be incomplete.", "部分来源暂时不可用，结果可能不完整。")}
              <Button type="button" variant="ghost" size="sm" onClick={() => { opinions.refresh(); reddit.refresh(); xCreators.refresh(); }}>{c("Retry", "重试")}</Button>
            </div>}
          </div>
        </div>}
      </div>
    </main>
  </DashboardLayout>;
}
