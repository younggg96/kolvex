"use client";

import { SearchFieldIcon } from "@/components/ui/search-input";
import { CommandSearch } from "@/components/ui/command-search";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MOBILE_DOCK_SLOT_ID } from "@/components/layout/MobileTabBar";
import { Activity, Landmark, ScrollText, Star, UserRound, X } from "lucide-react";
import { PersonUpdateAvatar } from "@/components/person-updates/PersonUpdateAvatar";
import { useSessionLabel } from "@/components/options-activity/sessionLabel";
import {
  InvestorAvatar,
  superinvestorHref,
  useInvestorByline,
} from "@/components/superinvestors/shared";
import { XIcon, YouTubeIcon } from "@/components/common/PlatformIcons";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/ui/company-logo";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ListCard,
  ListEmptyState,
  ListRow,
  ListRows,
  listRowTargetClass,
} from "@/components/ui/list-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useWatchlist } from "@/hooks/useWatchlist";
import { validTicker } from "@/lib/decision";
import type { RedditRanking } from "@/lib/redditOpinions";
import {
  addToSearchHistory,
  readSearchHistory,
  writeSearchHistory,
  type SearchHistoryItem,
} from "@/lib/searchHistory";
import { formatPremium } from "@/lib/optionsActivity";
import { isFedOfficial, personAvatar } from "@/lib/personUpdates";
import { isProductFeatureEnabled } from "@/lib/productFeatures";
import { marketStockHref } from "@/lib/stockLinks";
import { getPublishedAnalyses, type TradingAnalysis } from "@/lib/tradingAnalysisApi";
import { cn } from "@/lib/utils";
import { xRequest, type XCreator } from "@/lib/xContentApi";
import { getYouTubeOpinionDashboard } from "@/lib/youtubeOpinionsApi";
import SearchDiscovery from "./SearchDiscovery";
import { tradeAsset, usePersonLabel, useTradeSide } from "./SearchDiscoveryFlows";
import {
  congressTradesHref,
  managerNames,
  matchesPersonUpdate,
  optionsTickersByPremium,
  personUpdatesHref,
  useCongressSearch,
  useLatestOptionsRun,
  usePersonUpdates,
  useSuperinvestorManagers,
  type CongressTrade,
} from "./SearchSources";
import { useCopy, useDayLabel } from "./shared";

type Filter = "all" | "stocks" | "creators" | "research" | "flows" | "updates";
type StockResult = { ticker: string; name: string };
const RESULT_LIMIT = 8;
const RESEARCH_LIMIT = 5;
/** Superinvestors, congress members, options tickers and updates each show this many. */
const FLOW_LIMIT = 5;
const RESEARCH_DEBOUNCE_MS = 300;
const sectionIconClass = "h-4 w-4 text-muted-foreground";

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

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 lg:mt-7">
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold lg:mb-3 lg:text-lg">
        {icon}
        {title}
      </h2>
      <ListCard>
        <ListRows>{children}</ListRows>
      </ListCard>
    </section>
  );
}

function ResultRow({
  href,
  title,
  detail,
  leading,
  trailing,
  onOpen,
}: {
  href: string;
  title: string;
  detail: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onOpen?: () => void;
}) {
  return (
    <ListRow>
      <Link
        href={href}
        onClick={onOpen}
        className={cn(listRowTargetClass, "flex gap-2 max-lg:min-h-[48px] lg:gap-3")}
      >
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{detail}</span>
        </span>
      </Link>
      {trailing}
    </ListRow>
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
      aria-label={
        watched
          ? c(`Remove ${ticker} from watchlist`, `从自选移除 ${ticker}`)
          : c(`Add ${ticker} to watchlist`, `将 ${ticker} 加入自选`)
      }
      onClick={() => toggle(ticker)}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors  disabled:opacity-40 motion-reduce:transition-none"
    >
      <Star aria-hidden className={cn("h-4 w-4", watched && "fill-current")} />
    </button>
  );
}

