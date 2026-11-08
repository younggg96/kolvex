"use client";
import { RailRowsSkeleton } from "@/components/decision/MarketSkeletons";
import { peekClientCache } from "@/lib/clientCache";
import { loadMarketSeries, marketSeriesKey } from "@/lib/marketSeries";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, LayoutGrid, LineChart, List } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanyLogo from "@/components/ui/company-logo";
import { ListCard, ListRow, ListRows } from "@/components/ui/list-card";
import OpinionStrength from "@/components/youtube/OpinionStrength";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type StockQuote } from "@/lib/stockApi";
import { cn } from "@/lib/utils";
import { MARKET_RANGES, marketRangeBaseline } from "@/lib/marketObservations";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { BENCHMARKS, MARKET_GROUPS, isMarketIndex, indexValue, type MarketInstrument } from "@/lib/marketBenchmarks";
import { marketStockHref } from "@/lib/stockLinks";
import {
  HeldMark,
  money,
  useCopy,
  useCreatorCatalogue,
  useHeldTickers,
} from "./shared";
import ScrubChart, { type ScrubPoint } from "./ScrubChart";
import { useDecisionCommand } from "./CommandLayer";
import MacroIndicators from "./MacroIndicators";
import MarketEventCalendar from "./MarketEventCalendar";
import StockObservationList from "./StockObservationList";
import MarketComparison from "./MarketComparison";
import MarketCompareDialog from "./MarketCompareChart";
import MarketWatchlistCard from "./MarketWatchlistCard";

const OVERVIEW_GROUPS = MARKET_GROUPS.filter(group => group.key === "indices");
const TREND_GROUPS = MARKET_GROUPS.filter(group => group.key !== "indices");
const TREND_QUOTE_SYMBOLS = TREND_GROUPS.flatMap(group => group.instruments.filter(item => item.source !== "fred").map(item => item.symbol));
const RANGES = MARKET_RANGES;

type MarketView = "card" | "list";
const MARKET_VIEW_KEY = "kolvex:market-view";

type RangeKey = (typeof RANGES)[number]["key"];

