"use client";

import Link from "next/link";
import { Info, Search, X, RotateCcw } from "lucide-react";
import { FilterSheet, FilterSheetGroup } from "@/components/ui/filter-sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/ui/company-logo";
import { ListColumnHeader, ListLoadMore, ListRow, ListRows, listRowTargetClass } from "@/components/ui/list-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PendingValue } from "@/components/ui/content-loading";
import { StockRowsSkeleton } from "@/components/decision/StockRowsSkeleton";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { isProductFeatureEnabled } from "@/lib/productFeatures";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { useMarketDiscovery } from "@/hooks/useMarketDiscovery";
import { useSocialBuzz } from "@/hooks/useSocialBuzz";
import { STOCK_SOURCES, type StockSource } from "@/lib/socialBuzz";
import type { DiscoveryStock } from "@/lib/marketDiscovery";
import {
  CORE_STOCKS, STOCK_PAGE_SIZE, STOCK_PREFERENCE_KEY, STOCK_SECTORS,
  readStockObservationState,
  selectObservationSymbols, stockSorts, stockEntryReason, stockEntryTag, writeStockObservationState,
  type StockObservationState, type StockScope, type StockSector, type StockSort,
} from "@/lib/stockDiscovery";
import type { YouTubeStockSummary } from "@/lib/youtubeOpinionsApi";
import { cn } from "@/lib/utils";
import { MARKET_RANGES } from "@/lib/marketObservations";
import { Change, Empty, HeldMark, Panel, TextLink, money, useCopy, useCreatorCatalogue, useHeldTickers } from "./shared";
import StockTrend from "./StockTrend";
import WatchlistButton from "./WatchlistButton";

const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_80px] gap-x-2 min-[360px]:grid-cols-[minmax(0,1fr)_60px_80px] sm:grid-cols-[minmax(0,1fr)_100px_100px] sm:gap-x-4";
const scopes: { key: StockScope; en: string; zh: string }[] = [
  { key: "movers", en: "Daily movers", zh: "今日异动" },
  { key: "active", en: "Volume surge", zh: "放量活跃" },
  { key: "creators", en: "Creator buzz", zh: "博主热议" },
  { key: "core", en: "Core US stocks", zh: "常看美股" },
  { key: "holdings", en: "My holdings", zh: "我的持仓" },
];
const sortLabels: Record<StockSort, [string, string]> = {
  move: ["Daily move", "今日波动"], gainers: ["Gainers first", "涨幅优先"],
  losers: ["Losers first", "跌幅优先"], default: ["List order", "名单顺序"],
  heat: ["Discussion · 7 days", "近期讨论 · 7 天"], latest: ["Latest opinion", "最新观点"],
  volume: ["Volume multiple", "放量倍数"],
};
const heatLabels: Record<StockSource, [string, string]> = {
  all: ["Combined buzz", "综合热度"], youtube: ["Discussion · 7 days", "近期讨论 · 7 天"],
  reddit: ["Reddit mentions · 24h", "Reddit 提及 · 24 小时"], x: ["X posts · 7 days", "X 帖子 · 7 天"],
};
const sortLabel = (sort: StockSort, source: StockSource) => sort === "heat" ? heatLabels[source] : sortLabels[sort];
const coreNames = new Map<string, string>(CORE_STOCKS.map(stock => [stock.symbol, stock.name]));
const EMPTY_STOCKS: YouTubeStockSummary[] = [];
const EMPTY_DISCOVERY: DiscoveryStock[] = [];

