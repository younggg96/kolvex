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
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWatchlist } from "@/hooks/useWatchlist";
import { normalizeWatchlistTicker } from "@/lib/watchlist";
import { getCachedMarketQuotes, loadMarketQuotes } from "@/lib/marketQuotes";
import { CORE_STOCKS } from "@/lib/stockDiscovery";
import type { StockQuote } from "@/lib/stockApi";
import { Change, money, useCopy } from "./shared";
import WatchlistButton from "./WatchlistButton";
import WatchlistStatus from "./WatchlistStatus";

const names = new Map<string, string>(CORE_STOCKS.map(stock => [stock.symbol, stock.name]));
const PAGE_SIZE = 20;

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
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const previousAttempt = useRef(0);
  const key = watchlist.join(",");
  useEffect(() => { if (!composing.current) setDraft(query); setRows(PAGE_SIZE); }, [query, sort]);
  useEffect(() => { document.title = c("Watchlist | Kolvex", "自选股 | Kolvex"); }, [c]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const symbols = key ? key.split(",") : [];
    const force = previousAttempt.current !== attempt;
    previousAttempt.current = attempt;
    setQuotes(getCachedMarketQuotes(symbols));
    setLoading(symbols.length > 0);
    setUnavailable(false);
    loadMarketQuotes(symbols, controller.signal, () => {}, force).then(result => {
      if (controller.signal.aborted) return;
      setQuotes(result.quotes); setUnavailable(result.unavailable); setLoading(false);
    });
    return () => controller.abort();
  }, [key, ready, attempt]);

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

  return <DashboardLayout title={c("Watchlist", "自选股")}>
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-6 md:px-8 md:pt-8">
        <div className="flex items-start justify-between gap-4">
          <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c("Watchlist", "自选股")}</h1><p className="mt-2 text-sm text-muted-foreground">{c("Keep the stocks you follow in one place.", "把关注的股票放在一起，随时查看行情。")}</p></div>
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
        <WatchlistStatus />
        {!ready ? <div role="status" aria-label={c("Loading Watchlist", "正在加载自选股")} className="space-y-4">{[0, 1, 2].map(row => <Skeleton key={row} className="h-20 w-full" />)}</div> : (!userId || error) && !watchlist.length ? null : !watchlist.length ? <div className="rounded-xl border border-border py-16 text-center">
          <Star className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold">{c("Your Watchlist starts here", "从第一只自选股开始")}</h2><p className="mx-auto mt-2 max-w-sm px-4 text-sm leading-6 text-muted-foreground">{c("Add a symbol above, or use the star beside a stock in Markets.", "在上方输入代码，或点击行情列表中股票旁的星标。")}</p><Button asChild variant="outline" className="mt-6"><Link href="/dashboard">{c("Browse Markets", "浏览行情")}</Link></Button>
        </div> : <section aria-label={c("Saved stocks", "已添加的股票")} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <div><label htmlFor="watchlist-search" className="mb-2 block text-xs text-muted-foreground">{c("Search Watchlist", "搜索自选股")}</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="watchlist-search" ref={search} value={draft} placeholder={c("Ticker or company name", "股票代码或公司名称")} className="h-11 pl-10 pr-11" maxLength={100} onChange={event => { setDraft(event.target.value); if (!composing.current) update(event.target.value); }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={event => { composing.current = false; update(event.currentTarget.value); }} onKeyDown={event => { if (event.key === "Escape" && !composing.current) clear(); }} />{draft && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-11" aria-label={c("Clear Watchlist search", "清除自选股搜索")} onClick={clear}><X className="h-4 w-4" aria-hidden="true" /></Button>}</div></div>
            <div><label htmlFor="watchlist-sort" className="mb-2 block text-xs text-muted-foreground">{c("Sort", "排序")}</label><Select value={sort} onValueChange={value => update(query, value)}><SelectTrigger id="watchlist-sort" className="h-11"><SelectValue /></SelectTrigger><SelectContent align="end"><SelectItem value="added">{c("Recently added", "最近添加")}</SelectItem><SelectItem value="symbol">{c("Symbol A–Z", "代码 A–Z")}</SelectItem><SelectItem value="gainers">{c("Gainers first", "涨幅优先")}</SelectItem><SelectItem value="losers">{c("Losers first", "跌幅优先")}</SelectItem></SelectContent></Select></div>
          </div>
          <p role="status" className="text-xs tabular-nums text-muted-foreground">{c(`Showing ${Math.min(rows, filtered.length)} of ${filtered.length} stocks`, `已显示 ${Math.min(rows, filtered.length)} / ${filtered.length} 只`)}</p>
          {unavailable && <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><p>{c("Some quotes are unavailable. Check the symbol or retry; saved stocks are retained.", "部分报价暂不可用，请检查代码或重试，自选股仍会保留。")}</p><Button variant="outline" size="sm" disabled={loading} onClick={() => setAttempt(value => value + 1)}>{c("Retry quotes", "重试报价")}</Button></div>}
          <div aria-busy={loading}>
            <div aria-hidden="true" className="flex justify-between rounded-lg bg-muted/60 px-3 py-3 pr-16 text-xs text-muted-foreground"><span>{c("Stock", "股票")}</span><span>{c("Price / Today", "价格 / 今日")}</span></div>
            <ul className="divide-y divide-border">{filtered.slice(0, rows).map(symbol => <li key={symbol} className="flex items-center gap-1">
              <Link href={`/dashboard/market/${encodeURIComponent(symbol)}?${new URLSearchParams({ from: returnHref })}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-3 py-4 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="flex min-w-0 items-center gap-3"><CompanyLogo symbol={symbol} size="sm" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{symbol}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{quotes[symbol]?.name || names.get(symbol) || c("Stock details", "查看个股详情")}</span></span></span>
                <span className="shrink-0 text-right">{loading && !quotes[symbol] ? <Skeleton className="h-10 w-20" /> : <><span className="block text-sm font-medium tabular-nums">{money(quotes[symbol]?.price)}</span><Change value={quotes[symbol]?.changePercent} className="mt-1 block text-xs font-semibold" /></>}</span>
              </Link><WatchlistButton ticker={symbol} onRemoved={() => tickerInput.current?.focus()} />
            </li>)}</ul>
          </div>
          {!filtered.length && <div className="py-12 text-center"><p className="text-sm text-muted-foreground">{c("No saved stocks match your search.", "没有符合搜索条件的自选股。")}</p><Button variant="outline" className="mt-4" onClick={clear}>{c("Clear search", "清除搜索")}</Button></div>}
          {filtered.length > rows && <Button variant="outline" className="w-full" onClick={() => setRows(value => value + PAGE_SIZE)}>{c("Load more", "加载更多")}</Button>}
          <p className="text-xs leading-5 text-muted-foreground">{c("Prices use the existing market data source and may be delayed. Unavailable quotes show a dash.", "报价来自现有行情数据源，可能存在延迟；缺失报价显示为横线。")}</p>
        </section>}
      </div>
    </main>
  </DashboardLayout>;
}
