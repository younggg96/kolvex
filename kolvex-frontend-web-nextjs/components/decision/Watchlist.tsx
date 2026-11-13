"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, Plus, RefreshCw, Star, X } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanyLogo from "@/components/ui/company-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchFieldIcon } from "@/components/ui/search-input";
import { PendingValue } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { StockRowsSkeleton } from "@/components/decision/StockRowsSkeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterSheet, FilterSheetGroup } from "@/components/ui/filter-sheet";
import { ListCard, ListColumnHeader, ListLoadMore, ListRow, ListRows, listRowTargetClass } from "@/components/ui/list-card";
import { useWatchlist } from "@/hooks/useWatchlist";
import { groupBySector, sectorLabel, useStockSectors } from "@/hooks/useStockSectors";
import { MARKET_RANGES } from "@/lib/marketObservations";
import { normalizeWatchlistTicker } from "@/lib/watchlist";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { CORE_STOCKS } from "@/lib/stockDiscovery";
import { cn } from "@/lib/utils";
import { Change, money, useCopy, useCreatorCatalogue } from "./shared";
import StockTrend from "./StockTrend";
import WatchlistButton from "./WatchlistButton";
import WatchlistStockSheet from "./WatchlistStockSheet";
import StockDirectoryInsight from "@/components/youtube/StockDirectoryRow";
import type { YouTubeStockSummary } from "@/lib/youtubeOpinionsApi";