export default function StockObservationList({ range, catalogue, held, onRetry, refreshToken = 0 }: {
  range: (typeof MARKET_RANGES)[number]["key"];
  catalogue: ReturnType<typeof useCreatorCatalogue>;
  held: ReturnType<typeof useHeldTickers>;
  onRetry: () => void;
  refreshToken?: number;
}) {
  const c = useCopy();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const holdingsEnabled = isProductFeatureEnabled("portfolio");
  const query = searchParams.toString();
  const state = useMemo(() => readStockObservationState(new URLSearchParams(query), holdingsEnabled), [query, holdingsEnabled]);
  const [searchDraft, setSearchDraft] = useState(state.search ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  useEffect(() => { if (!composing.current) setSearchDraft(state.search ?? ""); }, [state.search]);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const listRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const restoredScroll = useRef(false);
  const stocks = catalogue.data?.stocks ?? EMPTY_STOCKS;
  const coverage = useMemo(() => new Map(stocks.map(stock => [stock.ticker, stock])), [stocks]);
  const trend = MARKET_RANGES.find(item => item.key === range)!;
  const marketScope = state.scope === "movers" || state.scope === "active";
  const discovery = useMarketDiscovery(ready && marketScope, refreshToken);
  const board = state.scope === "movers" ? discovery.data?.movers : state.scope === "active" ? discovery.data?.active : undefined;
  const discovered = board?.items ?? EMPTY_DISCOVERY;
  const discoveryBySymbol = useMemo(() => new Map(discovered.map(item => [item.symbol, item])), [discovered]);
  const creatorScope = state.scope === "creators";
  const buzz = useSocialBuzz(ready && creatorScope && state.source !== "youtube");
  const social = creatorScope ? buzz.social : undefined;
  const redditNames = useMemo(() => new Map((buzz.social.reddit ?? []).map(row => [row.ticker, row.name])), [buzz.social.reddit]);

  const update = useCallback((next: StockObservationState) => {
    const params = writeStockObservationState(new URLSearchParams(window.location.search), next);
    // Next copies its router state itself; passing __NA would skip URL synchronization.
    window.history.replaceState(null, "", `${pathname}?${params}`);
    try {
      const preference = writeStockObservationState(new URLSearchParams(), { ...next, search: undefined, rows: STOCK_PAGE_SIZE });
      localStorage.setItem(STOCK_PREFERENCE_KEY, preference.toString());
    } catch { /* Filters still work when storage is unavailable. */ }
  }, [pathname]);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (!searchParams.has("stocks")) {
      try {
        const saved = localStorage.getItem(STOCK_PREFERENCE_KEY);
        if (saved) update(readStockObservationState(new URLSearchParams(saved), holdingsEnabled));
      } catch { /* Use the core list when preferences cannot be read. */ }
    }
    setReady(true);
  }, [searchParams, update, holdingsEnabled]);
  useEffect(() => {
    const checkDay = () => { if (!document.hidden) setNow(Date.now()); };
    document.addEventListener("visibilitychange", checkDay);
    const timer = window.setInterval(checkDay, 60_000);
    return () => { document.removeEventListener("visibilitychange", checkDay); window.clearInterval(timer); };
  }, []);

  // Quote batches never reorder visible rows halfway through a refresh.
  const sourceSymbols = selectObservationSymbols({ ...state, search: marketScope || state.scope === "creators" ? state.search : undefined, sort: marketScope ? state.sort : state.scope === "creators" ? state.sort === "latest" ? "latest" : "heat" : "default" }, stocks, held.tickers, {}, now, discovered, social);
  const quoteSymbols = marketScope || state.scope === "creators" && (state.sort === "heat" || state.sort === "latest") ? sourceSymbols.slice(0, state.rows) : sourceSymbols;
  const symbolKey = quoteSymbols.slice().sort().join(",");
  const { quotes, loading: quoteLoading, refreshing: quoteRefreshing, unavailable: quoteError } = useMarketQuotes(quoteSymbols, ready, attempt + refreshToken);
  const settledQuoteKey = quoteRefreshing ? null : symbolKey;

  const symbols = useMemo(() => selectObservationSymbols(state, stocks, held.tickers, quotes, now, discovered, social),
    [state, stocks, held.tickers, quotes, now, discovered, social]);
  const visible = symbols.slice(0, state.rows);
  const sourceLoading = marketScope ? discovery.loading : creatorScope ? (state.source !== "reddit" && state.source !== "x" && catalogue.loading && !catalogue.data) || (state.source !== "youtube" && buzz.loading) : state.scope === "holdings" && held.loading;
  const sourceError = marketScope ? discovery.error || board?.unavailable : creatorScope ? Boolean(state.source === "youtube" ? catalogue.error : state.source === "reddit" ? buzz.reddit.error : state.source === "x" ? buzz.x.error : catalogue.error && buzz.reddit.error && buzz.x.error) : state.scope === "holdings" && held.error;
  // In the combined list a failed source only narrows coverage; say which one is missing.
  const missingSources = creatorScope && state.source === "all" && !sourceError
    ? [catalogue.error && "YouTube", buzz.reddit.error && !buzz.social.reddit && "Reddit", buzz.x.error && !buzz.social.x && "X"].filter(Boolean) : [];
  const blocking = !ready || sourceLoading;
  const returnParams = writeStockObservationState(new URLSearchParams(searchParams.toString()), state);
  const returnHref = `${pathname}?${returnParams}`;
  const rememberScroll = () => {
    try { sessionStorage.setItem(`kolvex:market-scroll:${returnHref}`, String(listRef.current?.closest("main")?.scrollTop ?? 0)); } catch { /* Navigation stays available. */ }
  };
  useEffect(() => {
    if (blocking || quoteLoading || (sourceError && !symbols.length) || settledQuoteKey !== symbolKey || restoredScroll.current) return;
    restoredScroll.current = true;
    try {
      const saved = sessionStorage.getItem(`kolvex:market-scroll:${returnHref}`);
      if (saved !== null) {
        const top = Number(saved);
        const main = listRef.current?.closest("main");
        if (main && Number.isFinite(top) && top >= 0) main.scrollTop = top;
        sessionStorage.removeItem(`kolvex:market-scroll:${returnHref}`);
      }
    } catch { /* Native browser restoration remains available. */ }
  }, [blocking, quoteLoading, returnHref, settledQuoteKey, symbolKey, sourceError, symbols.length]);

  const changeScope = (scope: StockScope) => update({ scope, sector: "all", source: "all", sort: stockSorts(scope)[0], rows: STOCK_PAGE_SIZE, search: state.search });
  const changeSource = (source: StockSource) => {
    const sorts = stockSorts("creators", source);
    update({ ...state, source, sort: sorts.includes(state.sort) ? state.sort : sorts[0], rows: STOCK_PAGE_SIZE });
  };
  const defaultSort = stockSorts(state.scope, state.source)[0];
  const hasFilters = Boolean(state.search || state.sector !== "all");
  const resetFilters = () => {
    setSearchDraft("");
    update({ ...state, search: undefined, sector: "all", rows: STOCK_PAGE_SIZE });
  };
  const commitSearch = (search: string) => update({ ...state, search, rows: STOCK_PAGE_SIZE });
  const clearSearch = () => { setSearchDraft(""); commitSearch(""); searchRef.current?.focus(); };
  const scopeOptions = scopes.filter(scope => scope.key !== "holdings" || holdingsEnabled).map(scope => ({ value: scope.key, label: c(scope.en, scope.zh) }));
  const filtered = hasFilters || state.sort !== defaultSort || state.source !== "all";
  const resetAll = () => {
    setSearchDraft("");
    update({ ...state, search: undefined, sector: "all", source: "all", sort: stockSorts(state.scope)[0], rows: STOCK_PAGE_SIZE });
  };
  const listDescription = state.scope === "movers" ? c("Yahoo gainers + losers · ranked by snapshot move", "Yahoo 涨跌榜候选 · 按快照涨跌排序") : state.scope === "active" ? c("Active stocks · volume ≥ 1.5× 3M daily average", "活跃股候选 · 成交量至少为3个月日均的1.5倍") : state.scope === "core" ? c("Curated list · ranked within this list", "精选观察名单 · 名单内排序") : state.scope === "holdings" ? c("Linked equity holdings", "已连接的股票持仓") : state.sort === "latest" ? c("Source publication date · includes history", "按原文发布时间 · 包含历史观点") : state.source === "reddit" ? c("Reddit stock mentions in the past 24 hours · ApeWisdom", "Reddit 近 24 小时股票提及 · 来自 ApeWisdom") : state.source === "x" ? c("Cashtags in tracked X accounts' posts · past 7 days", "已收录 X 博主帖子中的股票代码 · 近 7 天") : state.source === "youtube" ? c("Opinions published in the past 7 days", "近 7 天发布的观点") : c("YouTube opinions (7d) + Reddit mentions (24h) + X posts (7d) · ranked by combined place", "YouTube 观点（7天）+ Reddit 提及（24小时）+ X 帖子（7天）· 按各来源名次综合排序");
  const rankingNotes = marketScope ? <>
    <p className="mt-2">{c("Yahoo Finance screener candidates, not a complete market ranking. US equities in USD, price ≥ $5, market cap ≥ $2B, session volume ≥ 20,000. Up to 100 candidates per source list; refreshed every minute while visible. Prices on the right refresh separately.", "来自 Yahoo Finance 筛选候选，并非全市场完整排名。范围为美元美股，股价至少5美元、市值至少20亿美元、当日成交量至少2万股；每个来源榜单最多100只，页面可见时每分钟更新。右侧报价单独刷新。")}</p>
    {state.scope === "active" && <p className="mt-1">{c("Volume multiple = accumulated session volume / full-day 3-month average. This is not a same-time-of-day comparison; early-session results may be empty.", "放量倍数 = 当日累计成交量 / 3个月全天日均成交量，不是与平常同一时刻比较；开盘初期可能暂无符合条件的股票。")}</p>}
    {board?.fetchedAt && <p className="mt-1">{c("Snapshot fetched", "榜单获取时间")} · {new Intl.DateTimeFormat(c("en-US", "zh-CN"), { timeZone: "America/New_York", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(board.fetchedAt))} {c("New York", "纽约时间")}</p>}
  </> : null;
  const listInfo = <>
    <p className="text-foreground">{listDescription}</p>
    {board?.sessionDate && <p className="mt-1">{c(`Session ${board.sessionDate}`, `交易日 ${board.sessionDate}`)}</p>}
    {rankingNotes}
  </>;
  return <div ref={listRef}>
    <Panel title={c("Stock watch", "股票观察")} id="market-movers" surface="card" action={<>
      <div className="ml-auto flex min-w-0 items-center gap-1 lg:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground" aria-label={c("About this list", "名单说明")}>
              <Info className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="!w-72 max-w-[calc(100vw-2rem)] p-3 text-xs leading-5 text-muted-foreground">
            {listInfo}
          </PopoverContent>
        </Popover>
        <FilterSheet title={c("Filter stocks", "筛选股票")} summary={scopeOptions.find(option => option.value === state.scope)?.label} active={filtered} onReset={resetAll}>
          <FilterSheetGroup label={c("List", "名单")} options={scopeOptions} value={state.scope} onChange={changeScope} />
          {state.scope === "core" && <FilterSheetGroup label={c("Sector", "行业")} options={STOCK_SECTORS.map(sector => ({ value: sector.key, label: c(sector.en, sector.zh) }))} value={state.sector} onChange={sector => update({ ...state, sector, rows: STOCK_PAGE_SIZE })} />}
          {creatorScope && <FilterSheetGroup label={c("Source", "来源")} options={STOCK_SOURCES.map(source => ({ value: source.key, label: c(source.en, source.zh) }))} value={state.source} onChange={changeSource} />}
          <FilterSheetGroup label={c("Sort", "排序")} options={stockSorts(state.scope, state.source).map(sort => ({ value: sort, label: c(...sortLabel(sort, state.source)) }))} value={state.sort} onChange={sort => update({ ...state, sort, rows: STOCK_PAGE_SIZE })} />
        </FilterSheet>
      </div>
      <div className="ml-auto hidden items-center gap-1 lg:flex">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground" aria-label={c("About this list", "名单说明")}>
              <Info className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="!w-72 max-w-[calc(100vw-2rem)] p-3 text-xs leading-5 text-muted-foreground">
            {listInfo}
          </PopoverContent>
        </Popover>
        <SegmentedControl label={c("Stock list", "股票列表")} value={state.scope} onChange={changeScope} wrap className="max-w-full border border-border" itemClassName="min-h-9 px-3" options={scopeOptions} />
      </div>
    </>}>
      <div id="stock-filters" className={cn("mb-3 grid grid-cols-2 items-end gap-3", state.scope === "core" ? "lg:grid-cols-[minmax(0,1fr)_9rem_9rem]" : creatorScope ? "lg:grid-cols-[minmax(0,1fr)_9rem_11rem]" : "lg:grid-cols-[minmax(0,1fr)_10rem]", "max-lg:hidden")}>
        <div className="hidden min-w-0 lg:block">
          <label htmlFor="stock-search" className="sr-only">{c("Search this list", "搜索当前名单")}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input shape="pill" ref={searchRef} id="stock-search" type="text" autoComplete="off" maxLength={100} placeholder={c("Ticker or company name", "股票代码或公司名称")} value={searchDraft}
              className="h-11 pl-10 pr-12" onChange={event => { setSearchDraft(event.target.value); if (!composing.current) commitSearch(event.target.value); }}
              onCompositionStart={() => { composing.current = true; }} onCompositionEnd={event => { composing.current = false; commitSearch(event.currentTarget.value); }}
              onKeyDown={event => { if (event.key === "Escape" && !composing.current) clearSearch(); }} />
            {searchDraft && <Button type="button" variant="ghost" size="icon" onClick={clearSearch} aria-label={c("Clear stock search", "清除股票搜索")} className="absolute right-0 top-0 h-11 w-11"><X className="h-4 w-4" aria-hidden="true" /></Button>}
          </div>
        </div>
        {state.scope === "core" && <div className="min-w-0">
          <label htmlFor="stock-sector" className="sr-only">{c("Sector", "行业")}</label>
          <Select value={state.sector} onValueChange={value => update({ ...state, sector: value as StockSector, rows: STOCK_PAGE_SIZE })}>
            <SelectTrigger shape="pill" id="stock-sector" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent className="!rounded-2xl">{STOCK_SECTORS.map(sector => <SelectItem key={sector.key} value={sector.key} className="min-h-11">{c(sector.en, sector.zh)}</SelectItem>)}</SelectContent>
          </Select>
        </div>}
        {creatorScope && <div className="min-w-0">
          <label htmlFor="stock-source" className="sr-only">{c("Discussion source", "讨论来源")}</label>
          <Select value={state.source} onValueChange={value => changeSource(value as StockSource)}>
            <SelectTrigger shape="pill" id="stock-source" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent className="!rounded-2xl">{STOCK_SOURCES.map(source => <SelectItem key={source.key} value={source.key} className="min-h-11">{c(source.en, source.zh)}</SelectItem>)}</SelectContent>
          </Select>
        </div>}
        <div className="min-w-0">
          <label htmlFor="stock-sort" className="sr-only">{c("Sort", "排序")}</label>
          <Select value={state.sort} onValueChange={value => update({ ...state, sort: value as StockSort, rows: STOCK_PAGE_SIZE })}>
            <SelectTrigger shape="pill" id="stock-sort" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent align="end" className="!rounded-2xl">{stockSorts(state.scope, state.source).map(sort => <SelectItem key={sort} value={sort} className="min-h-11">{c(...sortLabel(sort, state.source))}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs leading-5 text-muted-foreground max-lg:mb-0">
        {!blocking && (!sourceError || symbols.length > 0) && <p role="status" aria-live="polite" className="shrink-0 tabular-nums max-lg:sr-only">{c(`Showing ${visible.length} of ${symbols.length} stocks`, `已显示 ${visible.length} / ${symbols.length} 只`)}</p>}
      </div>
      {marketScope && (board?.partial && !board.unavailable || board?.stale) && <div role="status" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <p>{board.stale ? c("Refresh unavailable. Showing a saved ranking snapshot (up to 15 minutes old).", "更新暂不可用，显示最多15分钟内的榜单快照。") : c("Some source lists are unavailable; this ranking has partial coverage.", "部分来源榜单暂不可用，当前仅显示已取得的候选。")}</p>
        <Button variant="ghost" size="sm" disabled={discovery.refreshing} onClick={discovery.refresh}>{c("Retry ranking", "重试榜单")}</Button>
      </div>}
      {hasFilters && <div role="group" aria-label={c("Active stock filters", "当前股票筛选条件")} className="mb-3 flex flex-wrap items-center gap-2 [&_button]:max-lg:min-h-8">
        {state.search && <Button variant="secondary" size="sm" className="min-h-11 max-w-full gap-2" onClick={clearSearch} aria-label={c(`Remove search: ${state.search}`, `移除搜索：${state.search}`)}><span className="truncate">{state.search}</span><X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></Button>}
        {state.sector !== "all" && <Button variant="secondary" size="sm" className="min-h-11 gap-2" onClick={() => update({ ...state, sector: "all", rows: STOCK_PAGE_SIZE })} aria-label={c("Remove sector filter", "移除行业筛选")}>{c(STOCK_SECTORS.find(item => item.key === state.sector)!.en, STOCK_SECTORS.find(item => item.key === state.sector)!.zh)}<X className="h-3.5 w-3.5" aria-hidden="true" /></Button>}
        <Button variant="ghost" size="sm" className="min-h-11 gap-2 text-muted-foreground" onClick={resetFilters}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{c("Reset filters", "重置筛选")}</Button>
      </div>}
      {sourceError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p>{marketScope ? c(board?.items.length ? "Ranking refresh failed. Showing the last snapshot." : "Could not load this ranking.", board?.items.length ? "榜单更新失败，保留上次快照。" : "暂时无法加载这个榜单。") : c(catalogue.data ? "Could not refresh. Showing saved coverage." : "Could not load this list.", catalogue.data ? "更新失败，保留上次观点。" : "暂时无法加载这个列表。")}</p>
        <Button variant="outline" size="sm" disabled={marketScope && discovery.refreshing} onClick={marketScope ? discovery.refresh : () => { onRetry(); if (creatorScope) buzz.retry(); }}>{c("Retry", "重试")}</Button>
      </div>}
      {missingSources.length > 0 && <div role="status" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <p>{c(`${missingSources.join(", ")} unavailable right now; showing the other sources.`, `${missingSources.join("、")} 暂不可用，当前仅显示其他来源。`)}</p>
        <Button variant="ghost" size="sm" onClick={() => { if (catalogue.error) onRetry(); buzz.retry(); }}>{c("Retry", "重试")}</Button>
      </div>}
      {quoteError && <div role="status" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <p>{c("Some quotes could not be refreshed. Available prices are retained.", "部分报价更新失败，保留可用价格。")}</p>
        <Button size="sm" variant="ghost" disabled={quoteLoading} onClick={() => setAttempt(value => value + 1)}>{c("Retry quotes", "重试报价")}</Button>
      </div>}
      {state.scope === "core" && catalogue.error && <p role="status" className="mb-3 text-xs text-muted-foreground">{c("Creator insights are temporarily unavailable. Quotes remain available.", "博主线索暂不可用，仍可查看行情。")}</p>}
      <div aria-busy={blocking || quoteLoading}>
        <ListColumnHeader className="hidden md:flex">
          <div className={cn(ROW_GRID, "min-w-0 flex-1 px-2 py-3")}>
            <span>{c("Stock", "股票")}{!blocking && symbols.length > 0 && <span className="ml-1.5 tabular-nums lg:hidden">{visible.length} / {symbols.length}</span>}</span>
            <span className="hidden text-center min-[360px]:block">{c(`Trend · ${trend.en}`, `走势 · ${trend.zh}`)}</span>
            <span className="text-right">{c("Price / Today", "价格 / 今日")}</span>
          </div>
          <span className="w-11 shrink-0 text-center max-md:hidden">{c("Watch", "自选")}</span>
        </ListColumnHeader>
        {blocking ? <StockRowsSkeleton grid={ROW_GRID} trendClass="hidden min-[360px]:block" watchClass="max-md:hidden" reason label={c("Loading stocks", "正在加载股票")} /> : <ListRows aria-label={c("Stock watch", "股票观察")}>
          {visible.map(symbol => {
            const stock = coverage.get(symbol);
            const detailParams = new URLSearchParams({ from: returnHref });
            const href = `/dashboard/market/${encodeURIComponent(symbol)}`;
            return <ListRow key={symbol}>
              <Link href={`${href}?${detailParams}`} onClick={rememberScroll} className={cn(ROW_GRID, listRowTargetClass, "gap-y-1")}>
                <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <span aria-hidden="true" className="shrink-0"><CompanyLogo symbol={symbol} size="sm" /></span>
                  <span className="min-w-0"><span className="flex min-w-0 items-center gap-1.5 text-base font-semibold"><span className="truncate">{symbol}</span>{state.scope !== "holdings" && held.tickers.includes(symbol) && <HeldMark />}{(() => { const tag = stockEntryTag(state.scope, symbol, stock, discoveryBySymbol.get(symbol), now, social, state.source); return tag && <span className="shrink-0 rounded-full bg-foreground/[0.08] px-1.5 py-px text-[0.6875rem] font-medium tabular-nums text-muted-foreground lg:hidden">{c(...tag)}</span>; })()}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{quotes[symbol]?.name || discoveryBySymbol.get(symbol)?.name || stock?.company_name || coreNames.get(symbol) || redditNames.get(symbol) || symbol}</span></span>
                </span>
                <span className="hidden min-[360px]:block"><StockTrend symbol={symbol} period={trend.period} interval={trend.interval} rangeLabel={c(trend.en, trend.zh)} rangeKey={range} /></span>
                <span className="min-w-0 text-right">{quoteLoading && !quotes[symbol] ? <PendingValue className="h-10" /> : <><span className="figure block text-base font-medium">{money(quotes[symbol]?.price)}</span><Change value={quotes[symbol]?.changePercent} className="mt-1 block text-xs font-semibold" /></>}</span>
                <span className="col-span-full text-xs leading-5 text-muted-foreground max-lg:hidden">{c(...stockEntryReason(state.scope, symbol, stock, discoveryBySymbol.get(symbol), now, social, state.source))}</span>
              </Link>
              <div className="shrink-0 max-md:hidden"><WatchlistButton ticker={symbol} /></div>
            </ListRow>;
          })}
        </ListRows>}
        {!blocking && !symbols.length && !sourceError && <Empty action={hasFilters ? <Button variant="outline" size="sm" onClick={resetFilters}>{c("Reset filters", "重置筛选")}</Button> : state.scope === "creators" ? <Button variant="outline" size="sm" onClick={() => state.sort === "latest" ? changeScope("core") : update({ ...state, sort: "latest", rows: STOCK_PAGE_SIZE })}>{state.sort === "latest" ? c("Browse core stocks", "查看常看美股") : c("View historical opinions", "查看历史观点")}</Button> : state.scope === "holdings" ? <TextLink href="/dashboard/portfolio">{c("Connect an account", "连接账户")}</TextLink> : undefined}>
          {hasFilters ? c("No stocks match. Try another search or reset filters.", "没有符合条件的股票，试试其他关键词或重置筛选。") : state.scope === "active" ? c("No active candidates have reached 1.5× full-day average volume this session. Check again later.", "本交易日活跃候选中，暂无成交量达到全天日均1.5倍的股票，可稍后刷新。") : state.scope === "movers" ? c("No qualifying movers in the source lists yet.", "来源榜单中暂时没有符合条件的异动股票。") : state.scope === "creators" ? state.sort === "latest" ? c("No source-dated creator opinions yet.", "暂时没有带原文日期的博主观点。") : state.source === "reddit" ? c("No Reddit stock mentions in the latest ranking.", "最新 Reddit 榜单暂时没有股票提及。") : state.source === "x" ? c("No cashtags in tracked X posts from the past 7 days.", "近 7 天收录的 X 帖子中暂时没有股票代码。") : c("No creator opinions published in the past 7 days.", "近 7 天暂时没有博主观点更新。") : c("No stocks in this list yet.", "这个列表暂时没有股票。")}
        </Empty>}
        {!blocking && visible.length < symbols.length && <ListLoadMore onClick={() => update({ ...state, rows: state.rows + STOCK_PAGE_SIZE })}>{c(`Load ${Math.min(STOCK_PAGE_SIZE, symbols.length - visible.length)} more stocks`, `再看 ${Math.min(STOCK_PAGE_SIZE, symbols.length - visible.length)} 只股票`)}</ListLoadMore>}
      </div>
    </Panel>
  </div>;
}
