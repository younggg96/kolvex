"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, RefreshCw, Star } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { CORE_STOCKS, STOCK_SECTORS } from "@/lib/stockDiscovery";
import { marketStockHref } from "@/lib/stockLinks";
import CompanyLogo from "@/components/ui/company-logo";
import { Button } from "@/components/ui/button";
import { ListRow, ListRows, phonePlainCardClass } from "@/components/ui/list-card";
import { cn } from "@/lib/utils";
import { PendingValue } from "@/components/ui/content-loading";
import { Change, money, useCopy } from "./shared";
import WatchlistStatus from "./WatchlistStatus";
import { Skeleton } from "../ui/skeleton";

const PREVIEW_SIZE = 6;
const sectors = new Map<string, string>(CORE_STOCKS.map(stock => [stock.symbol, stock.sector]));

/** A bounded preview of the same account-synced list used by stock stars. */
export default function MarketWatchlistCard() {
  const c = useCopy();
  const { watchlist, ready, userId, error } = useWatchlist();
  const symbols = watchlist.slice(-PREVIEW_SIZE).reverse();
  const { quotes, loading, unavailable, refresh } = useMarketQuotes(symbols, ready);

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
    <header className="mb-3 flex min-h-14 items-center gap-2">
      <h2 id="market-watchlist-title" className="text-lg font-semibold">{c("Watchlist", "自选股")}</h2>
      {ready && <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground" aria-label={c(`Showing ${symbols.length} of ${watchlist.length} saved stocks`, `展示 ${symbols.length} 只，共 ${watchlist.length} 只自选股`)}>{symbols.length}/{watchlist.length}</span>}
      <div className="ml-auto flex items-center">
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11" disabled={!ready || loading || !symbols.length} onClick={refresh} aria-label={c("Refresh Watchlist quotes", "刷新自选股行情")} title={c("Refresh quotes", "刷新行情")}><RefreshCw className="h-3.5 w-3.5" aria-hidden /></Button>
        <Button asChild variant="ghost" size="icon" className="h-11 w-11"><Link href="/dashboard/watchlist" aria-label={c("Open full Watchlist", "查看全部自选股")} title={c("Open Watchlist", "查看自选股")}><ArrowUpRight className="h-4 w-4" aria-hidden /></Link></Button>
      </div>
    </header>
    <div className={cn("rounded-xl border border-foreground/10 glass-card bg-card-glass p-3", phonePlainCardClass)} aria-busy={!ready || loading}>
      {!ready ? <div role="status" aria-label={c("Loading Watchlist", "正在加载自选股")} className="space-y-3 py-2">{[0, 1, 2].map(row => <Skeleton key={row} className="h-11 w-full" />)}</div>
        : (!userId || error) && !symbols.length ? null : !symbols.length ? <div className="px-3 py-6 text-center">
          <Star className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">{c("Follow your first stock", "添加第一只自选股")}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{c("Use the star beside a stock, or add a symbol in your Watchlist.", "点击股票旁的星标，或前往自选股添加代码。")}</p>
          <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/dashboard/watchlist">{c("Manage Watchlist", "管理自选股")}</Link></Button>
        </div> : <div className="space-y-2">
          {[...groups].map(([sector, stocks]) => <details key={sector} open className="group">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-2xl px-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none max-md:px-0 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 group-open:rotate-0" aria-hidden />{groupLabel(sector)}
            </summary>
            <ListRows>{stocks.map(symbol => <ListRow key={symbol} className="pr-0">
              <Link href={marketStockHref(symbol)} className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-full px-1 text-sm max-md:px-0 transition-colors duration-150 hover:text-foreground focus-visible:outline-none" title={c(`${quotes[symbol]?.name ?? symbol} quotes`, `${quotes[symbol]?.name ?? symbol} 行情`)}>
                <span className="flex min-w-0 items-center gap-2"><span className="shrink-0" aria-hidden><CompanyLogo symbol={symbol} size="sm" className="md:max-h-5 md:max-w-5 md:!p-0.5" /></span><span className="truncate font-medium">{symbol}</span></span>
                {loading && !quotes[symbol] ? <PendingValue className="col-span-2 h-4" /> : <><span className="figure text-right">{money(quotes[symbol]?.price)}</span><Change value={quotes[symbol]?.changePercent} className="min-w-14 text-right text-xs" /></>}
              </Link>
            </ListRow>)}</ListRows>
          </details>)}
        </div>}
      {unavailable && <p role="status" className="mt-3 text-xs leading-5 text-muted-foreground">{c("Some quotes are unavailable. Use refresh to retry.", "部分报价暂不可用，可点击刷新重试。")}</p>}
      {ready && <div className="mt-3"><WatchlistStatus /></div>}
      {ready && symbols.length > 0 && <Link href="/dashboard/watchlist" className="mt-3 flex min-h-11 items-center justify-between border-t border-border px-1 pt-2 text-xs max-md:px-0 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{c("View all saved stocks", "查看全部自选股")}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link>}
    </div>
  </section>;
}
