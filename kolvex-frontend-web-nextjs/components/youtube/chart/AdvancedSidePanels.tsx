"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  LayoutPanelLeft,
  List as ListIcon,
  Newspaper,
  RefreshCw,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import CompanyLogo from "@/components/ui/company-logo";
import WatchlistButton from "@/components/decision/WatchlistButton";
import { Change, money, useCopy } from "@/components/decision/shared";
import { useStockNews } from "@/components/decision/useStockNews";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { useNewsTranslations } from "@/components/news/useNewsTranslations";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { signedPercent, withSign } from "@/lib/format";
import { latestChartQuote, sessionLabel } from "@/lib/chart/quote";
import type { StockQuote } from "@/lib/stockApi";
import { groupBySector, sectorLabel, useStockSectors } from "@/hooks/useStockSectors";
import { marketStockHref } from "@/lib/stockLinks";
import {
  earningsRows,
  finite,
  fundamentalsKey,
  loadFundamentals,
  type EarningsData,
} from "@/lib/stockFundamentals";
import {
  DEFAULT_SIDE_PANELS,
  SIDE_PANEL_IDS,
  moveSidePanel,
  readSidePanelLayout,
  toggleSidePanel,
  toggleSidePanelCollapsed,
  visibleSidePanels,
  writeSidePanelLayout,
  type SidePanelId,
  type SidePanelLayout,
} from "@/lib/chart/sidePanels";
import { cn } from "@/lib/utils";

type Copy = (en: string, zh: string) => string;

const panelTitle = (id: SidePanelId, c: Copy) =>
  id === "watchlist"
    ? c("Watchlist", "自选")
    : id === "ai"
      ? c("AI analysis", "AI 分析")
      : id === "news"
        ? c("News", "新闻")
        : c("Earnings", "财报");

/**
 * The AI content is shared with the stock page's chart, so the side column scales its type and
 * controls down here to match the dense watchlist (13px body, 32px controls) without forking it.
 */
const COMPACT_PANEL = cn(
  "text-[0.8125rem]",
  "[&_.text-xl]:text-base [&_.text-lg]:text-[0.9375rem] [&_.text-base]:text-[0.8125rem]",
  "[&_.text-sm]:text-[0.8125rem] [&_.text-xs]:text-[0.6875rem] [&_.leading-6]:leading-5",
  "[&_button]:min-h-8 [&_button.h-9]:h-8 [&_button.h-10]:h-8 [&_button]:text-[0.8125rem] [&_button.px-0]:!w-8",
  "[&_button_svg]:h-3.5 [&_button_svg]:w-3.5",
  // Disclosures (分析依据 / 指标与趋势线) collapse to 32px rows with tight bodies.
  "[&_summary]:min-h-8 [&_details]:!py-0 [&_.leading-7]:leading-5 [&_.space-y-4]:space-y-2.5",
);

const PANEL_ICONS: Record<SidePanelId, LucideIcon> = {
  watchlist: ListIcon,
  ai: Sparkles,
  news: Newspaper,
  earnings: CalendarDays,
};

/**
 * The advanced chart's right column: a stack of flat panels next to the K-line plus an icon rail
 * on the far edge that shows or hides each one. The watchlist leads and picks the charted symbol;
 * AI, news and earnings follow the charted symbol. With every panel off only the rail remains.
 */