function MarketInstrumentCard({ benchmark, quote, quoteLoading, range, attempt, onRetry }: {
  benchmark: MarketInstrument;
  quote?: StockQuote;
  quoteLoading: boolean;
  range: RangeKey;
  attempt: number;
  onRetry: () => void;
}) {
  const c = useCopy();
  const isIndex = isMarketIndex(benchmark.symbol);
  const unit = benchmark.unit ?? (isIndex ? "points" : "usd");
  const host = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    if (!("IntersectionObserver" in window)) { setNear(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const seriesKey = marketSeriesKey(benchmark.symbol, range);
  const [series, setSeries] = useState<ScrubPoint[]>(() => peekClientCache<ScrubPoint[]>(seriesKey) ?? []);
  const [seriesState, setSeriesState] = useState<"loading" | "ready" | "error">((peekClientCache<ScrubPoint[]>(seriesKey)?.length ?? 0) > 1 ? "ready" : "loading");
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);
  const [seriesRevision, setSeriesRevision] = useState(0);
  const refreshSeries = useCallback(() => setSeriesRevision(value => value + 1), []);
  useVisiblePolling(refreshSeries, 60_000, near && benchmark.source !== "fred" && !benchmark.daily);

  const seriesAttempt = useRef(attempt);
  const previousSeriesKey = useRef(seriesKey);
  useEffect(() => {
    const controller = new AbortController();
    const saved = peekClientCache<ScrubPoint[]>(seriesKey);
    const changed = previousSeriesKey.current !== seriesKey;
    previousSeriesKey.current = seriesKey;
    if (changed || saved?.length) {
      setSeriesState(saved?.length ? "ready" : "loading");
      setSeries(saved ?? []);
    }
    if (changed) setScrub(null);
    if (!near) return () => controller.abort();
    const forceRefresh = seriesAttempt.current !== attempt || seriesRevision > 0;
    seriesAttempt.current = attempt;
    loadMarketSeries(benchmark, range, { force: forceRefresh, signal: controller.signal }).then((points) => {
        if (controller.signal.aborted) return;
        setSeries(points);
        setSeriesState(points.length > 1 ? "ready" : "error");
      })
      .catch(() => {
        if (!controller.signal.aborted) setSeriesState("error");
      });
    return () => controller.abort();
  }, [benchmark, range, attempt, near, seriesKey, seriesRevision]);

  const value = scrub?.value ?? (benchmark.daily ? series.at(-1)?.value : quote?.price ?? series.at(-1)?.value);
  // 1D compares with the prior close; longer ranges compare with the close before the range starts.
  const versusPriorClose = range === "1D" && !benchmark.daily;
  const quoteDelta = versusPriorClose && !scrub && quote;
  const baseline = versusPriorClose
    ? quote?.previousClose ?? (quote ? quote.price - quote.change : undefined)
    : marketRangeBaseline(series, range);
  const change = quoteDelta ? quote.change : value !== undefined && baseline !== undefined ? value - baseline : undefined;
  const percent = quoteDelta ? quote.changePercent : change !== undefined && baseline ? change / Math.abs(baseline) * 100 : undefined;
  const positive = (change ?? 0) >= 0;
  const pointDate = !scrub && !benchmark.daily && quote?.marketTime ? new Date(quote.marketTime * 1000).toISOString() : (scrub ?? series[series.length - 1])?.date;
  // Use the trading date supplied by the data, rather than the viewer's local day.
  const date = pointDate?.slice(0, 10);
  const spec = RANGES.find((item) => item.key === range)!;

  const valueDisplay = (<>{value === undefined && (quoteLoading || seriesState === "loading") ? <Skeleton className="h-8 w-28" /> : value === undefined ? "—" : unit === "percent" ? `${indexValue(value)}%` : unit === "points" ? indexValue(value) : money(value)}</>);
  const changeDisplay = (<>{change !== undefined && unit === "percent"
            ? `${positive ? "+" : "−"}${indexValue(Math.abs(change) * 100)} bp`
            : change !== undefined && percent !== undefined
              ? `${positive ? "+" : "−"}${indexValue(Math.abs(change))} (${positive ? "+" : "−"}${Math.abs(percent).toFixed(2)}%)`
              : quoteLoading || seriesState === "loading" ? <Skeleton className="inline-block h-4 w-32 align-middle" /> : c("Change unavailable", "暂无涨跌数据")}
          {benchmark.daily && range === "1D" && <span className="ml-1 text-muted-foreground">{c("vs. prior observation", "较前次观测")}</span>}
          <span className="ml-1 truncate text-muted-foreground max-md:ml-0 max-md:block"><span className="max-md:hidden"> · </span>{versusPriorClose && !scrub ? c("vs. prior close", "较昨收") : c(spec.en, spec.zh)}</span></>);
  const chartDisplay = (<>{seriesState === "loading" ? (
            <Skeleton className="h-full w-full" />
          ) : seriesState === "error" ? (
            <div role="status" className="flex h-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
              <span>{c("Chart unavailable", "走势暂不可用")}</span>
              <span aria-hidden className="h-7" />
            </div>
          ) : (
            <ScrubChart
              data={series}
              positive={positive}
              height="100%"
              onScrub={setScrub}
              label={c(`${benchmark.en} trend, ${spec.en}`, `${benchmark.zh}走势，${spec.zh}`)}
            />
          )}</>);


  return (
    <article ref={host} className="relative h-60 w-60 shrink-0 snap-start max-md:h-auto max-md:w-[11.25rem] overflow-hidden rounded-3xl border border-foreground/10 glass-card bg-card-glass transition-colors duration-200 hover:border-foreground/25 hover:bg-foreground/[0.04] xl:w-auto xl:min-w-0">
      <Link
        href={benchmark.sourceUrl ?? marketStockHref(benchmark.symbol)}
        target={benchmark.sourceUrl ? "_blank" : undefined}
        rel={benchmark.sourceUrl ? "noopener noreferrer" : undefined}
        aria-label={c(`Open ${benchmark.en} market details`, `查看${benchmark.zh}行情详情`)}
        className="block h-full cursor-pointer rounded-3xl p-4 focus-visible:outline-none max-md:p-3"
      >
        <div className="flex h-6 min-w-0 items-baseline justify-between gap-x-2 max-md:h-5">
          <h3 className="min-w-0 truncate text-sm font-medium" title={c(benchmark.en, benchmark.zh)}>{c(benchmark.en, benchmark.zh)}</h3>
          <time dateTime={date} className="figure shrink-0 text-xs text-muted-foreground">{date ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : "—"}</time>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{benchmark.symbol}{benchmark.daily && c(" · Daily", " · 日度")}</p>
        <div className="figure mt-3 min-h-8 text-2xl font-semibold tracking-tight max-md:mt-1.5 max-md:min-h-0 max-md:text-xl">
          {valueDisplay}
        </div>
        <div className={cn("figure mt-0.5 min-h-5 truncate text-xs font-medium", change === undefined ? "text-muted-foreground" : positive ? "text-positive" : "text-negative")}>
          {changeDisplay}
        </div>
        <div className="mt-2 h-16 max-md:h-10" aria-busy={seriesState === "loading"}>
          {chartDisplay}
        </div>
        <p className="mt-2 truncate text-xs text-muted-foreground max-md:hidden" title={benchmark.note ? c(benchmark.note.en, benchmark.note.zh) : undefined}>
          {benchmark.note ? c(benchmark.note.en, benchmark.note.zh) : unit === "percent" ? c("FRED · Yield in %", "FRED · 收益率 %") : unit === "points" ? c("Index points", "指数点位") : c("USD price", "美元价格")}
        </p>
      </Link>
      {seriesState === "error" && (
        <Button
          size="xs"
          variant="ghost"
          className="absolute bottom-12 left-1/2 -translate-x-1/2 max-md:bottom-3"
          aria-label={c(`Retry ${benchmark.en} chart`, `重试${benchmark.zh}走势`)}
          onClick={onRetry}
        >
          {c("Retry", "重试")}
        </Button>
      )}
    </article>
  );
}

type MarketRangeControlsProps = { range: RangeKey; setRange: (range: RangeKey) => void; view: MarketView; setView: (view: MarketView) => void };

/** `inline` sits beside a section title on phones instead of filling its own row. */
function MarketRangeControls({ range, setRange, view, setView, inline = false }: MarketRangeControlsProps & { inline?: boolean }) {
  const c = useCopy();
  return (
              <div className={cn("flex min-w-0 items-center justify-end gap-2 md:gap-3", !inline && "max-md:w-full")}>
                {view === "card" ? <SegmentedControl
                  label={c("Chart range", "走势区间")}
                  value={range}
                  onChange={setRange}
                  className={cn("min-w-0 !shrink flex-nowrap overflow-x-auto border border-border scrollbar-hide max-md:!max-w-[9.75rem] max-md:!gap-0.5", !inline && "max-md:mr-auto")}
                  itemClassName="!min-h-9 max-md:!min-h-8 max-md:!px-2.5 max-md:!text-[0.8125rem]"
                  options={RANGES.map((item) => ({
                    value: item.key,
                    label: c(item.en, item.zh),
                    ariaLabel: item.key === "QTD" ? c("QTD, quarter to date", "QTD，本季度至今") : item.key === "YTD" ? c("YTD, year to date", "YTD，今年至今") : undefined,
                    title: item.key === "QTD" ? c("Quarter to date", "本季度至今") : item.key === "YTD" ? c("Year to date", "今年至今") : undefined,
                  }))}
                /> : <p className={cn("min-w-0 truncate text-sm text-muted-foreground", inline ? "max-md:hidden" : "max-md:mr-auto")}>{c("Compare all periods", "多区间表现对比")}</p>}
                <SegmentedControl
                  label={c("Display mode", "显示方式")}
                  value={view}
                  onChange={setView}
                  className="border border-border max-md:!gap-0.5"
                  itemClassName="!min-h-9 max-md:!min-h-8 max-md:!w-8 max-md:!px-0"
                  options={[
                    {
                      value: "card",
                      label: (
                        <>
                          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                          <span className="max-md:sr-only">{c("Cards", "卡片")}</span>
                        </>
                      ),
                    },
                    {
                      value: "list",
                      label: (
                        <>
                          <List className="h-3.5 w-3.5" aria-hidden />
                          <span className="max-md:sr-only">{c("List", "列表")}</span>
                        </>
                      ),
                    },
                  ]}
                />
              </div>
  );
}

function MarketCharts({ groups, quotes, loading, range, attempt, onRetry, view, comparable = false, sectionControls }: {
  comparable?: boolean;
  /** Controls shown beside the first section title. */
  sectionControls?: React.ReactNode;
  groups: readonly (typeof MARKET_GROUPS)[number][];
  view: MarketView;
  quotes: Record<string, StockQuote>;
  loading: boolean;
  range: RangeKey;
  attempt: number;
  onRetry: () => void;
}) {
  const c = useCopy();
  const [comparing, setComparing] = useState<(typeof MARKET_GROUPS)[number] | null>(null);
  return (
            <section aria-label={groups.length === 1 ? c("Market indices", "市场指数") : c("Market trends", "市场走势")}>
              {view === "list" && <div className="mb-3 flex min-h-14 items-center justify-between gap-3">
                <h2 className="min-w-0 truncate text-xl font-semibold tracking-[-0.01em]">{c(groups[0].en, groups[0].zh)}</h2>
                {sectionControls}
              </div>}
              {view === "list" ? <MarketComparison groups={groups} attempt={attempt} /> : groups.map((group, index) => (
                <section key={group.key} aria-labelledby={`market-${group.key}-heading`} className="first:mt-0">
                  <div className="mb-3 flex min-h-14 items-center justify-between gap-3">
                    <h2 id={`market-${group.key}-heading`} className="min-w-0 truncate text-xl font-semibold tracking-[-0.01em]">{c(group.en, group.zh)}</h2>
                    {index === 0 && sectionControls}
                    {comparable && <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setComparing(group)}><LineChart className="h-3.5 w-3.5" aria-hidden />{c("Compare", "对比")}</Button>}
                  </div>
                  <div
                    role="region"
                    aria-label={c(`${group.en}, scroll horizontally`, `${group.zh}，可横向滚动`)}
                    tabIndex={0}
                    className="flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain pb-2 max-md:scrollbar-hide sm:gap-4 xl:grid xl:grid-cols-5 focus-visible:outline-none"
                  >
                    {group.instruments.map(item => (
                      <MarketInstrumentCard
                        key={item.symbol}
                        benchmark={item}
                        quote={quotes[item.symbol]}
                        quoteLoading={loading}
                        range={range}
                        attempt={attempt}
                        onRetry={onRetry}
                      />
                    ))}
                  </div>
                </section>
              ))}
              {comparing && <MarketCompareDialog instruments={comparing.instruments} initialRange={range} attempt={attempt} title={c(comparing.en, comparing.zh)} onClose={() => setComparing(null)} />}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                {view === "card" && !loading && groups.some(group => group.instruments.some(item => item.source !== "fred" && !quotes[item.symbol])) && (
                  <Button size="xs" variant="ghost" onClick={onRetry}>
                    {c("Retry missing quotes", "重试缺失报价")}
                  </Button>
                )}
              </div>
            </section>
  );
}

