"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Search, Star, X } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanyLogo from "@/components/ui/company-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PendingValue } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { StockRowsSkeleton } from "@/components/decision/StockRowsSkeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterSheet, FilterSheetGroup } from "@/components/ui/filter-sheet";
import { ListCard, ListColumnHeader, ListLoadMore, ListRow, ListRows, listRowTargetClass } from "@/components/ui/list-card";
import { useWatchlist } from "@/hooks/useWatchlist";
import { MARKET_RANGES } from "@/lib/marketObservations";
import { normalizeWatchlistTicker } from "@/lib/watchlist";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { CORE_STOCKS } from "@/lib/stockDiscovery";
import { cn } from "@/lib/utils";
import { Change, money, useCopy } from "./shared";
import StockTrend from "./StockTrend";
import WatchlistButton from "./WatchlistButton";

const names = new Map<string, string>(CORE_STOCKS.map(stock => [stock.symbol, stock.name]));
const PAGE_SIZE = 20;
const trend = MARKET_RANGES[0];
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_80px] gap-x-2 min-[400px]:grid-cols-[minmax(0,1fr)_60px_80px] sm:grid-cols-[minmax(0,1fr)_100px_100px] sm:gap-x-4";

export default function Watchlist() {
  const c = useCopy();
  const { watchlist, ready, add, canEdit, pending, error, userId } = useWatchlist();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const sort = ["gainers", "losers", "symbol"].includes(params.get("sort") ?? "") ? params.get("sort")! : "added";
  const [draft, setDraft] = useState(query);
  const search = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const tickerInput = useRef<HTMLInputElement>(null);
  const tickerComposing = useRef(false);
  const [ticker, setTicker] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [rows, setRows] = useState(PAGE_SIZE);
  const [attempt, setAttempt] = useState(0);
  const { quotes, loading, unavailable } = useMarketQuotes(watchlist, ready, attempt);
  useEffect(() => { if (!composing.current) setDraft(query); setRows(PAGE_SIZE); }, [query, sort]);
  useEffect(() => { document.title = c("Watchlist | Kolvex", "自选股 | Kolvex"); }, [c]);

  const sortOptions = [
    { value: "added", label: c("Recently added", "最近添加") }, { value: "symbol", label: c("Symbol A–Z", "代码 A–Z") },
    { value: "gainers", label: c("Gainers first", "涨幅优先") }, { value: "losers", label: c("Losers first", "跌幅优先") },
  ];
  function update(q: string, nextSort = sort) {
    const next = new URLSearchParams(window.location.search);
    q ? next.set("q", q) : next.delete("q");
    nextSort === "added" ? next.delete("sort") : next.set("sort", nextSort);
    window.history.replaceState(null, "", `/dashboard/watchlist${next.size ? `?${next}` : ""}`);
    setRows(PAGE_SIZE);
  }
  const clear = () => { setDraft(""); update(""); search.current?.focus(); };
  async function addTicker(event: FormEvent) {
    event.preventDefault();
    if (tickerComposing.current || !canEdit) return;
    const symbol = normalizeWatchlistTicker(ticker);
    if (!symbol) { setInvalid(true); tickerInput.current?.focus(); return; }
    if (watchlist.includes(symbol)) {
      toast(c(`${symbol} is already in your Watchlist`, `${symbol} 已在自选股中`));
      tickerInput.current?.focus(); return;
    }
    const success = await add(symbol);
    if (!success) return;
    setTicker(""); setInvalid(false); clear();
    toast(c(`${symbol} added to Watchlist`, `已将 ${symbol} 加入自选股`));
    tickerInput.current?.focus();
  }
  const filtered = useMemo(() => {
    const term = query.trim().replace(/^\$/, "").toLowerCase();
    const result = watchlist.filter(symbol => `${symbol} ${quotes[symbol]?.name ?? names.get(symbol) ?? ""}`.toLowerCase().includes(term));
    return result.slice().sort((a, b) => {
      if (sort === "symbol") return a.localeCompare(b);
      if (sort === "added") return watchlist.indexOf(b) - watchlist.indexOf(a);
      const left = quotes[a]?.changePercent, right = quotes[b]?.changePercent;
      if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : a.localeCompare(b);
      if (!Number.isFinite(right)) return -1;
      return sort === "gainers" ? right! - left! : left! - right!;
    });
  }, [watchlist, query, sort, quotes]);
  const returnHref = `/dashboard/watchlist${params.size ? `?${params}` : ""}`;
  const showingCount = c(`Showing ${Math.min(rows, filtered.length)} of ${filtered.length} stocks`, `已显示 ${Math.min(rows, filtered.length)} / ${filtered.length} 只`);

  return <DashboardLayout title={c("Watchlist", "自选股")}>
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-[16px] pb-16 pt-6 md:px-8 md:pt-8">
        <div className="flex items-start justify-between gap-4">
          <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c("Watchlist", "自选股")}</h1></div>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={c("Refresh Watchlist quotes", "刷新自选股行情")} title={c("Refresh quotes", "刷新行情")} disabled={!ready || loading || !watchlist.length} onClick={() => setAttempt(value => value + 1)}><RefreshCw className="h-4 w-4" aria-hidden="true" /></Button>
        </div>
        <form noValidate onSubmit={addTicker} aria-label={c("Add a stock", "添加自选股")} className="space-y-2">
          <label htmlFor="watchlist-ticker" className="block text-sm font-medium">{c("Add a stock", "添加股票")}</label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1"><Input ref={tickerInput} id="watchlist-ticker" disabled={pending} value={ticker} onChange={event => { setTicker(event.target.value); setInvalid(false); }} placeholder={c("Stock symbol, e.g. AAPL or BRK-B", "输入股票代码，如 AAPL、BRK-B")} maxLength={20} autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-invalid={invalid} aria-describedby="watchlist-ticker-help" className="h-11 pr-11"
              onCompositionStart={() => { tickerComposing.current = true; }} onCompositionEnd={() => { tickerComposing.current = false; }} onKeyDown={event => { if (event.key === "Enter" && (event.nativeEvent.isComposing || tickerComposing.current || event.keyCode === 229)) event.preventDefault(); }} />
              {ticker && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-11" aria-label={c("Clear stock symbol", "清空股票代码")} onClick={() => { setTicker(""); setInvalid(false); tickerInput.current?.focus(); }}><X className="h-4 w-4" aria-hidden="true" /></Button>}
            </div>
            <Button type="submit" disabled={!canEdit} aria-busy={pending} className="h-11 shrink-0"><Plus className="mr-2 h-4 w-4" aria-hidden="true" />{c("Add", "添加")}</Button>
          </div>
          <p id="watchlist-ticker-help" role={invalid ? "alert" : undefined} className={`text-xs ${invalid ? "text-negative" : "text-muted-foreground"}`}>{invalid ? c("Enter a valid symbol, e.g. AAPL or BRK-B.", "请输入有效的股票代码，如 AAPL、BRK-B。") : c("Shared with your Reddit follows and synced to your account.", "与 Reddit 关注共用，登录后同步到账号。")}</p>
        </form>
        {!ready ? <WatchlistCardSkeleton /> : (!userId || error) && !watchlist.length ? null : !watchlist.length ? <div className="glass-card bg-card-glass rounded-3xl border border-foreground/10 py-16 text-center">
          <Star className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold">{c("No stocks in your Watchlist yet", "还没有自选股")}</h2><Button asChild variant="outline" className="mt-6"><Link href="/dashboard">{c("Browse Markets", "浏览行情")}</Link></Button>
        </div> : <section aria-label={c("Saved stocks", "已添加的股票")} className="space-y-3">
          <ListCard>
            <div className="flex items-center justify-between gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_12rem]">
              <p role="status" className="text-xs tabular-nums text-muted-foreground lg:hidden">{showingCount}</p>
              <div className="hidden lg:block"><label htmlFor="watchlist-search" className="mb-2 block text-xs text-muted-foreground">{c("Search Watchlist", "搜索自选股")}</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="watchlist-search" ref={search} value={draft} placeholder={c("Ticker or company name", "股票代码或公司名称")} className="h-11 pl-10 pr-11" maxLength={100} onChange={event => { setDraft(event.target.value); if (!composing.current) update(event.target.value); }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={event => { composing.current = false; update(event.currentTarget.value); }} onKeyDown={event => { if (event.key === "Escape" && !composing.current) clear(); }} />{draft && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-11" aria-label={c("Clear Watchlist search", "清除自选股搜索")} onClick={clear}><X className="h-4 w-4" aria-hidden="true" /></Button>}</div></div>
              <FilterSheet title={c("Sort", "排序")} summary={sortOptions.find(option => option.value === sort)?.label} active={sort !== "added"} onReset={() => update(query, "added")} triggerClassName="shrink-0"><FilterSheetGroup label={c("Sort", "排序")} options={sortOptions} value={sort} onChange={value => update(query, value)} /></FilterSheet>
              <div className="hidden lg:block"><label htmlFor="watchlist-sort" className="mb-2 block text-xs text-muted-foreground">{c("Sort", "排序")}</label><Select value={sort} onValueChange={value => update(query, value)}><SelectTrigger id="watchlist-sort" className="h-11"><SelectValue /></SelectTrigger><SelectContent align="end">{sortOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs leading-5 text-muted-foreground">
              <p role="status" className="hidden tabular-nums lg:block">{showingCount}</p>
              <p>{c("Saved stocks · ranked within this list", "自选名单 · 名单内排序")}</p>
            </div>
            {unavailable && <div role="status" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><p>{c("Some quotes are unavailable. Check the symbol or retry; saved stocks are retained.", "部分报价暂不可用，请检查代码或重试，自选股仍会保留。")}</p><Button variant="outline" size="sm" disabled={loading} onClick={() => setAttempt(value => value + 1)}>{c("Retry quotes", "重试报价")}</Button></div>}
            <div aria-busy={loading} className="mt-3">
              <ListColumnHeader>
                <div className={cn(ROW_GRID, "min-w-0 flex-1 px-2 py-3")}>
                  <span>{c("Stock", "股票")}</span>
                  <span className="hidden text-center min-[400px]:block">{c(`Trend · ${trend.en}`, `走势 · ${trend.zh}`)}</span>
                  <span className="text-right">{c("Price / Today", "价格 / 今日")}</span>
                </div>
                <span className="w-11 shrink-0 text-center">{c("Watch", "自选")}</span>
              </ListColumnHeader>
              <ListRows aria-label={c("Saved stocks", "已添加的股票")}>
                {filtered.slice(0, rows).map(symbol => <ListRow key={symbol}>
                  <Link href={`/dashboard/market/${encodeURIComponent(symbol)}?${new URLSearchParams({ from: returnHref })}`} className={cn(ROW_GRID, listRowTargetClass)}>
                    <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <span aria-hidden="true" className="shrink-0"><CompanyLogo symbol={symbol} size="sm" /></span>
                      <span className="min-w-0"><span className="block truncate text-base font-semibold">{symbol}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{quotes[symbol]?.name || names.get(symbol) || c("Stock details", "查看个股详情")}</span></span>
                    </span>
                    <span className="hidden min-[400px]:block"><StockTrend symbol={symbol} period={trend.period} interval={trend.interval} rangeLabel={c(trend.en, trend.zh)} rangeKey="1D" /></span>
                    <span className="min-w-0 text-right">{loading && !quotes[symbol] ? <PendingValue className="h-10" /> : <><span className="figure block text-base font-medium">{money(quotes[symbol]?.price)}</span><Change value={quotes[symbol]?.changePercent} className="mt-1 block text-xs font-semibold" /></>}</span>
                  </Link>
                  <WatchlistButton ticker={symbol} onRemoved={() => tickerInput.current?.focus()} />
                </ListRow>)}
              </ListRows>
            </div>
            {!filtered.length && <div className="py-12 text-center"><p className="text-sm text-muted-foreground">{c("No saved stocks match your search.", "没有符合搜索条件的自选股。")}</p><Button variant="outline" className="mt-4" onClick={clear}>{c("Clear search", "清除搜索")}</Button></div>}
            {filtered.length > rows && <ListLoadMore onClick={() => setRows(value => value + PAGE_SIZE)}>{c("Load more", "加载更多")}</ListLoadMore>}
          </ListCard>
          <p className="text-xs leading-5 text-muted-foreground">{c("Prices use the existing market data source and may be delayed. Unavailable quotes show a dash.", "报价来自现有行情数据源，可能存在延迟；缺失报价显示为横线。")}</p>
        </section>}
      </div>
    </main>
  </DashboardLayout>;
}

/** Saved-stocks card placeholder: search/sort controls, count line, column header and stock rows. */
function WatchlistCardSkeleton() {
  const c = useCopy();
  return <ListCard aria-busy="true">
    <div className="flex items-center justify-between gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_12rem]">
      <Skeleton className="h-3.5 w-20 rounded-md lg:hidden" />
      <div className="hidden lg:block"><Skeleton className="mb-2 h-3.5 w-24 rounded-md" /><Skeleton className="h-11 rounded-xl" /></div>
      <div className="w-40 shrink-0 lg:w-auto"><Skeleton className="mb-2 hidden h-3.5 w-10 rounded-md lg:block" /><Skeleton className="h-11 rounded-xl" /></div>
    </div>
    <div className="mt-3 flex justify-between"><Skeleton className="hidden h-3.5 w-20 rounded-md lg:block" /><Skeleton className="h-3.5 w-40 rounded-md" /></div>
    <div className="mt-3">
      <div aria-hidden="true" className="border-b border-border px-2 py-3"><Skeleton className="h-3.5 w-1/3 rounded-md" /></div>
      <StockRowsSkeleton grid={ROW_GRID} trendClass="hidden min-[400px]:block" label={c("Loading Watchlist", "正在加载自选股")} />
    </div>
  </ListCard>;
}

/** Route fallback in the Watchlist frame: heading, add-stock form, then the saved-stocks card. */
export function WatchlistPageSkeleton({ noTransition = false }: { noTransition?: boolean }) {
  const c = useCopy();
  return <DashboardLayout title={c("Watchlist", "自选股")} noTransition={noTransition}>
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-[16px] pb-16 pt-6 md:px-8 md:pt-8">
        <div className="flex items-start justify-between gap-4"><div className="flex flex-col gap-3"><Skeleton className="h-8 w-28 rounded-lg sm:h-9" /><Skeleton className="h-4 w-60 rounded-md" /></div><Skeleton className="h-11 w-11 rounded-full" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-20 rounded-md" /><div className="flex gap-2"><Skeleton className="h-11 flex-1 rounded-xl" /><Skeleton className="h-11 w-20 rounded-full" /></div><Skeleton className="h-3 w-64 rounded-md" /></div>
        <WatchlistCardSkeleton />
      </div>
    </main>
  </DashboardLayout>;
}