export default function AdvancedSidePanels({
  symbol,
  ai,
  onSelectSymbol,
}: {
  symbol: string;
  /** The chart's AI actions and results; null when this chart offers no AI. */
  ai: ReactNode | null;
  onSelectSymbol?: (symbol: string) => void;
}) {
  const c = useCopy();
  const [layout, setLayout] = useState<SidePanelLayout>(DEFAULT_SIDE_PANELS);
  useEffect(() => setLayout(readSidePanelLayout()), []);
  const update = (change: (current: SidePanelLayout) => SidePanelLayout) =>
    setLayout((current) => {
      const next = change(current);
      writeSidePanelLayout(next);
      return next;
    });
  const available = SIDE_PANEL_IDS.filter((id) => id !== "ai" || ai !== null);
  const open = visibleSidePanels(layout, available);
  // Hosts pass a fresh arrow on every chart frame; a stable wrapper lets the memoized
  // watchlist skip those renders while still calling the latest handler.
  const selectRef = useRef(onSelectSymbol);
  selectRef.current = onSelectSymbol;
  const hasSelect = Boolean(onSelectSymbol);
  const selectSymbol = useCallback((next: string) => selectRef.current?.(next), []);

  return (
    <div className="flex h-full min-h-0">
      {open.length > 0 && (
        <div className="flex min-h-0 w-[clamp(19rem,24vw,26rem)] flex-col overflow-y-auto overscroll-contain border-l border-border">
          {open.map((id) => (
            <SidePanel
              key={id}
              title={panelTitle(id, c)}
              collapsed={layout.collapsed.includes(id)}
              grow={id !== "earnings"}
              flush={id === "watchlist"}
              action={id === "watchlist" ? <WatchlistButton ticker={symbol} /> : null}
              onToggle={() => update((current) => toggleSidePanelCollapsed(current, id))}
              onClose={() => update((current) => toggleSidePanel(current, id))}
            >
              {id === "watchlist" ? (
                <WatchlistPanel
                  symbol={symbol}
                  onSelectSymbol={hasSelect ? selectSymbol : undefined}
                />
              ) : id === "ai" ? (
                <div className={COMPACT_PANEL}>{ai}</div>
              ) : id === "news" ? (
                <NewsPanel key={symbol} symbol={symbol} />
              ) : (
                <EarningsPanel symbol={symbol} />
              )}
            </SidePanel>
          ))}
        </div>
      )}
      <nav
        aria-label={c("Panels", "面板")}
        className="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-border py-2"
      >
        {available.map((id) => {
          const Icon = PANEL_ICONS[id];
          const shown = open.includes(id);
          const title = panelTitle(id, c);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={shown}
              aria-label={c(
                shown ? `Hide ${title}` : `Show ${title}`,
                shown ? `隐藏${title}` : `显示${title}`,
              )}
              title={title}
              onClick={() => update((current) => toggleSidePanel(current, id))}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                shown
                  ? "bg-primary/10 text-primary before:absolute before:-right-1 before:top-1.5 before:h-6 before:w-0.5 before:rounded-full before:bg-primary"
                  : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
              )}
            >
              <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            </button>
          );
        })}
        <span className="my-1 h-px w-6 bg-border" aria-hidden="true" />
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={c("Arrange panels", "排列面板")}
              title={c("Arrange panels", "排列面板")}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <LayoutPanelLeft className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="left" align="start" className="w-60 p-1.5">
            <ul aria-label={c("Panels", "面板")}>
              {available.map((id) => {
                const shown = open.includes(id);
                const index = layout.open.indexOf(id);
                const title = panelTitle(id, c);
                return (
                  <li key={id} className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={shown}
                      onClick={() => update((current) => toggleSidePanel(current, id))}
                      className="flex min-h-9 flex-1 items-center gap-2.5 rounded-md px-2 text-left text-sm transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border border-border text-[0.625rem]",
                          shown && "border-primary bg-primary text-primary-foreground",
                        )}
                        aria-hidden="true"
                      >
                        {shown ? "✓" : ""}
                      </span>
                      {title}
                    </button>
                    {shown && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index <= 0}
                          aria-label={c(`Move ${title} up`, `上移${title}`)}
                          onClick={() => update((current) => moveSidePanel(current, id, -1))}
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index < 0 || index >= layout.open.length - 1}
                          aria-label={c(`Move ${title} down`, `下移${title}`)}
                          onClick={() => update((current) => moveSidePanel(current, id, 1))}
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      </nav>
    </div>
  );
}

function SidePanel({
  title,
  collapsed,
  grow,
  flush = false,
  action,
  onToggle,
  onClose,
  children,
}: {
  title: string;
  collapsed: boolean;
  grow: boolean;
  /** The body manages its own padding and scrolling (dense lists). */
  flush?: boolean;
  action: ReactNode;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useCopy();
  const bodyId = useId();
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col border-b border-border last:border-b-0",
        !collapsed && "min-h-[14rem]",
        !collapsed && grow && "flex-1 basis-0",
        collapsed && "shrink-0",
      )}
    >
      <div className="flex h-9 shrink-0 items-center gap-0.5 px-1.5">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md px-1 text-left text-[0.8125rem] font-semibold transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              collapsed && "-rotate-90",
            )}
            aria-hidden="true"
          />
          <span className="truncate">{title}</span>
        </button>
        <div className="[&_button]:h-7 [&_button]:min-h-7 [&_button]:w-7 [&_button]:min-w-7 [&_svg]:h-3.5 [&_svg]:w-3.5">
          {action}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          aria-label={c(`Close ${title}`, `关闭${title}`)}
          title={c(`Close ${title}`, `关闭${title}`)}
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
      <div
        id={bodyId}
        hidden={collapsed}
        className={cn(
          "min-h-0 flex-1",
          flush
            ? cn("overflow-hidden", !collapsed && "flex flex-col")
            : "overflow-y-auto overscroll-contain px-3 pb-2",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-5 w-full rounded-md" />
      ))}
    </div>
  );
}

