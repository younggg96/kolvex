"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/ui/company-logo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import { isProductFeatureEnabled } from "@/lib/productFeatures";
import { getCachedMarketQuotes, loadMarketQuotes } from "@/lib/marketQuotes";
import { formatOpinionDate, opinionDay } from "@/lib/opinionDates";
import {
  CORE_STOCKS, STOCK_PAGE_SIZE, STOCK_PREFERENCE_KEY, STOCK_SECTORS,
  latestStockOpinionDate, readStockObservationState, recentStockOpinionCount,
  selectObservationSymbols, stockSorts, writeStockObservationState,
  type StockObservationState, type StockScope, type StockSector, type StockSort,
} from "@/lib/stockDiscovery";
import type { StockQuote } from "@/lib/stockApi";
import type { YouTubeStockSummary } from "@/lib/youtubeOpinionsApi";
import { cn } from "@/lib/utils";
import { MARKET_RANGES } from "@/lib/marketObservations";
import { Change, Empty, HeldMark, Panel, TextLink, money, useCopy, useCreatorCatalogue, useHeldTickers } from "./shared";
import StockTrend from "./StockTrend";

const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_80px] gap-x-3 min-[400px]:grid-cols-[minmax(0,1fr)_60px_80px] sm:grid-cols-[minmax(0,1fr)_100px_100px] sm:gap-x-4";
const scopes: { key: StockScope; en: string; zh: string }[] = [
  { key: "core", en: "Core US stocks", zh: "常看美股" },
  { key: "creators", en: "Creator activity", zh: "博主关注" },
  { key: "holdings", en: "My holdings", zh: "我的持仓" },
];
const sortLabels: Record<StockSort, [string, string]> = {
  move: ["Daily move", "今日波动"], gainers: ["Gainers first", "涨幅优先"],
  losers: ["Losers first", "跌幅优先"], default: ["List order", "名单顺序"],
  heat: ["Discussion · 7 days", "近期讨论 · 7 天"], latest: ["Latest opinion", "最新观点"],
};
const coreNames = new Map<string, string>(CORE_STOCKS.map(stock => [stock.symbol, stock.name]));
const EMPTY_STOCKS: YouTubeStockSummary[] = [];