export default function SearchPage() {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const router = useRouter();
  const { error: watchlistError, userId } = useWatchlist();
  const page = useRef<HTMLElement>(null);
  const scrollRegion = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // On phones the search field lives inside the floating dock, above its tabs.
  const [dockSlot, setDockSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 1023px)");
    const sync = () =>
      setDockSlot(mobile.matches ? document.getElementById(MOBILE_DOCK_SLOT_ID) : null);
    sync();
    mobile.addEventListener("change", sync);
    return () => mobile.removeEventListener("change", sync);
  }, []);
  const composition = useRef(false);
  const [composing, setComposing] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [value, setValue] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [submitFailed, setSubmitFailed] = useState(false);
  const [research, setResearch] = useState<{
    ticker: string;
    items: TradingAnalysis[];
    failed?: boolean;
  } | null>(null);
  const [researchAttempt, setResearchAttempt] = useState(0);
  const byline = useInvestorByline();
  const personLabel = usePersonLabel();
  const tradeSide = useTradeSide();
  const sessionLabel = useSessionLabel();

  const opinions = useCachedResource(
    "/api/youtube-opinions/dashboard?limit=12",
    () => getYouTubeOpinionDashboard({ limit: 12 }),
    { ttl: 60_000 },
  );
  const reddit = useCachedResource(
    "/api/reddit-opinions?community=all-stocks",
    async (signal) => {
      const response = await fetch("/api/reddit-opinions?community=all-stocks", {
        signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Reddit ranking request failed");
      return (await response.json()) as RedditRanking;
    },
    { ttl: 60_000 },
  );
  const xCreators = useCachedResource(
    "/api/x-content/creators",
    (signal) => xRequest<{ creators: XCreator[] }>("creators", { signal }),
    { ttl: 60_000 },
  );

  const superinvestors = useSuperinvestorManagers();
  const personUpdates = usePersonUpdates();
  const optionsRun = useLatestOptionsRun();

  useEffect(() => {
    setHistory(userId ? readSearchHistory(userId) : []);
  }, [userId]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) input.current?.focus();

    const layout = page.current;
    const field = input.current;
    const viewport = window.visualViewport;
    if (!layout || !field || !viewport) return;
    const shell = layout.closest(".mobile-nav-inset") ?? layout;
    const mobile = window.matchMedia("(max-width: 1023px)");
    const syncKeyboardInset = () => {
      const editing =
        document.activeElement === field || layout.hasAttribute("data-search-keyboard");
      const keyboardOpen =
        mobile.matches &&
        editing &&
        viewport.scale === 1 &&
        document.documentElement.clientHeight - viewport.height > 120;
      layout.toggleAttribute("data-search-keyboard", keyboardOpen);
      // The shell edge stays stable while its dock reservation is removed.
      const inset = keyboardOpen
        ? Math.max(0, shell.getBoundingClientRect().bottom - viewport.offsetTop - viewport.height)
        : 0;
      layout.style.setProperty("--search-keyboard-inset", `${inset}px`);
      (shell as HTMLElement).style.setProperty("--search-keyboard-inset", `${inset}px`);
    };
    field.addEventListener("focus", syncKeyboardInset);
    viewport.addEventListener("resize", syncKeyboardInset);
    viewport.addEventListener("scroll", syncKeyboardInset);
    mobile.addEventListener("change", syncKeyboardInset);
    return () => {
      field.removeEventListener("focus", syncKeyboardInset);
      viewport.removeEventListener("resize", syncKeyboardInset);
      viewport.removeEventListener("scroll", syncKeyboardInset);
      mobile.removeEventListener("change", syncKeyboardInset);
    };
  }, [dockSlot]);

  function saveHistory(next: SearchHistoryItem[]) {
    setHistory(next);
    if (userId) writeSearchHistory(userId, next);
  }
  const remember = (item: SearchHistoryItem) => saveHistory(addToSearchHistory(history, item));
  const rememberStock = ({ ticker, name }: StockResult) =>
    remember({ title: name, detail: ticker, href: marketStockHref(ticker) });

  const query = searchValue.trim().toLowerCase();
  const searching = Boolean(query);
  useEffect(() => {
    scrollRegion.current?.scrollTo(0, 0);
    page.current?.scrollTo(0, 0);
  }, [searching, filter]);
  const catalogue = useMemo(() => {
    const stocks = new Map<string, StockResult>();
    for (const stock of opinions.data?.stocks ?? [])
      stocks.set(stock.ticker, { ticker: stock.ticker, name: stock.company_name || stock.ticker });
    for (const stock of reddit.data?.results ?? [])
      if (!stocks.has(stock.ticker))
        stocks.set(stock.ticker, { ticker: stock.ticker, name: stock.name });
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
    if (validTicker(typed) && !matches.some((stock) => stock.ticker === typed))
      matches.unshift({ ticker: typed, name: typed });
    return matches.slice(0, RESULT_LIMIT);
  }, [catalogue, query]);

  const creatorResults = useMemo(() => {
    if (!query) return [];
    const youtube = (opinions.data?.creators ?? [])
      .filter((creator) =>
        [creator.channel_title, creator.channel_handle].some((name) =>
          name?.toLowerCase().includes(query),
        ),
      )
      .map((creator) => ({
        key: `youtube:${creator.channel_id}`,
        title: creator.channel_title || creator.channel_id,
        detail: creator.channel_handle || "YouTube",
        avatar: creator.channel_avatar_url,
        href: `/dashboard/youtube-opinions?${new URLSearchParams({ tab: "creators", creator: creator.channel_id })}`,
        Icon: YouTubeIcon,
      }));
    const x = (xCreators.data?.creators ?? [])
      .filter(
        (creator) =>
          creator.display_name?.toLowerCase().includes(query) ||
          creator.username.toLowerCase().includes(query),
      )
      .map((creator) => ({
        key: `x:${creator.username}`,
        title: creator.display_name || `@${creator.username}`,
        detail: `@${creator.username}`,
        avatar: creator.avatar_url,
        href: `/dashboard/x-opinions?${new URLSearchParams({ author: creator.username })}`,
        Icon: XIcon,
      }));
    return [...youtube, ...x].slice(0, RESULT_LIMIT);
  }, [opinions.data, xCreators.data, query]);

  const superinvestorResults = useMemo(() => {
    if (!query) return [];
    return (superinvestors.data?.managers ?? [])
      .filter((manager) => managerNames(manager).some((name) => name.toLowerCase().includes(query)))
      .slice(0, FLOW_LIMIT);
  }, [superinvestors.data, query]);

  const optionsResults = useMemo(() => {
    if (!query) return [];
    return optionsTickersByPremium(optionsRun.data)
      .filter((ticker) => ticker.symbol.toLowerCase().startsWith(query))
      .slice(0, FLOW_LIMIT);
  }, [optionsRun.data, query]);

  const personResults = useMemo(() => {
    if (!query) return [];
    return (personUpdates.data?.items ?? [])
      .filter((item) => matchesPersonUpdate(item, query))
      .slice(0, FLOW_LIMIT);
  }, [personUpdates.data, query]);

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
        .then((response) => {
          if (!controller.signal.aborted) setResearch({ ticker: topTicker, items: response.items });
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setResearch({ ticker: topTicker, items: [], failed: true });
        })
        .finally(() => window.clearTimeout(timeout));
    }, RESEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [topTicker, researchAttempt, composing]);
  const researchResults = research && research.ticker === topTicker ? research.items : [];

  const includesFlows = filter === "all" || filter === "flows";
  const congress = useCongressSearch(query, topTicker, {
    enabled: Boolean(userId) && includesFlows && !composing,
    delay: RESEARCH_DEBOUNCE_MS,
  });
  // One row per member: their latest matching trade. A member found only through the
  // ticker opens the ticker's trades; a name match opens that member's trades.
  const congressResults = useMemo(() => {
    const members = new Map<string, { trade: CongressTrade; href: string }>();
    const sorted = [...congress.trades].sort((a, b) => b.filed_date.localeCompare(a.filed_date));
    for (const trade of sorted) {
      if (members.has(trade.member_name)) continue;
      const byName = trade.member_name.toLowerCase().includes(query);
      members.set(trade.member_name, {
        trade,
        href: congressTradesHref(byName ? { member: trade.member_name } : { ticker: trade.ticker }),
      });
    }
    return [...members.values()].slice(0, FLOW_LIMIT);
  }, [congress.trades, query]);

  const flowSources = [
    isProductFeatureEnabled("superinvestors") && superinvestors,
    isProductFeatureEnabled("optionsActivity") && optionsRun,
    isProductFeatureEnabled("personUpdates") && personUpdates,
  ].filter((source) => source !== false);
  const catalogueLoading =
    opinions.loading ||
    reddit.loading ||
    xCreators.loading ||
    flowSources.some((source) => source.loading);
  const catalogueFailed =
    Boolean(opinions.error || reddit.error || xCreators.error) ||
    flowSources.some((source) => source.error) ||
    congress.failed;
  const includesResearch = filter === "all" || filter === "research";
  const researchPending = includesResearch && Boolean(topTicker) && research?.ticker !== topTicker;
  const researchFailed = includesResearch && research?.ticker === topTicker && research?.failed;
  const showStocks = (filter === "all" || filter === "stocks") && stockResults.length > 0;
  const showCreators = (filter === "all" || filter === "creators") && creatorResults.length > 0;
  const showResearch = includesResearch && researchResults.length > 0;
  const showSuperinvestors = includesFlows && superinvestorResults.length > 0;
  const showCongress = includesFlows && congressResults.length > 0;
  const showOptions = includesFlows && optionsResults.length > 0;
  const showUpdates = (filter === "all" || filter === "updates") && personResults.length > 0;
  const hasResults =
    showStocks ||
    showCreators ||
    showResearch ||
    showSuperinvestors ||
    showCongress ||
    showOptions ||
    showUpdates;
  const pending = catalogueLoading || researchPending || congress.pending;

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: c("All", "全部") },
    { value: "stocks", label: c("Stocks", "股票") },
    { value: "creators", label: c("Creators", "创作者") },
    { value: "research", label: c("AI research", "AI 研究") },
    { value: "flows", label: c("Money flows", "资金动向") },
    ...(isProductFeatureEnabled("personUpdates")
      ? [{ value: "updates" as const, label: c("Updates", "动态") }]
      : []),
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

  const searchDock = (
    <div className="mb-6 max-lg:m-0 max-lg:px-1 max-lg:pt-1">
      <div className="flex items-center gap-1 lg:gap-3">
        <form role="search" noValidate onSubmit={submit} className="min-w-0 flex-1">
          <CommandSearch hasValue={!!value} shortcut="mod+k">
            <div
              className={cn(
                "glass-field relative flex h-[44px] items-center rounded-3xl bg-foreground/[0.06] lg:h-14",
                "[transition:background-color_180ms_var(--spring),border-color_180ms_var(--spring)] motion-reduce:transition-none",
                "focus-within:border-foreground/40 focus-within:bg-foreground/10",
                // Phone dock: `!` beats the global light-theme control radius and glass shadow on .glass-field.
                "max-lg:!rounded-[1.25rem] max-lg:border-transparent max-lg:!shadow-none max-lg:focus-within:border-foreground/25 max-lg:focus-within:bg-foreground/[0.09]",
              )}
            >
              <SearchFieldIcon className="left-3.5 h-4 w-4 lg:left-5 lg:h-5 lg:w-5" />
              <input
                ref={input}
                value={value}
                onChange={(event) => changeValue(event.target.value)}
                onCompositionStart={() => {
                  composition.current = true;
                  setComposing(true);
                }}
                onCompositionEnd={(event) => {
                  composition.current = false;
                  setComposing(false);
                  changeValue(event.currentTarget.value);
                }}
                onKeyDown={(event) => {
                  if (
                    event.nativeEvent.isComposing ||
                    event.nativeEvent.keyCode === 229 ||
                    composition.current
                  ) {
                    if (event.key === "Enter") event.preventDefault();
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    if (value) clearSearch();
                    else router.back();
                  }
                }}
                aria-label={c(
                  "Search stocks, creators, investors and updates",
                  "搜索股票、创作者、投资者和动态",
                )}
                aria-invalid={submitFailed || undefined}
                aria-describedby={submitFailed ? "search-error" : undefined}
                placeholder={c(
                  "Search stocks, creators, investors, members",
                  "搜索股票、创作者、投资人、议员",
                )}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="search"
                maxLength={40}
                className="h-full w-full rounded-full bg-transparent pl-10 pr-11 text-base lg:pl-14 lg:pr-12 text-foreground outline-none placeholder:text-muted-foreground focus-visible:bg-transparent focus-visible:no-underline focus-visible:outline-none"
              />
              {value && (
                <Button
                  type="button"
                  variant="icon"
                  size="icon"
                  aria-label={c("Clear search", "清空搜索")}
                  onClick={clearSearch}
                  className="absolute right-1 shadow-sm max-lg:h-[36px] max-lg:w-[36px]"
                >
                  <X aria-hidden className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CommandSearch>
        </form>
      </div>
      {submitFailed && (
        <p id="search-error" role="alert" className="mt-2 px-2 text-xs text-negative">
          {c(
            "No matching stock. Choose a result or try a ticker like AAPL.",
            "没有匹配的股票。请选择一条结果，或试试 AAPL 这样的股票代码。",
          )}
        </p>
      )}
    </div>
  );

  return (
    <DashboardLayout title={c("Search", "探索")}>
      {/* `[overflow-y:auto]`, not `overflow-y-auto`: globals.css pads `.overflow-y-auto` scrollers
          for the phone dock, and this page reserves that space in its own scroll region. */}
      <main
        ref={page}
        data-search-page
        className="group/search mx-auto min-h-0 w-full max-w-[1280px] flex-1 [overflow-y:auto] px-8 pb-16 pt-8 max-lg:flex max-lg:flex-col max-lg:overflow-hidden max-lg:p-0 max-lg:pb-[var(--search-keyboard-inset,0px)]"
      >
        <header className="mb-5 max-lg:m-0 max-lg:shrink-0 max-lg:px-[16px] max-lg:pb-1 max-lg:pt-4">
          <h1 className="text-xl font-semibold tracking-tight lg:text-3xl">
            {c("Search", "探索")}
          </h1>
        </header>
        {dockSlot ? createPortal(searchDock, dockSlot) : searchDock}
        <div
          ref={scrollRegion}
          className="max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:px-[16px] max-lg:pb-[calc(8.5rem+max(1rem,env(safe-area-inset-bottom,0px)))] max-lg:group-data-[search-keyboard]/search:pb-[calc(4.5rem+var(--search-keyboard-inset,0px))]"
        >
          {watchlistError && (
            <p role="alert" className="mt-3 pl-5 text-sm text-negative">
              {c("Your watchlist couldn't be updated. Try again.", "自选更新失败，请重试。")}
            </p>
          )}

          {!query ? (
            <SearchDiscovery
              youtube={opinions}
              reddit={reddit}
              x={xCreators}
              superinvestors={superinvestors}
              personUpdates={personUpdates}
              optionsActivity={optionsRun}
              history={history}
              onHistoryChange={saveHistory}
              onRemember={remember}
            />
          ) : (
            <div className="max-w-4xl">
              <SegmentedControl
                label={c("Filter results", "筛选结果")}
                semantics="radio"
                options={filters}
                value={filter}
                onChange={setFilter}
                size="sm"
                itemClassName="min-h-10 px-4"
              />
              <div key={filter} className="animate-results-enter motion-reduce:animate-none">
                {showStocks && (
                  <Section title={c("Stocks", "股票")}>
                    {stockResults.map((stock) => (
                      <ResultRow
                        key={stock.ticker}
                        href={marketStockHref(stock.ticker)}
                        title={stock.ticker}
                        detail={
                          stock.name === stock.ticker
                            ? c("Open stock page", "打开股票页")
                            : stock.name
                        }
                        leading={
                          <span aria-hidden>
                            <CompanyLogo symbol={stock.ticker} name={stock.name} customSize={32} />
                          </span>
                        }
                        onOpen={() => rememberStock(stock)}
                        trailing={<WatchToggle ticker={stock.ticker} />}
                      />
                    ))}
                  </Section>
                )}
                {showCreators && (
                  <Section title={c("Creators", "创作者")}>
                    {creatorResults.map(({ key, Icon, avatar, ...creator }) => (
                      <ResultRow
                        key={key}
                        {...creator}
                        leading={
                          <CreatorAvatar
                            name={creator.title}
                            avatarUrl={avatar}
                            size="md"
                            className="h-8 w-8"
                          />
                        }
                        onOpen={() => remember(creator)}
                        trailing={
                          <Icon aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                        }
                      />
                    ))}
                  </Section>
                )}
                {showResearch && (
                  <Section title={c("AI research", "AI 研究")}>
                    {researchResults.map((report) => {
                      const item = {
                        href: `/dashboard/trading-analysis/explore/${encodeURIComponent(report.id)}`,
                        title: c(`${report.ticker} research report`, `${report.ticker} 研究报告`),
                        detail: dayLabel(report.trade_date),
                      };
                      return (
                        <ResultRow
                          key={report.id}
                          {...item}
                          leading={
                            <span aria-hidden>
                              <CompanyLogo symbol={report.ticker} customSize={32} />
                            </span>
                          }
                          onOpen={() => remember(item)}
                        />
                      );
                    })}
                  </Section>
                )}
                {showSuperinvestors && (
                  <Section
                    title={c("Superinvestors", "超级投资者")}
                    icon={<Landmark aria-hidden className={sectionIconClass} />}
                  >
                    {superinvestorResults.map((manager) => {
                      const item = {
                        href: superinvestorHref(manager.id),
                        title: manager.name,
                        detail: byline(manager.id, false, manager.profile) || "13F",
                      };
                      return (
                        <ResultRow
                          key={manager.id}
                          {...item}
                          leading={<InvestorAvatar id={manager.id} name={manager.name} />}
                          onOpen={() => remember(item)}
                        />
                      );
                    })}
                  </Section>
                )}
                {showCongress && (
                  <Section
                    title={c("Congress trades", "国会议员交易")}
                    icon={<ScrollText aria-hidden className={sectionIconClass} />}
                  >
                    {congressResults.map(({ trade, href }) => {
                      const side = tradeSide(trade);
                      const asset = tradeAsset(trade);
                      const chamber =
                        trade.chamber === "house"
                          ? c("House", "众议院")
                          : trade.chamber === "senate"
                            ? c("Senate", "参议院")
                            : null;
                      return (
                        <ResultRow
                          key={trade.member_name}
                          href={href}
                          title={trade.member_name}
                          detail={
                            <>
                              {chamber && `${chamber} · `}
                              <span className={cn("font-medium", side.className)}>
                                {side.label}
                              </span>{" "}
                              {asset} · {dayLabel(trade.filed_date)}
                            </>
                          }
                          leading={
                            <span aria-hidden>
                              <CompanyLogo
                                symbol={trade.ticker || "?"}
                                name={asset}
                                customSize={32}
                              />
                            </span>
                          }
                          onOpen={() =>
                            remember({
                              href,
                              title: trade.member_name,
                              detail: c("Congress trades", "国会议员交易"),
                            })
                          }
                        />
                      );
                    })}
                  </Section>
                )}
                {showOptions && optionsRun.data && (
                  <Section
                    title={c("Options activity", "期权异动")}
                    icon={<Activity aria-hidden className={sectionIconClass} />}
                  >
                    {optionsResults.map((ticker) => (
                      <ResultRow
                        key={ticker.symbol}
                        href={marketStockHref(ticker.symbol)}
                        onOpen={() =>
                          remember({
                            title: ticker.symbol,
                            detail: c("Options activity", "期权异动"),
                            href: marketStockHref(ticker.symbol),
                          })
                        }
                        title={ticker.symbol}
                        detail={`${dayLabel(optionsRun.data!.trade_date)} · ${sessionLabel(
                          optionsRun.data!.session,
                        )} · ${c("Calls", "看涨")} ${formatPremium(ticker.call_premium)} · ${c(
                          "Puts",
                          "看跌",
                        )} ${formatPremium(ticker.put_premium)}`}
                        leading={
                          <span aria-hidden>
                            <CompanyLogo symbol={ticker.symbol} customSize={32} />
                          </span>
                        }
                        trailing={
                          <span
                            title={c("Net premium", "净权利金")}
                            className={cn(
                              "shrink-0 pr-3 text-sm font-semibold tabular-nums",
                              ticker.net_premium > 0
                                ? "text-positive"
                                : ticker.net_premium < 0
                                  ? "text-negative"
                                  : "text-muted-foreground",
                            )}
                          >
                            {formatPremium(ticker.net_premium, true)}
                          </span>
                        }
                      />
                    ))}
                  </Section>
                )}
                {showUpdates && (
                  <Section
                    title={c("Updates", "动态")}
                    icon={<UserRound aria-hidden className={sectionIconClass} />}
                  >
                    {personResults.map((update) => {
                      const name = personLabel(update);
                      const href = personUpdatesHref(update.person);
                      return (
                        <ResultRow
                          key={update.id}
                          href={href}
                          title={name}
                          detail={`${dayLabel(update.published_at)} · ${update.title}`}
                          leading={
                            <PersonUpdateAvatar
                              label={name}
                              src={personAvatar(update)}
                              fedOfficial={isFedOfficial(update)}
                              className="h-8 w-8 shrink-0"
                            />
                          }
                          onOpen={() =>
                            remember({ href, title: name, detail: c("Updates", "动态") })
                          }
                        />
                      );
                    })}
                  </Section>
                )}

                {!hasResults && pending && (
                  <ContentLoading className="min-h-0">
                    {[4, 3].map((rows, section) => (
                      <section key={section} className="mt-4 lg:mt-7">
                        <Skeleton className="mb-3 h-6 w-20 rounded-md" />
                        <ListCard>
                          {Array.from({ length: rows }, (_, i) => (
                            <div key={i} className={cn(listRowTargetClass, "flex gap-3")}>
                              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                              <span className="flex min-w-0 flex-1 flex-col gap-2">
                                <Skeleton className="h-4 w-16 rounded-md" />
                                <Skeleton
                                  className={cn("h-3 rounded-md", i % 2 ? "w-28" : "w-40")}
                                />
                              </span>
                            </div>
                          ))}
                        </ListCard>
                      </section>
                    ))}
                  </ContentLoading>
                )}
                {!pending && !researchFailed && !hasResults && (
                  <div className="mt-4 lg:mt-7">
                    <ListCard>
                      <ListEmptyState
                        title={
                          filter === "all"
                            ? c(`Nothing found for “${value.trim()}”`, `没有找到“${value.trim()}”`)
                            : c("Nothing in this category", "这个分类下没有结果")
                        }
                        action={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={filter === "all" ? clearSearch : () => setFilter("all")}
                          >
                            {filter === "all"
                              ? c("Clear search", "清空搜索")
                              : c("Show all results", "查看全部结果")}
                          </Button>
                        }
                      />
                    </ListCard>
                  </div>
                )}
                {researchFailed && (
                  <div
                    role="status"
                    className="mt-5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground"
                  >
                    {c("Research is temporarily unavailable.", "研究暂时不可用。")}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResearch(null);
                        setResearchAttempt((attempt) => attempt + 1);
                      }}
                    >
                      {c("Retry", "重试")}
                    </Button>
                  </div>
                )}
                {catalogueFailed && (
                  <div
                    role="status"
                    className="mt-5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground"
                  >
                    {c(
                      "Some sources are unavailable, so results may be incomplete.",
                      "部分来源暂时不可用，结果可能不完整。",
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        opinions.refresh();
                        reddit.refresh();
                        xCreators.refresh();
                        for (const source of flowSources) if (source.error) source.refresh();
                        if (congress.failed) congress.retry();
                      }}
                    >
                      {c("Retry", "重试")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