type SortKey = "symbol" | "price" | "change" | "changePercent";
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

/** Clicking a column cycles: descending → ascending → watchlist order (symbol starts ascending). */
const nextSort = (sort: Sort, key: SortKey): Sort => {
  const first = key === "symbol" ? "asc" : "desc";
  if (sort?.key !== key) return { key, dir: first };
  if (sort.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
  return null;
};

const sortValue = (quote: StockQuote | undefined, key: Exclude<SortKey, "symbol">) => {
  const live = latestChartQuote(quote);
  const value =
    key === "price" ? live?.price : key === "change" ? live?.change : live?.changePercent;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const signedPrice = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? withSign(value, (magnitude) => magnitude.toFixed(2), { digits: 2 })
    : "—";

const tone = (value: number | null | undefined) =>
  typeof value !== "number" || !Number.isFinite(value) || value === 0
    ? "text-muted-foreground"
    : value > 0
      ? "text-positive"
      : "text-negative";

const compact = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(
        value,
      )
    : "—";

/** Narrow columns (below `xl`) drop the absolute change and keep Symbol / Last / Chg%. */
const WATCHLIST_GRID =
  "grid grid-cols-[minmax(0,1fr)_4.25rem_4rem] items-center gap-x-2 xl:grid-cols-[minmax(0,1fr)_4.75rem_4rem_4.25rem]";

function WatchlistPanelBody({
  symbol,
  onSelectSymbol,
}: {
  symbol: string;
  onSelectSymbol?: (symbol: string) => void;
}) {
  const c = useCopy();
  const { watchlist, ready, userId, error, refresh } = useWatchlist();
  // The charted symbol is quoted too, so its details show even when it isn't saved.
  const quoted = useMemo(
    () => (watchlist.includes(symbol) ? watchlist : [...watchlist, symbol]),
    [watchlist, symbol],
  );
  const { quotes, loading, unavailable } = useMarketQuotes(quoted, ready && !!userId);
  const { sectors } = useStockSectors(watchlist);
  const [sort, setSort] = useState<Sort>(null);
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());

  const groups = useMemo(() => {
    const ordered = [...watchlist];
    if (sort) {
      const sign = sort.dir === "asc" ? 1 : -1;
      ordered.sort((a, b) => {
        if (sort.key === "symbol") return a.localeCompare(b) * sign;
        const left = sortValue(quotes[a], sort.key);
        const right = sortValue(quotes[b], sort.key);
        // Missing quotes always sink to the bottom instead of pretending to be zero.
        if (left === null || right === null) return left === null ? (right === null ? 0 : 1) : -1;
        return (left - right) * sign;
      });
    }
    return groupBySector(ordered, sectors);
  }, [watchlist, sectors, quotes, sort]);

  if (!ready)
    return (
      <div role="status" className="px-3 py-2">
        <span className="sr-only">{c("Loading Watchlist", "正在加载自选股")}</span>
        <RowsSkeleton />
      </div>
    );
  if (!userId || error === "auth")
    return (
      <div className="flex flex-col items-center gap-3 px-3 py-6 text-center text-sm">
        <p className="text-muted-foreground">
          {c("Sign in to see your Watchlist.", "登录后查看自选股。")}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/auth">{c("Sign in", "登录")}</Link>
        </Button>
      </div>
    );
  if (error && !watchlist.length)
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-3 py-6 text-center text-sm">
        <p className="text-muted-foreground">
          {c("Watchlist could not be loaded.", "自选股暂时无法加载。")}
        </p>
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          {c("Retry", "重试")}
        </Button>
      </div>
    );
  if (!watchlist.length)
    return (
      <div className="flex flex-col items-center gap-3 px-3 py-6 text-center text-sm">
        <p className="text-muted-foreground">
          {c("No stocks in your Watchlist yet.", "还没有自选股。")}
        </p>
        <WatchlistButton ticker={symbol} showLabel />
      </div>
    );

  const columns: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "symbol", label: c("Symbol", "代码"), align: "left" },
    { key: "price", label: c("Last", "最新价"), align: "right" },
    { key: "change", label: c("Chg", "涨跌"), align: "right" },
    { key: "changePercent", label: c("Chg%", "涨跌幅"), align: "right" },
  ];
  const toggleGroup = (sector: string) =>
    setFolded((previous) => {
      const next = new Set(previous);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="row"
        className={cn(
          WATCHLIST_GRID,
          "shrink-0 border-b border-border px-3 py-1 text-[0.6875rem] text-muted-foreground",
        )}
      >
        {columns.map((column) => {
          const active = sort?.key === column.key;
          const Arrow = sort?.dir === "asc" ? ArrowUp : ArrowDown;
          return (
            <button
              key={column.key}
              type="button"
              role="columnheader"
              aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
              onClick={() => setSort((previous) => nextSort(previous, column.key))}
              title={c(`Sort by ${column.label}`, `按${column.label}排序`)}
              className={cn(
                "flex min-h-7 min-w-0 items-center gap-0.5 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                column.align === "right" && "justify-end",
                column.key === "change" && "hidden xl:flex",
                active && "text-foreground",
              )}
            >
              <span className="truncate">{column.label}</span>
              {active && <Arrow className="h-3 w-3 shrink-0" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
        <ul aria-label={c("Watchlist", "自选股")}>
          {groups.map(([sector, symbols]) => {
            const label = sectorLabel(sector);
            const isFolded = folded.has(sector);
            return (
              <li key={sector}>
                {sector !== "pending" && (
                  <button
                    type="button"
                    aria-expanded={!isFolded}
                    onClick={() => toggleGroup(sector)}
                    className="flex min-h-8 w-full items-center gap-1 px-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform",
                        isFolded && "-rotate-90",
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{c(label.en, label.zh)}</span>
                    <span className="ml-auto font-normal tabular-nums">{symbols.length}</span>
                  </button>
                )}
                {!isFolded && (
                  <ul>
                    {symbols.map((item) => (
                      <WatchlistRow
                        key={item}
                        symbol={item}
                        quote={quotes[item]}
                        loading={loading && !quotes[item]}
                        active={item === symbol}
                        onSelect={onSelectSymbol}
                      />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {unavailable && (
          <p role="status" className="px-3 pt-2 text-xs text-muted-foreground">
            {c("Some quotes are unavailable.", "部分报价暂不可用。")}
          </p>
        )}
      </div>
      <SymbolDetails symbol={symbol} quote={quotes[symbol]} loading={loading && !quotes[symbol]} />
    </div>
  );
}

function WatchlistRow({
  symbol,
  quote,
  loading,
  active,
  onSelect,
}: {
  symbol: string;
  quote: StockQuote | undefined;
  loading: boolean;
  active: boolean;
  onSelect?: (symbol: string) => void;
}) {
  const c = useCopy();
  const { locale } = useTranslation();
  const live = latestChartQuote(quote);
  const extended = live && live.session !== "regular" ? live.session : null;
  const label = extended ? sessionLabel(extended, locale) : null;
  const className = cn(
    WATCHLIST_GRID,
    "relative min-h-8 w-full px-3 text-left text-[0.8125rem] transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
    active &&
      "bg-primary/10 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary hover:bg-primary/15",
  );
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-x-2">
        <span className="flex shrink-0 items-center gap-2">
          <span aria-hidden="true">
            <CompanyLogo symbol={symbol} size="xs" shape="circle" />
          </span>
          <span className="font-semibold">{symbol}</span>
        </span>
        {label && (
          <span
            className="min-w-0 truncate rounded-sm bg-muted px-1 text-[0.5625rem] font-medium leading-4 text-muted-foreground"
            title={c(
              `Regular close ${money(quote?.price)} (${signedPercent(quote?.changePercent)})`,
              `收盘价 ${money(quote?.price)}（${signedPercent(quote?.changePercent)}）`,
            )}
          >
            {label}
          </span>
        )}
      </span>
      {loading ? (
        <>
          <Skeleton className="ml-auto h-3.5 w-12 rounded" />
          <Skeleton className="ml-auto hidden h-3.5 w-10 rounded xl:block" />
          <Skeleton className="ml-auto h-3.5 w-12 rounded" />
        </>
      ) : (
        <>
          <span className="truncate text-right tabular-nums">
            {live ? live.price.toFixed(2) : "—"}
          </span>
          <span
            className={cn("hidden truncate text-right tabular-nums xl:block", tone(live?.change))}
          >
            {signedPrice(live?.change)}
          </span>
          <span className={cn("truncate text-right tabular-nums", tone(live?.changePercent))}>
            {live?.changePercent == null ? "—" : signedPercent(live.changePercent)}
          </span>
        </>
      )}
    </>
  );
  return (
    <li aria-current={active ? "true" : undefined}>
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(symbol)}
          aria-label={c(`Chart ${symbol}`, `在图表中查看 ${symbol}`)}
          className={className}
        >
          {content}
        </button>
      ) : (
        <Link href={marketStockHref(symbol)} className={className}>
          {content}
        </Link>
      )}
    </li>
  );
}

/** TradingView-style details for the charted symbol, pinned under the list. */
function SymbolDetails({
  symbol,
  quote,
  loading,
}: {
  symbol: string;
  quote: StockQuote | undefined;
  loading: boolean;
}) {
  const c = useCopy();
  const { locale } = useTranslation();
  const live = latestChartQuote(quote);
  const stats: [string, string][] = [
    [c("Open", "开盘"), quote?.open != null ? money(quote.open) : "—"],
    [c("Prev close", "昨收"), money(quote?.previousClose)],
    [c("High", "最高"), money(quote?.high)],
    [c("Low", "最低"), money(quote?.low)],
    [c("Volume", "成交量"), compact(quote?.volume)],
    [c("Mkt cap", "市值"), quote?.marketCap ? `$${compact(quote.marketCap)}` : "—"],
  ];
  return (
    <section
      aria-label={c(`${symbol} details`, `${symbol} 详情`)}
      className="shrink-0 border-t border-border px-3 pb-3 pt-2.5"
    >
      <div className="flex min-w-0 items-center gap-2">
        <CompanyLogo symbol={symbol} size="xs" shape="circle" />
        <span className="text-sm font-semibold">{symbol}</span>
        {quote?.name && (
          <span className="truncate text-xs text-muted-foreground">{quote.name}</span>
        )}
        <Link
          href={marketStockHref(symbol)}
          className="ml-auto shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={c(`Open ${symbol} quote page`, `打开 ${symbol} 行情页`)}
          title={c("Quote page", "行情页")}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-40 rounded" />
      ) : (
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">
            {live ? live.price.toFixed(2) : "—"}
          </span>
          <span className="text-[0.6875rem] text-muted-foreground">USD</span>
          <span className={cn("text-sm font-medium tabular-nums", tone(live?.change))}>
            {signedPrice(live?.change)}{" "}
            {live?.changePercent == null ? "" : `(${signedPercent(live.changePercent)})`}
          </span>
          {live && (
            <span className="text-[0.6875rem] text-muted-foreground">
              {sessionLabel(live.session, locale, live.delayMinutes)}
            </span>
          )}
        </div>
      )}
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {stats.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{loading ? "…" : value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function NewsPanelBody({ symbol }: { symbol: string }) {
  const c = useCopy();
  const { locale } = useTranslation();
  const news = useStockNews(symbol);
  const visible = news.articles.slice(0, 20);
  const translation = useNewsTranslations(
    visible.map((item) => ({ ...item, id: item.uuid || item.link, symbols: [symbol] })),
    locale,
  );
  const intlLocale = locale === "zh" ? "zh-CN" : "en-US";

  if (news.loading && !news.articles.length)
    return (
      <div role="status">
        <span className="sr-only">{c("Loading stock news", "正在加载个股新闻")}</span>
        <RowsSkeleton />
      </div>
    );
  return (
    <>
      {news.error && (
        <div role="alert" className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
          <span className="flex-1">
            {news.articles.length
              ? c("Update failed. Showing the last news.", "更新失败，已保留上次获取的新闻。")
              : c("News could not be loaded.", "新闻暂时无法加载。")}
          </span>
          <Button size="sm" variant="ghost" onClick={news.refresh} disabled={news.loading}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {c("Retry", "重试")}
          </Button>
        </div>
      )}
      {!news.error && !news.articles.length && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {c(`No recent news for ${symbol}.`, `${symbol} 暂无最新新闻。`)}
        </p>
      )}
      <ul className="divide-y divide-border">
        {visible.map((item) => {
          const published = item.publish_time ? new Date(item.publish_time * 1000) : null;
          const validDate = published && Number.isFinite(published.getTime()) ? published : null;
          const title = translation.translations[item.title] || item.title;
          return (
            <li key={item.link} className="py-2">
              <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{item.publisher || c("News source", "新闻来源")}</span>
                {validDate && (
                  <>
                    <span aria-hidden>·</span>
                    <time dateTime={validDate.toISOString()} className="shrink-0">
                      {validDate.toLocaleString(intlLocale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </>
                )}
              </div>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                lang={translation.translations[item.title] ? "zh-CN" : "en"}
                className="line-clamp-3 text-sm font-medium leading-5 underline-offset-4 hover:underline focus-visible:outline-none"
              >
                {title}
                <ExternalLink aria-hidden className="ml-1 inline h-3 w-3 text-muted-foreground" />
                <span className="sr-only">
                  {c(" (original source, new tab)", "（原文，新标签页）")}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function EarningsPanelBody({ symbol }: { symbol: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const key = fundamentalsKey(symbol, "earnings");
  const resource = useCachedResource(key, (signal) => loadFundamentals<EarningsData>(key, signal), {
    ttl: 300_000,
  });
  if (resource.loading && !resource.data)
    return (
      <div role="status">
        <span className="sr-only">{c("Loading earnings", "正在加载财报")}</span>
        <RowsSkeleton rows={4} />
      </div>
    );
  if (resource.error && !resource.data)
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center text-sm">
        <p className="text-muted-foreground">
          {c("Earnings could not be loaded.", "财报数据暂时无法加载。")}
        </p>
        <Button size="sm" variant="outline" onClick={resource.refresh}>
          {c("Retry", "重试")}
        </Button>
      </div>
    );
  const rows = resource.data ? earningsRows(resource.data) : [];
  // The source's date is kept for upcoming rows, never guessed.
  const upcoming = rows.find((row) => Date.parse(row.period) > Date.now() && !finite(row.actual));
  const reported = rows
    .filter((row) => finite(row.actual))
    .reverse()
    .slice(0, 8);
  const eps = (value: number | null) => (finite(value) ? value.toFixed(2) : "—");

  if (!upcoming && !reported.length)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {c("No earnings data from the source.", "数据源暂无财报数据。")}
      </p>
    );
  return (
    <div className="space-y-2">
      {upcoming && (
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{c("Next report", "下次财报")}</span>
          <span className="font-semibold tabular-nums">
            {f.date(upcoming.period)}
            {finite(upcoming.estimate) && (
              <span className="ml-2 font-normal text-muted-foreground">
                {c("Est. EPS", "预期 EPS")} {eps(upcoming.estimate)}
              </span>
            )}
          </span>
        </p>
      )}
      {reported.length > 0 && (
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">{c("Reported EPS", "已公布 EPS")}</caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="pb-1 text-left font-normal">
                {c("Date", "日期")}
              </th>
              <th scope="col" className="pb-1 text-right font-normal">
                {c("Est.", "预期")}
              </th>
              <th scope="col" className="pb-1 text-right font-normal">
                {c("Actual", "实际")}
              </th>
              <th scope="col" className="pb-1 text-right font-normal">
                {c("Surprise", "超预期")}
              </th>
            </tr>
          </thead>
          <tbody>
            {reported.map((row) => (
              <tr key={row.period} className="border-t border-border">
                <th scope="row" className="py-1.5 text-left font-normal">
                  {f.date(row.period)}
                </th>
                <td className="py-1.5 text-right text-muted-foreground">{eps(row.estimate)}</td>
                <td className="py-1.5 text-right font-semibold">{eps(row.actual)}</td>
                <td
                  className={cn(
                    "py-1.5 text-right",
                    finite(row.surprise) &&
                      (row.surprise > 0
                        ? "text-positive"
                        : row.surprise < 0
                          ? "text-negative"
                          : "text-muted-foreground"),
                  )}
                >
                  {finite(row.surprise)
                    ? withSign(row.surprise, (magnitude) => `${magnitude.toFixed(2)}%`, {
                        digits: 2,
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-muted-foreground">
        {c("EPS source: Yahoo Finance", "EPS 来源：Yahoo Finance")}
      </p>
    </div>
  );
}

// The chart re-renders on every zoom / pan frame; these panels only depend on the symbol.
const WatchlistPanel = memo(WatchlistPanelBody);
const NewsPanel = memo(NewsPanelBody);
const EarningsPanel = memo(EarningsPanelBody);
