"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, RefreshCw, Star } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { getCachedMarketQuotes, loadMarketQuotes } from "@/lib/marketQuotes";
import { CORE_STOCKS, STOCK_SECTORS } from "@/lib/stockDiscovery";
import type { StockQuote } from "@/lib/stockApi";
import CompanyLogo from "@/components/ui/company-logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Change, money, useCopy } from "./shared";

const PREVIEW_SIZE = 6;
const sectors = new Map<string, string>(CORE_STOCKS.map(stock => [stock.symbol, stock.sector]));

/** A bounded preview of the same browser-local list used by stock stars. */
export default function MarketWatchlistCard() {
  const c = useCopy();
  const { watchlist, ready, storageUnavailable } = useWatchlist();
  const symbols = watchlist.slice(-PREVIEW_SIZE).reverse();
  const key = symbols.join(",");
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const previousAttempt = useRef(0);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const requested = key ? key.split(",") : [];
    const force = previousAttempt.current !== attempt;
    previousAttempt.current = attempt;
    setQuotes(getCachedMarketQuotes(requested));
    setLoading(requested.length > 0);
    setUnavailable(false);
    loadMarketQuotes(requested, controller.signal, batch => {
      if (!controller.signal.aborted) setQuotes(previous => ({ ...previous, ...batch }));
    }, force).then(result => {
      if (controller.signal.aborted) return;
      setQuotes(result.quotes);
      setUnavailable(result.unavailable);
      setLoading(false);
    });
    return () => controller.abort();
  }, [key, ready, attempt]);

  const groups = new Map<string, string[]>();
  for (const symbol of symbols) {
    const sector = symbol.endsWith("-USD") ? "crypto" : sectors.get(symbol) ?? "other";
    groups.set(sector, [...(groups.get(sector) ?? []), symbol]);
  }
  function groupLabel(key: string) {
    if (key === "crypto") return c("Crypto", "加密资产");
    const sector = STOCK_SECTORS.find(sector => sector.key === key);
    return sector ? c(sector.en, sector.zh) : c("Other stocks", "其他股票");
  }

  return <section aria-labelledby="market-watchlist-title" className="min-w-0">
    <header className="mb-3 flex min-h-11 items-center gap-2">
      <h2 id="market-watchlist-title" className="text-lg font-semibold">{c("Watchlist", "自选股")}</h2>
      {ready && <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground" aria-label={c(`Showing ${symbols.length} of ${watchlist.length} saved stocks`, `展示 ${symbols.length} 只，共 ${watchlist.length} 只自选股`)}>{symbols.length}/{watchlist.length}</span>}
      <div className="ml-auto flex items-center">
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11" disabled={!ready || loading || !symbols.length} onClick={() => setAttempt(value => value + 1)} aria-label={c("Refresh Watchlist quotes", "刷新自选股行情")} title={c("Refresh quotes", "刷新行情")}><RefreshCw className="h-3.5 w-3.5" aria-hidden /></Button>
        <Button asChild variant="ghost" size="icon" className="h-11 w-11"><Link href="/dashboard/watchlist" aria-label={c("Open full Watchlist", "查看全部自选股")} title={c("Open Watchlist", "查看自选股")}><ArrowUpRight className="h-4 w-4" aria-hidden /></Link></Button>
      </div>
    </header>
    <div className="rounded-xl border border-border bg-card p-3" aria-busy={!ready || loading}>
      {!ready ? <div role="status" aria-label={c("Loading Watchlist", "正在加载自选股")} className="space-y-3 py-2">{[0, 1, 2].map(row => <Skeleton key={row} className="h-11 w-full" />)}</div>
        : !symbols.length ? <div className="px-3 py-6 text-center">
          <Star className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">{c("Follow your first stock", "添加第一只自选股")}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{c("Use the star beside a stock, or add a symbol in your Watchlist.", "点击股票旁的星标，或前往自选股添加代码。")}</p>
          <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/dashboard/watchlist">{c("Manage Watchlist", "管理自选股")}</Link></Button>
        </div> : <div className="space-y-2">
          {[...groups].map(([sector, stocks]) => <details key={sector} open className="group">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 group-open:rotate-0" aria-hidden />{groupLabel(sector)}
            </summary>
            <ul>{stocks.map(symbol => <li key={symbol}>
              <Link href={`/dashboard/market/${encodeURIComponent(symbol)}`} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg px-1 text-sm transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" title={quotes[symbol]?.name ?? symbol}>
                <span className="flex min-w-0 items-center gap-2"><span className="shrink-0" aria-hidden><CompanyLogo symbol={symbol} size="xs" /></span><span className="truncate font-medium">{symbol}</span></span>
                {loading && !quotes[symbol] ? <Skeleton className="col-span-2 h-4 w-28" /> : <><span className="figure text-right">{money(quotes[symbol]?.price)}</span><Change value={quotes[symbol]?.changePercent} className="min-w-14 text-right text-xs" /></>}
              </Link>
            </li>)}</ul>
          </details>)}
        </div>}
      {unavailable && <p role="status" className="mt-3 text-xs leading-5 text-muted-foreground">{c("Some quotes are unavailable. Use refresh to retry.", "部分报价暂不可用，可点击刷新重试。")}</p>}
      {storageUnavailable && <p role="status" className="mt-3 text-xs leading-5 text-muted-foreground">{c("Saved for this session only. Browser storage is unavailable.", "浏览器存储不可用，仅在本次会话保留。")}</p>}
      {ready && symbols.length > 0 && <Link href="/dashboard/watchlist" className="mt-3 flex min-h-11 items-center justify-between border-t border-border px-1 pt-2 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{c("View all saved stocks", "查看全部自选股")}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link>}
    </div>
  </section>;
}