const names = new Map<string, string>(CORE_STOCKS.map(stock => [stock.symbol, stock.name]));
const PAGE_SIZE = 20;
const trend = MARKET_RANGES[0];
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_52px_76px] gap-x-2 min-[400px]:grid-cols-[minmax(0,1fr)_60px_80px] sm:grid-cols-[minmax(0,1fr)_100px_100px] sm:gap-x-4";

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
  const { sectors } = useStockSectors(watchlist);
  // Group the sorted list by sector (group order follows its best-ranked stock); "Load more" counts rows across groups.
  const groups = useMemo(() => {
    let budget = rows;
    return groupBySector(filtered, sectors).flatMap(([sector, symbols]) => {
      if (budget <= 0) return [];
      const shown = symbols.slice(0, budget);
      budget -= shown.length;
      return [[sector, shown] as const];
    });
  }, [filtered, sectors, rows]);
  const { data: creatorCatalogue } = useCreatorCatalogue();
  const creatorStocks = useMemo(() => new Map<string, YouTubeStockSummary>((creatorCatalogue?.stocks ?? []).map(stock => [stock.ticker.toUpperCase(), stock])), [creatorCatalogue]);
  const companyName = (symbol: string) => quotes[symbol]?.name || names.get(symbol) || creatorStocks.get(symbol)?.company_name || undefined;
  const [preview, setPreview] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const returnHref = `/dashboard/watchlist${params.size ? `?${params}` : ""}`;
  const stockHref = (symbol: string) => `/dashboard/market/${encodeURIComponent(symbol)}?${new URLSearchParams({ from: returnHref })}`;

  return <DashboardLayout title={c("Watchlist", "自选股")}>
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-[16px] pb-10 pt-6 md:px-8 md:pt-8">
        {!ready ? <WatchlistCardSkeleton /> : (!userId || error) && !watchlist.length ? null : !watchlist.length ? <div className="glass-card bg-card-glass rounded-3xl border border-foreground/10 py-16 text-center">
          <Star className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold">{c("No stocks in your Watchlist yet", "还没有自选股")}</h2><Button asChild variant="outline" className="mt-6"><Link href="/dashboard">{c("Browse Markets", "浏览行情")}</Link></Button>
        </div> : <section aria-label={c("Saved stocks", "已添加的股票")} className="space-y-3">
          <ListCard>
            <div className="flex items-center justify-between gap-3 lg:block">
              <h2 className="text-lg font-semibold lg:hidden">{c("Watchlist", "自选股")}</h2>
              <div className="flex items-center justify-end gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-end">
                <div className="hidden lg:block"><label htmlFor="watchlist-search" className="mb-2 block text-xs text-muted-foreground">{c("Search Watchlist", "搜索自选股")}</label><div className="relative"><SearchFieldIcon /><Input id="watchlist-search" ref={search} value={draft} placeholder={c("Ticker or company name", "股票代码或公司名称")} className="h-11 pl-10 pr-11" maxLength={100} onChange={event => { setDraft(event.target.value); if (!composing.current) update(event.target.value); }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={event => { composing.current = false; update(event.currentTarget.value); }} onKeyDown={event => { if (event.key === "Escape" && !composing.current) clear(); }} />{draft && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-11" aria-label={c("Clear Watchlist search", "清除自选股搜索")} onClick={clear}><X className="h-4 w-4" aria-hidden="true" /></Button>}</div></div>
                <FilterSheet title={c("Sort", "排序")} summary={sortOptions.find(option => option.value === sort)?.label} active={sort !== "added"} onReset={() => update(query, "added")} triggerClassName="shrink-0"><FilterSheetGroup label={c("Sort", "排序")} options={sortOptions} value={sort} onChange={value => update(query, value)} /></FilterSheet>
                <div className="hidden lg:block"><label htmlFor="watchlist-sort" className="mb-2 block text-xs text-muted-foreground">{c("Sort", "排序")}</label><Select value={sort} onValueChange={value => update(query, value)}><SelectTrigger id="watchlist-sort" className="h-11"><SelectValue /></SelectTrigger><SelectContent align="end">{sortOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </div>
            {unavailable && <div role="status" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><p>{c("Some quotes are unavailable. Check the symbol or retry; saved stocks are retained.", "部分报价暂不可用，请检查代码或重试，自选股仍会保留。")}</p><Button variant="outline" size="sm" disabled={loading} onClick={() => setAttempt(value => value + 1)}>{c("Retry quotes", "重试报价")}</Button></div>}
            <div aria-busy={loading} className="mt-3">
              <ListColumnHeader>
                <div className={cn(ROW_GRID, "min-w-0 flex-1 px-2 py-3")}>
                  <span>{c("Stock", "股票")}</span>
                  <span className="truncate text-center"><span className="min-[400px]:hidden">{c("Trend", "走势")}</span><span className="hidden min-[400px]:inline">{c(`Trend · ${trend.en}`, `走势 · ${trend.zh}`)}</span></span>
                  <span className="text-right">{c("Price / Today", "价格 / 今日")}</span>
                </div>
                <span className="w-11 shrink-0 text-center">{c("Watch", "自选")}</span>
              </ListColumnHeader>
              {groups.map(([sector, symbols]) => {
                const label = sectorLabel(sector);
                const list = <ListRows aria-label={sector === "pending" ? c("Saved stocks", "已添加的股票") : c(label.en, label.zh)}>
                  {symbols.map(symbol => <ListRow key={symbol}>
                    <Link href={stockHref(symbol)} className={cn(ROW_GRID, listRowTargetClass, "gap-y-1.5")} onClick={event => {
                    // Phones preview the stock in a sheet; larger screens (and modified clicks) open the stock page.
                    if (event.metaKey || event.ctrlKey || event.shiftKey || !window.matchMedia("(max-width: 639.98px)").matches) return;
                    event.preventDefault();
                    setPreview(symbol);
                    setPreviewOpen(true);
                  }}>
                      <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <span aria-hidden="true" className="shrink-0"><CompanyLogo symbol={symbol} size="sm" /></span>
                        <span className="min-w-0"><span className="block text-base font-semibold">{symbol}</span>{companyName(symbol) && <span className="mt-0.5 block truncate text-xs text-muted-foreground max-sm:hidden">{companyName(symbol)}</span>}</span>
                      </span>
                      <span className="min-w-0"><StockTrend symbol={symbol} period={trend.period} interval={trend.interval} rangeLabel={c(trend.en, trend.zh)} rangeKey="1D" /></span>
                      <span className="min-w-0 text-right">{loading && !quotes[symbol] ? <PendingValue className="h-10" /> : <><span className="figure block text-base font-medium">{money(quotes[symbol]?.price)}</span><Change value={quotes[symbol]?.changePercent} className="mt-1 block text-xs font-semibold" /></>}</span>
                      {creatorStocks.get(symbol) && <StockDirectoryInsight stock={creatorStocks.get(symbol)!} />}
                    </Link>
                    <WatchlistButton ticker={symbol} onRemoved={() => tickerInput.current?.focus()} />
                  </ListRow>)}
                </ListRows>;
                return sector === "pending" ? <div key={sector}>{list}</div> : <details key={sector} open className="group mt-2 first:mt-0">
                  <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-2xl px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 transition-transform group-open:rotate-0" aria-hidden="true" />{c(label.en, label.zh)}
                  </summary>
                  {list}
                </details>;
              })}
            </div>
            {!filtered.length && <div className="py-12 text-center"><p className="text-sm text-muted-foreground">{c("No saved stocks match your search.", "没有符合搜索条件的自选股。")}</p><Button variant="outline" className="mt-4" onClick={clear}>{c("Clear search", "清除搜索")}</Button></div>}
            {filtered.length > rows && <ListLoadMore onClick={() => setRows(value => value + PAGE_SIZE)}>{c("Load more", "加载更多")}</ListLoadMore>}
          </ListCard>
          <WatchlistStockSheet open={previewOpen} symbol={preview} name={preview ? companyName(preview) : undefined} price={preview ? quotes[preview]?.price : undefined} changePercent={preview ? quotes[preview]?.changePercent : undefined} href={preview ? stockHref(preview) : returnHref} onClose={() => setPreviewOpen(false)} />
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
      <StockRowsSkeleton grid={ROW_GRID} trendClass="min-w-0" label={c("Loading Watchlist", "正在加载自选股")} />
    </div>
  </ListCard>;
}

/** Route fallback in the Watchlist frame: heading, add-stock form, then the saved-stocks card. */
export function WatchlistPageSkeleton({ noTransition = false }: { noTransition?: boolean }) {
  const c = useCopy();
  return <DashboardLayout title={c("Watchlist", "自选股")} noTransition={noTransition}>
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-[16px] pb-10 pt-6 md:px-8 md:pt-8">
        <div className="flex items-start justify-between gap-4"><div className="flex flex-col gap-3"><Skeleton className="h-8 w-28 rounded-lg sm:h-9" /><Skeleton className="h-4 w-60 rounded-md" /></div><Skeleton className="h-11 w-11 rounded-full" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-20 rounded-md" /><div className="flex gap-2"><Skeleton className="h-11 flex-1 rounded-xl" /><Skeleton className="h-11 w-20 rounded-full" /></div><Skeleton className="h-3 w-64 rounded-md" /></div>
        <WatchlistCardSkeleton />
      </div>
    </main>
  </DashboardLayout>;
}