type MarketTabProps = { range: RangeKey; view: MarketView; attempt: number; retry: () => void };

function MarketTrends({ range, view, attempt, retry }: MarketTabProps) {
  const { setContext } = useDecisionCommand();
  const { quotes, loading } = useMarketQuotes(TREND_QUOTE_SYMBOLS, true, attempt);

  const context = JSON.stringify({ workspace: "Markets / Market trends", instruments: TREND_GROUPS.map(group => ({ group: group.en, symbols: group.instruments.map(item => item.symbol) })), range, quotes });
  useEffect(() => {
    setContext(context);
    return () => setContext("");
  }, [context, setContext]);

  return <div className="min-w-0 pt-6"><MarketCharts comparable view={view} groups={TREND_GROUPS} quotes={quotes} loading={loading} range={range} attempt={attempt} onRetry={retry} /></div>;
}

function MarketOverview({ range, view, attempt, retry, sectionControls }: MarketTabProps & { sectionControls: React.ReactNode }) {
  const c = useCopy();
  const { setContext } = useDecisionCommand();
  const { quotes, loading, unavailable: failed } = useMarketQuotes(BENCHMARKS.map(item => item.symbol), true, attempt);

  const held = useHeldTickers(attempt);
  const catalogue = useCreatorCatalogue(attempt);
  const consensus = useMemo(() => new Map(catalogue.data?.stocks.map(stock => [stock.ticker, stock]) ?? []), [catalogue.data]);
  const heldSet = useMemo(() => new Set(held.tickers), [held.tickers]);

  const context = JSON.stringify({ workspace: "Markets / Market overview", benchmarks: BENCHMARKS.map(item => item.symbol), range, quotes, quotesUnavailable: failed });
  useEffect(() => {
    setContext(context);
    return () => setContext("");
  }, [context, setContext]);

  const shifts = [...(catalogue.data?.changes ?? [])]
    .sort((a, b) => Number(heldSet.has(b.ticker)) - Number(heldSet.has(a.ticker)) || b.current_date.localeCompare(a.current_date))
    .slice(0, 5);
  return (
        <div className="mx-auto grid gap-x-8 gap-y-2 pt-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:gap-x-12">
          <div className="min-w-0 xl:col-span-2">
            <MarketCharts view={view} groups={OVERVIEW_GROUPS} quotes={quotes} loading={loading} range={range} attempt={attempt} onRetry={retry} sectionControls={sectionControls} />
          </div>
          <div className="min-w-0 space-y-10">
            <StockObservationList range={range} catalogue={catalogue} held={held} refreshToken={attempt} onRetry={retry} />
          </div>

          <aside className="min-w-0 space-y-8 xl:sticky xl:top-8 xl:self-start">
            <MarketWatchlistCard />
            <section aria-labelledby="market-creator-updates-title" className="min-w-0">
              <header className="mb-3 flex min-h-14 items-center gap-2">
                <h2 id="market-creator-updates-title" className="text-lg font-semibold">{c("Creator updates", "博主新动态")}</h2>
                <div className="ml-auto flex items-center">
                  <Button asChild variant="outline" size="icon" className="h-11 w-11"><Link href="/dashboard/youtube-opinions" aria-label={c("Open all creator opinions", "查看全部观点")} title={c("Open all opinions", "查看全部观点")}><ArrowUpRight className="h-4 w-4" aria-hidden /></Link></Button>
                </div>
              </header>
              <ListCard aria-busy={catalogue.loading && !catalogue.data}>
                {catalogue.loading && !catalogue.data ? (
                  <div role="status" aria-label={c("Loading creator updates", "正在加载博主新动态")}><RailRowsSkeleton rows={5} /></div>
                ) : catalogue.error && !catalogue.data ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-sm font-medium">{c("Creator updates could not be loaded.", "暂时无法加载博主动态。")}</p>
                    <Button size="sm" variant="outline" className="mt-4" onClick={retry}>{c("Retry", "重试")}</Button>
                  </div>
                ) : shifts.length ? (
                  <ListRows>{shifts.map((shift) => (
                    <ListRow key={shift.ticker} className="pr-0">
                      <Link href={marketStockHref(shift.ticker)} className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-full px-1 text-sm transition-colors duration-150 hover:text-foreground focus-visible:outline-none max-md:px-0" title={c(`${shift.ticker} creator opinions`, `${shift.ticker} 博主观点`)}>
                        <span className="flex min-w-0 items-center gap-2"><span className="shrink-0" aria-hidden><CompanyLogo symbol={shift.ticker} size="sm" className="md:max-h-5 md:max-w-5 md:!p-0.5" /></span><span className="truncate font-medium">{shift.ticker}{heldSet.has(shift.ticker) && <HeldMark />}</span></span>
                        <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs">
                          <OpinionStrength value={consensus.get(shift.ticker)?.avg_score} className="text-xs" />
                          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
                          {shift.change == null
                            ? <span className="text-muted-foreground">{c("First coverage", "首次覆盖")}</span>
                            : <OpinionStrength value={shift.change} change barsOnly className="text-xs" />}
                        </span>
                      </Link>
                    </ListRow>
                  ))}</ListRows>
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">{c("No creator updates yet.", "暂时没有博主新动态。")}</div>
                )}
              </ListCard>
            </section>
          </aside>
        </div>
  );
}