export default function StockObservationList({ range, catalogue, held, onRetry }: {
  range: (typeof MARKET_RANGES)[number]["key"];
  catalogue: ReturnType<typeof useCreatorCatalogue>;
  held: ReturnType<typeof useHeldTickers>;
  onRetry: () => void;
}) {
  const c = useCopy();
  const { locale } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const holdingsEnabled = isProductFeatureEnabled("portfolio");
  const query = searchParams.toString();
  const state = useMemo(() => readStockObservationState(new URLSearchParams(query), holdingsEnabled), [query, holdingsEnabled]);
  const [ready, setReady] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState(false);
  const [settledQuoteKey, setSettledQuoteKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const today = opinionDay(new Date(now).toISOString());
  const listRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const restoredScroll = useRef(false);
  const lastQuoteAttempt = useRef(0);
  const stocks = catalogue.data?.stocks ?? EMPTY_STOCKS;
  const coverage = useMemo(() => new Map(stocks.map(stock => [stock.ticker, stock])), [stocks]);
  const trend = MARKET_RANGES.find(item => item.key === range)!;

  const update = useCallback((next: StockObservationState) => {
    const params = writeStockObservationState(new URLSearchParams(window.location.search), next);
    // Next copies its router state itself; passing __NA would skip URL synchronization.
    window.history.replaceState(null, "", `${pathname}?${params}`);
    try {
      const preference = writeStockObservationState(new URLSearchParams(), { ...next, rows: STOCK_PAGE_SIZE });
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
  const sourceSymbols = selectObservationSymbols({ ...state, sort: state.scope === "creators" ? state.sort === "latest" ? "latest" : "heat" : "default" }, stocks, held.tickers, {}, now);
  const quoteSymbols = state.scope === "creators" && (state.sort === "heat" || state.sort === "latest") ? sourceSymbols.slice(0, state.rows) : sourceSymbols;
  const symbolKey = quoteSymbols.slice().sort().join(",");
  useEffect(() => {
    if (!ready) return;
    const force = lastQuoteAttempt.current !== attempt;
    lastQuoteAttempt.current = attempt;
    const controller = new AbortController();
    const symbols = symbolKey ? symbolKey.split(",") : [];
    const cached = getCachedMarketQuotes(symbols);
    setQuotes(cached);
    setQuoteLoading(symbols.length > 0);
    setQuoteError(false);
    if (!symbols.length) {
      setSettledQuoteKey(symbolKey);
      return () => controller.abort();
    }
    loadMarketQuotes(symbols, controller.signal, () => {}, force).then(result => {
      if (controller.signal.aborted) return;
      setQuotes(result.quotes);
      setQuoteError(result.unavailable);
      setQuoteLoading(false);
      setSettledQuoteKey(symbolKey);
    });
    return () => controller.abort();
  }, [symbolKey, attempt, ready]);

  const symbols = useMemo(() => selectObservationSymbols(state, stocks, held.tickers, quotes, now),
    [state, stocks, held.tickers, quotes, now]);
  const visible = symbols.slice(0, state.rows);
  const sourceLoading = state.scope === "creators" ? catalogue.loading && !catalogue.data : state.scope === "holdings" && held.loading;
  const sourceError = state.scope === "creators" ? catalogue.error : state.scope === "holdings" && held.error;
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

  function evidence(stock: YouTubeStockSummary) {
    const count = recentStockOpinionCount(stock, now);
    const date = latestStockOpinionDate(stock, now);
    if (state.scope === "creators" && state.sort !== "latest" && count !== null && count > 0) return c(`${count} opinions · past 7 days`, `近 7 天 · ${count} 条观点`);
    if (!date) return null;
    const author = stock.latest_evidence?.channel_title;
    const label = formatOpinionDate(date, locale === "zh" ? "zh-CN" : "en-US");
    if (state.scope !== "creators") {
      const age = Date.parse(`${today}T12:00:00Z`) - Date.parse(`${opinionDay(date)}T12:00:00Z`);
      if (age >= 7 * 86400_000) return null;
    }
    return `${label} · ${author || c("Creator opinion", "博主观点")}`;
  }
  const changeScope = (scope: StockScope) => update({ scope, sector: "all", sort: stockSorts(scope)[0], rows: STOCK_PAGE_SIZE });

  return <div ref={listRef}>
    <Panel title={c("Stock watch", "股票观察")} id="market-movers">
      <div role="group" aria-label={c("Stock list", "股票列表")} className="flex flex-wrap gap-1 py-4">
        {scopes.filter(scope => scope.key !== "holdings" || holdingsEnabled).map(scope => <Button key={scope.key} variant={state.scope === scope.key ? "default" : "ghost"} size="sm" className="min-h-11 px-4" aria-pressed={state.scope === scope.key} onClick={() => changeScope(scope.key)}>{c(scope.en, scope.zh)}</Button>)}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        {state.scope === "core" ? <div className="min-w-0">
          <label htmlFor="stock-sector" className="mb-1.5 block text-xs text-muted-foreground">{c("Sector", "行业")}</label>
          <Select value={state.sector} onValueChange={value => update({ ...state, sector: value as StockSector, rows: STOCK_PAGE_SIZE })}>
            <SelectTrigger id="stock-sector" className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{STOCK_SECTORS.map(sector => <SelectItem key={sector.key} value={sector.key} className="min-h-11">{c(sector.en, sector.zh)}</SelectItem>)}</SelectContent>
          </Select>
        </div> : <p className="self-end pb-3 text-xs leading-5 text-muted-foreground">{state.scope === "creators" ? state.sort === "latest" ? c("Source publication date · includes history", "按原文发布时间 · 包含历史观点") : c("Opinions published in the past 7 days", "近 7 天发布的观点") : c("Linked equity holdings", "已连接的股票持仓")}</p>}
        <div className="min-w-0">
          <label htmlFor="stock-sort" className="mb-1.5 block text-xs text-muted-foreground">{c("Sort", "排序")}</label>
          <Select value={state.sort} onValueChange={value => update({ ...state, sort: value as StockSort, rows: STOCK_PAGE_SIZE })}>
            <SelectTrigger id="stock-sort" className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent align="end">{stockSorts(state.scope).map(sort => <SelectItem key={sort} value={sort} className="min-h-11">{c(...sortLabels[sort])}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs leading-5 text-muted-foreground">
        <p>{state.scope === "core" ? c("Curated cross-sector list · ranked within this list", "跨行业观察名单 · 名单内排序") : state.scope === "holdings" ? c("Linked holdings · ranked within this list", "已连接持仓 · 名单内排序") : c("Imported creator coverage · ranked within this list", "已收录博主观点 · 名单内排序")}</p>
        {!blocking && (!sourceError || symbols.length > 0) && <p role="status" aria-live="polite">{c(`${visible.length} of ${symbols.length} stocks`, `${visible.length} / ${symbols.length} 只`)}</p>}
      </div>
      {sourceError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p>{c(catalogue.data ? "Could not refresh. Showing saved coverage." : "Could not load this list.", catalogue.data ? "更新失败，保留上次观点。" : "暂时无法加载这个列表。")}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>{c("Retry", "重试")}</Button>
      </div>}
      {quoteError && <div role="status" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <p>{c("Some quotes could not be refreshed. Available prices are retained.", "部分报价更新失败，保留可用价格。")}</p>
        <Button size="sm" variant="ghost" disabled={quoteLoading} onClick={() => setAttempt(value => value + 1)}>{c("Retry quotes", "重试报价")}</Button>
      </div>}
      {state.scope === "core" && catalogue.error && <p role="status" className="mb-3 text-xs text-muted-foreground">{c("Creator insights are temporarily unavailable. Quotes remain available.", "博主线索暂不可用，仍可查看行情。")}</p>}
      <div aria-busy={blocking || quoteLoading}>
        <div className={cn(ROW_GRID, "rounded-lg bg-muted/60 px-2 py-3 text-xs text-muted-foreground")} aria-hidden="true">
          <span>{c("Stock / creator activity", "股票 / 观点线索")}</span>
          <span className="hidden text-center min-[400px]:block">{c(`Trend · ${trend.en}`, `走势 · ${trend.zh}`)}</span>
          <span className="text-right">{c("Price / Today", "价格 / 今日")}</span>
        </div>
        {blocking ? <div role="status" aria-label={c("Loading stocks", "正在加载股票")}>
          {[0, 1, 2, 3, 4].map(row => <div key={row} className="flex min-h-24 items-center justify-between gap-4 border-b border-border px-2 py-4"><Skeleton className="h-10 w-36" /><Skeleton className="h-8 w-20" /></div>)}
        </div> : <ul className="divide-y divide-border" aria-label={c("Stock watch", "股票观察")}>
          {visible.map(symbol => {
            const stock = coverage.get(symbol);
            const clue = stock ? evidence(stock) : null;
            const detailParams = new URLSearchParams({ from: returnHref });
            const href = `/dashboard/market/${encodeURIComponent(symbol)}`;
            return <li key={symbol}>
              <Link href={`${href}?${detailParams}`} onClick={rememberScroll} className={cn(ROW_GRID, "min-h-20 items-center rounded-lg px-2 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary")}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden="true" className="shrink-0"><CompanyLogo symbol={symbol} size="sm" /></span>
                  <span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{symbol}{state.scope !== "holdings" && held.tickers.includes(symbol) && <HeldMark />}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{quotes[symbol]?.name || stock?.company_name || coreNames.get(symbol) || symbol}</span></span>
                </span>
                <span className="hidden min-[400px]:block"><StockTrend symbol={symbol} period={trend.period} interval={trend.interval} rangeLabel={c(trend.en, trend.zh)} rangeKey={range} /></span>
                <span className="min-w-0 text-right">{quoteLoading && !quotes[symbol] ? <Skeleton className="ml-auto h-10 w-20" /> : <><span className="figure block text-[15px] font-medium">{money(quotes[symbol]?.price)}</span><Change value={quotes[symbol]?.changePercent} className="mt-1 block text-xs font-semibold" /></>}</span>
              </Link>
              {clue && <Link href={`${href}?${detailParams}&insight=creators#stock-insights`} onClick={rememberScroll} aria-label={c(`${symbol}: ${clue}. Read creator opinions`, `${symbol}：${clue}，查看博主观点`)} className="-mt-2 mb-1 ml-[50px] flex min-h-11 w-fit max-w-[calc(100%-58px)] items-center gap-1 rounded-sm pr-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="min-w-0 truncate">{clue}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></Link>}
            </li>;
          })}
        </ul>}
        {!blocking && !symbols.length && !sourceError && <Empty action={state.scope === "creators" ? <Button variant="outline" size="sm" onClick={() => state.sort === "latest" ? changeScope("core") : update({ ...state, sort: "latest", rows: STOCK_PAGE_SIZE })}>{state.sort === "latest" ? c("Browse core stocks", "查看常看美股") : c("View historical opinions", "查看历史观点")}</Button> : state.scope === "holdings" ? <TextLink href="/dashboard/portfolio">{c("Connect an account", "连接账户")}</TextLink> : undefined}>
          {state.scope === "creators" ? state.sort === "latest" ? c("No source-dated creator opinions yet.", "暂时没有带原文日期的博主观点。") : c("No creator opinions published in the past 7 days.", "近 7 天暂时没有博主观点更新。") : c("No stocks in this list yet.", "这个列表暂时没有股票。")}
        </Empty>}
        {!blocking && visible.length < symbols.length && <div className="flex justify-center py-4"><Button variant="outline" size="sm" className="min-h-11" onClick={() => update({ ...state, rows: state.rows + STOCK_PAGE_SIZE })}>{c(`Load ${Math.min(STOCK_PAGE_SIZE, symbols.length - visible.length)} more stocks`, `再看 ${Math.min(STOCK_PAGE_SIZE, symbols.length - visible.length)} 只股票`)}</Button></div>}
      </div>
    </Panel>
  </div>;
}