export default function Market() {
  const c = useCopy();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab = requestedTab === "calendar" || requestedTab === "macro" || requestedTab === "trends" ? requestedTab : "overview";
  const [range, setRange] = useState<RangeKey>("1D");
  const [view, setViewState] = useState<MarketView>("card");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  const tabList = useRef<HTMLDivElement>(null);
  // Keeps the active tab centred when the list scrolls on narrow screens.
  useEffect(() => {
    const list = tabList.current;
    const active = list?.querySelector<HTMLElement>('[data-state="active"]');
    if (list && active) list.scrollLeft = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
  }, [tab]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MARKET_VIEW_KEY);
      if (saved === "card" || saved === "list") setViewState(saved);
    } catch { /* Keep the default when storage is unavailable. */ }
  }, []);
  function setView(value: MarketView) {
    setViewState(value);
    try { localStorage.setItem(MARKET_VIEW_KEY, value); } catch { /* The toggle still works without storage. */ }
  }


  function selectTab(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "calendar" || value === "macro" || value === "trends") params.set("tab", value);
    else params.delete("tab");
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  return (
    <DashboardLayout title={c("Markets", "行情")}>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full min-w-0 max-w-[100rem] px-[16px] pb-8 md:pb-10 pt-6 md:px-8 md:pt-8">
          <Tabs value={tab} onValueChange={selectTab} className="min-w-0">
            {/* On phones the row dissolves (`contents`) so the tab bar can stick for the whole page, not just this row. The bar is the page-level nav: larger than in-page tabs, left-aligned, and it scrolls if it overflows. */}
            <div className="flex flex-wrap items-center justify-between gap-3 max-md:contents">
              <TabsList ref={tabList} variant="pill-solid" aria-label={c("Market views", "行情视图")} className="max-md:sticky max-md:top-3 max-md:z-30 max-md:min-h-12 max-md:gap-1 max-md:self-start max-md:p-1">
                <TabsTrigger variant="pill" value="overview" className="max-md:!min-h-10 max-md:!px-4 max-md:!text-[0.9375rem]">{c("Market overview", "市场概览")}</TabsTrigger>
                <TabsTrigger variant="pill" value="trends" className="max-md:!min-h-10 max-md:!px-4 max-md:!text-[0.9375rem]">{c("Market trends", "市场走势")}</TabsTrigger>
                <TabsTrigger variant="pill" value="calendar" className="max-md:!min-h-10 max-md:!px-4 max-md:!text-[0.9375rem]">{c("Event calendar", "事件日历")}</TabsTrigger>
                <TabsTrigger variant="pill" value="macro" className="max-md:!min-h-10 max-md:!px-4 max-md:!text-[0.9375rem]">{c("Macro indicators", "宏观指标")}</TabsTrigger>
              </TabsList>
              <div ref={setToolbar} className={cn("flex min-w-0 max-w-full items-center justify-end gap-3 max-md:mt-3 max-md:w-full max-md:justify-between md:ml-auto", (tab === "calendar" || tab === "overview") && "max-md:hidden")}>
                {tab === "trends" && <MarketRangeControls range={range} setRange={setRange} view={view} setView={setView} />}
              </div>
            </div>
            <TabsContent value="overview"><MarketOverview range={range} view={view} attempt={attempt} retry={retry} sectionControls={<MarketRangeControls inline range={range} setRange={setRange} view={view} setView={setView} />} /></TabsContent>
            <TabsContent value="trends"><MarketTrends range={range} view={view} attempt={attempt} retry={retry} /></TabsContent>
            <TabsContent value="calendar"><MarketEventCalendar toolbar={toolbar} /></TabsContent>
            <TabsContent value="macro"><MacroIndicators toolbar={toolbar} /></TabsContent>
          </Tabs>
        </div>
      </main>
    </DashboardLayout>
  );
}
