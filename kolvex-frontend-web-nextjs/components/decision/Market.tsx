"use client";
import { loadMarketObservations } from "@/lib/marketObservationsApi";
import { loadClientCache, peekClientCache } from "@/lib/clientCache";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, LayoutGrid, List } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanyLogo from "@/components/ui/company-logo";
import OpinionStrength from "@/components/youtube/OpinionStrength";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type StockQuote } from "@/lib/stockApi";
import { cn } from "@/lib/utils";
import { loadStockTrend } from "@/lib/stockTrends";
import { MARKET_RANGES, marketRangeBaseline, observationRange, type MarketObservation } from "@/lib/marketObservations";
import { loadMarketQuotes, getCachedMarketQuotes } from "@/lib/marketQuotes";
import { BENCHMARKS, MARKET_GROUPS, isMarketIndex, indexValue, type MarketInstrument } from "@/lib/marketBenchmarks";
import {
  Change,
  Empty,
  HeldMark,
  Panel,
  TextLink,
  money,
  useCopy,
  useCreatorCatalogue,
  useDayLabel,
  useHeldTickers,
} from "./shared";
import ScrubChart, { type ScrubPoint } from "./ScrubChart";
import { useDecisionCommand } from "./CommandLayer";
import StockLookup from "./StockLookup";
import MacroIndicators from "./MacroIndicators";
import MarketEventCalendar from "./MarketEventCalendar";
import StockObservationList from "./StockObservationList";
import MarketComparison from "./MarketComparison";

const OVERVIEW_GROUPS = MARKET_GROUPS.filter(group => group.key === "indices");
const TREND_GROUPS = MARKET_GROUPS.filter(group => group.key !== "indices");
const TREND_QUOTE_SYMBOLS = TREND_GROUPS.flatMap(group => group.instruments.filter(item => item.source !== "fred").map(item => item.symbol));
const RANGES = MARKET_RANGES;

type MarketView = "card" | "list";
const MARKET_VIEW_KEY = "kolvex:market-view";

type RangeKey = (typeof RANGES)[number]["key"];

const pill = (active: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
    active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted hover:text-foreground",
  );

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
  const seriesKey = `/market-series/${benchmark.symbol}/${range}`;
  const [series, setSeries] = useState<ScrubPoint[]>(() => peekClientCache<ScrubPoint[]>(seriesKey) ?? []);
  const [seriesState, setSeriesState] = useState<"loading" | "ready" | "error">((peekClientCache<ScrubPoint[]>(seriesKey)?.length ?? 0) > 1 ? "ready" : "loading");
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);

  const seriesAttempt = useRef(attempt);
  useEffect(() => {
    const controller = new AbortController();
    const spec = RANGES.find((item) => item.key === range)!;
    const saved = peekClientCache<ScrubPoint[]>(seriesKey);
    setSeriesState(saved?.length ? "ready" : "loading");
    setSeries(saved ?? []);
    setScrub(null);
    if (!near) return () => controller.abort();
    const forceRefresh = seriesAttempt.current !== attempt;
    seriesAttempt.current = attempt;
    async function load(signal: AbortSignal): Promise<MarketObservation[]> {
      if (benchmark.source === "fred") {
        return loadMarketObservations(benchmark.symbol, signal, forceRefresh);
      }
      return loadStockTrend(benchmark.symbol, benchmark.daily
        ? { period: range === "1D" ? "5d" : spec.period, interval: "1d" }
        : { period: spec.period, interval: spec.interval }, signal, forceRefresh);
    }
    loadClientCache(seriesKey, async signal => {
      const history = await load(signal);
      return benchmark.daily || ["1Y", "QTD", "YTD"].includes(range) ? observationRange(history, range) : history;
    }, { ttl: benchmark.daily ? 5 * 60_000 : 60_000, maxAge: 5 * 60_000, force: forceRefresh, signal: controller.signal }).then((points) => {
        if (controller.signal.aborted) return;
        setSeries(points);
        setSeriesState(points.length > 1 ? "ready" : "error");
      })
      .catch(() => {
        if (!controller.signal.aborted) setSeriesState("error");
      });
    return () => controller.abort();
  }, [benchmark.symbol, benchmark.source, benchmark.daily, range, attempt, near, seriesKey]);

  const value = scrub?.value ?? (benchmark.daily ? series.at(-1)?.value : (range === "1D" ? quote?.price : undefined) ?? series.at(-1)?.value);
  const baseline = range === "1D" && !benchmark.daily
    ? quote?.previousClose ?? (quote ? quote.price - quote.change : undefined)
    : marketRangeBaseline(series, range);
  const change = value !== undefined && baseline !== undefined ? value - baseline : undefined;
  const percent = change !== undefined && baseline ? change / Math.abs(baseline) * 100 : undefined;
  const positive = (change ?? quote?.change ?? 0) >= 0;
  const pointDate = (scrub ?? series[series.length - 1])?.date;
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
          <span className="sr-only"> · {c(spec.en, spec.zh)}</span></>);
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
              height={96}
              onScrub={setScrub}
              label={c(`${benchmark.en} trend, ${spec.en}`, `${benchmark.zh}走势，${spec.zh}`)}
            />
          )}</>);


  return (
    <article ref={host} className="relative h-[272px] w-[272px] shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30">
      <Link
        href={benchmark.sourceUrl ?? `/dashboard/market/${encodeURIComponent(benchmark.symbol)}`}
        target={benchmark.sourceUrl ? "_blank" : undefined}
        rel={benchmark.sourceUrl ? "noopener noreferrer" : undefined}
        aria-label={c(`Open ${benchmark.en} market details`, `查看${benchmark.zh}行情详情`)}
        className="block h-full cursor-pointer rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <div className="flex h-6 min-w-0 items-baseline gap-x-2">
          <h3 className="min-w-0 truncate text-base font-semibold" title={c(benchmark.en, benchmark.zh)}>{c(benchmark.en, benchmark.zh)}</h3>
          <time dateTime={date} className="figure shrink-0 text-xs text-muted-foreground">{date ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : "—"}</time>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{benchmark.symbol}{benchmark.daily && c(" · Daily", " · 日度")}</p>
        <div className="figure mt-2 min-h-8 text-2xl font-semibold tracking-tight">
          {valueDisplay}
        </div>
        <div className={cn("figure mt-0.5 min-h-5 truncate text-xs font-medium", change === undefined ? "text-muted-foreground" : positive ? "text-positive" : "text-negative")}>
          {changeDisplay}
        </div>
        <div className="mt-2 h-24" aria-busy={seriesState === "loading"}>
          {chartDisplay}
        </div>
        <p className="mt-2 truncate text-[11px] text-muted-foreground" title={benchmark.note ? c(benchmark.note.en, benchmark.note.zh) : undefined}>
          {benchmark.note ? c(benchmark.note.en, benchmark.note.zh) : unit === "percent" ? c("FRED · Yield in %", "FRED · 收益率 %") : unit === "points" ? c("Index points", "指数点位") : c("USD price", "美元价格")}
        </p>
      </Link>
      {seriesState === "error" && (
        <Button
          size="xs"
          variant="ghost"
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
          aria-label={c(`Retry ${benchmark.en} chart`, `重试${benchmark.zh}走势`)}
          onClick={onRetry}
        >
          {c("Retry", "重试")}
        </Button>
      )}
    </article>
  );
}

function MarketRangeControls({ range, setRange, view, setView }: { range: RangeKey; setRange: (range: RangeKey) => void; view: MarketView; setView: (view: MarketView) => void }) {
  const c = useCopy();
  return (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                {view === "card" ? <div role="group" aria-label={c("Chart range", "走势区间")} className="flex flex-wrap gap-1">
                  {RANGES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={range === item.key}
                      aria-label={item.key === "QTD" ? c("QTD, quarter to date", "QTD，本季度至今") : item.key === "YTD" ? c("YTD, year to date", "YTD，今年至今") : undefined}
                      title={item.key === "QTD" ? c("Quarter to date", "本季度至今") : item.key === "YTD" ? c("Year to date", "今年至今") : undefined}
                      onClick={() => setRange(item.key)}
                      className={pill(range === item.key)}
                    >
                      {c(item.en, item.zh)}
                    </button>
                  ))}
                </div> : <p className="text-[13px] text-muted-foreground">{c("Compare all periods", "多区间表现对比")}</p>}
                <div role="group" aria-label={c("Display mode", "显示方式")} className="flex shrink-0 gap-1 rounded-full border border-border p-1">
                  <button type="button" aria-pressed={view === "card"} onClick={() => setView("card")} className={pill(view === "card")}><LayoutGrid className="h-3.5 w-3.5" aria-hidden />{c("Cards", "卡片")}</button>
                  <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={pill(view === "list")}><List className="h-3.5 w-3.5" aria-hidden />{c("List", "列表")}</button>
                </div>
              </div>
  );
}

function MarketCharts({ groups, quotes, loading, range, setRange, attempt, onRetry, checkedAt, view, setView }: {
  groups: readonly (typeof MARKET_GROUPS)[number][];
  view: MarketView;
  setView: (view: MarketView) => void;
  quotes: Record<string, StockQuote>;
  loading: boolean;
  range: RangeKey;
  setRange: (range: RangeKey) => void;
  attempt: number;
  onRetry: () => void;
  checkedAt: string | null;
}) {
  const c = useCopy();
  return (
            <section aria-label={groups.length === 1 ? c("Market indices", "市场指数") : c("Market trends", "市场走势")}>
              <MarketRangeControls range={range} setRange={setRange} view={view} setView={setView} />
              {view === "list" ? <MarketComparison groups={groups} attempt={attempt} /> : groups.map(group => (
                <section key={group.key} aria-labelledby={`market-${group.key}-heading`} className="mt-6 first:mt-0">
                  <h2 id={`market-${group.key}-heading`} className="mb-4 text-base font-semibold">{c(group.en, group.zh)}</h2>
                  <div
                    role="region"
                    aria-label={c(`${group.en}, scroll horizontally`, `${group.zh}，可横向滚动`)}
                    tabIndex={0}
                    className="flex snap-x snap-proximity gap-4 overflow-x-auto overscroll-x-contain pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <p>{view === "list" ? c("Daily closes · Price performance uses adjusted history · Yahoo Finance / FRED (Federal Reserve & ICE BofA) · Price changes in %; yields/spreads in pp; MOVE in points · QTD: quarter to date; YTD: year to date · Missing baselines: —", "日度收盘或观测值 · 价格表现使用复权日线 · 来源：Yahoo Finance / FRED（美联储、ICE BofA）· 价格为涨跌幅 %，收益率及利差为百分点 pp，MOVE 为点数 · QTD：本季度至今，YTD：今年至今 · 基准数据不足显示 —") : groups.length === 1 ? c("Index points · Quotes may be delayed", "指数点位 · 报价可能延迟") : c("Quotes may be delayed · Daily series use published observations · Yield/spread changes in bp (1 bp = 0.01 percentage point)", "报价可能延迟 · 日度指标以实际观测日为准 · 收益率及利差变动以基点计（1 bp = 0.01个百分点）")}{checkedAt && c(`, checked ${checkedAt}`, `，${checkedAt} 查询`)}</p>
                {view === "card" && !loading && groups.some(group => group.instruments.some(item => item.source !== "fred" && !quotes[item.symbol])) && (
                  <Button size="xs" variant="ghost" onClick={onRetry}>
                    {c("Retry missing quotes", "重试缺失报价")}
                  </Button>
                )}
              </div>
            </section>
  );
}

function MarketTrends({ range, setRange, view, setView }: { range: RangeKey; setRange: (range: RangeKey) => void; view: MarketView; setView: (view: MarketView) => void }) {
  const { setContext } = useDecisionCommand();
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>(() => getCachedMarketQuotes(TREND_QUOTE_SYMBOLS));
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadMarketQuotes(TREND_QUOTE_SYMBOLS, controller.signal, batch => {
      setQuotes(previous => ({ ...previous, ...batch }));
    }, attempt > 0).then(({ quotes: result }) => {
      if (controller.signal.aborted) return;
      setQuotes(result);
      setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setLoading(false);
    });
    return () => controller.abort();
  }, [attempt]);

  const context = JSON.stringify({ workspace: "Markets / Market trends", instruments: TREND_GROUPS.map(group => ({ group: group.en, symbols: group.instruments.map(item => item.symbol) })), range, quotes });
  useEffect(() => {
    setContext(context);
    return () => setContext("");
  }, [context, setContext]);

  return <div className="min-w-0 pt-6"><MarketCharts view={view} setView={setView} groups={TREND_GROUPS} quotes={quotes} loading={loading} range={range} setRange={setRange} attempt={attempt} onRetry={() => setAttempt(value => value + 1)} checkedAt={checkedAt} /></div>;
}

function MarketOverview({ range, setRange, view, setView }: { range: RangeKey; setRange: (range: RangeKey) => void; view: MarketView; setView: (view: MarketView) => void }) {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const { setContext } = useDecisionCommand();
  const [attempt, setAttempt] = useState(0);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>(() => getCachedMarketQuotes(BENCHMARKS.map(item => item.symbol)));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const held = useHeldTickers(attempt);
  const catalogue = useCreatorCatalogue(attempt);
  const consensus = useMemo(() => new Map(catalogue.data?.stocks.map(stock => [stock.ticker, stock]) ?? []), [catalogue.data]);
  const heldSet = useMemo(() => new Set(held.tickers), [held.tickers]);
  const lastQuoteAttempt = useRef(attempt);
  useEffect(() => {
    const forceRefresh = lastQuoteAttempt.current !== attempt;
    lastQuoteAttempt.current = attempt;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    async function load() {
      const { quotes: result, unavailable } = await loadMarketQuotes(
        BENCHMARKS.map(item => item.symbol),
        controller.signal,
        batch => setQuotes(previous => ({ ...previous, ...batch })),
        forceRefresh,
      );
      if (!controller.signal.aborted) {
        setQuotes(result);
        setFailed(unavailable);
        setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [attempt]);

  const context = JSON.stringify({ workspace: "Markets / Market overview", benchmarks: BENCHMARKS.map(item => item.symbol), range, quotes, quotesUnavailable: failed });
  useEffect(() => {
    setContext(context);
    return () => setContext("");
  }, [context, setContext]);

  const shifts = [...(catalogue.data?.changes ?? [])]
    .sort((a, b) => Number(heldSet.has(b.ticker)) - Number(heldSet.has(a.ticker)) || b.current_date.localeCompare(a.current_date))
    .slice(0, 5);
  return (
        <div className="mx-auto grid gap-x-8 gap-y-10 pt-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 xl:col-span-2">
            <MarketCharts view={view} setView={setView} groups={OVERVIEW_GROUPS} quotes={quotes} loading={loading} range={range} setRange={setRange} attempt={attempt} onRetry={() => setAttempt(value => value + 1)} checkedAt={checkedAt} />
          </div>
          <div className="min-w-0 space-y-10">
            <StockObservationList range={range} catalogue={catalogue} held={held} onRetry={() => setAttempt(value => value + 1)} />
          </div>

          <aside className="min-w-0 xl:sticky xl:top-8 xl:self-start xl:border-l xl:border-border xl:pl-6">
            <Panel
              title={c("Creator updates", "博主新动态")}
              id="market-creator-updates"
              className="[&>header]:items-center"
              action={<TextLink href="/dashboard/youtube-opinions" className="inline-flex min-h-10 items-center gap-1 !text-xs !font-medium text-muted-foreground hover:text-foreground">{c("View all", "全部观点")}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></TextLink>}
            >
              {catalogue.loading && !catalogue.data ? (
                <div className="space-y-4 py-4" aria-busy="true">
                  {[0, 1, 2].map((row) => <Skeleton key={row} className="h-12 w-full" />)}
                </div>
              ) : catalogue.error && !catalogue.data ? (
                <Empty action={<Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>{c("Retry", "重试")}</Button>}>
                  {c("Creator updates could not be loaded.", "暂时无法加载博主动态。")}
                </Empty>
              ) : shifts.length ? (
                <ul className="divide-y divide-border/60">
                  {shifts.map((shift) => (
                    <li key={shift.ticker}>
                      <Link
                        href={`/dashboard/market/${encodeURIComponent(shift.ticker)}`}
                        className="-mx-2 flex min-h-20 items-center justify-between gap-3 rounded-lg px-2 py-4 transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span aria-hidden><CompanyLogo symbol={shift.ticker} size="sm" /></span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">
                              {shift.ticker}
                              {heldSet.has(shift.ticker) && <HeldMark />}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">{dayLabel(shift.current_date)}</span>
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1 text-right text-xs">
                          <OpinionStrength value={consensus.get(shift.ticker)?.avg_score} className="text-xs" />
                          {shift.change == null
                            ? <span className="text-muted-foreground">{c("First coverage", "首次覆盖")}</span>
                            : <OpinionStrength value={shift.change} change className="text-xs" />}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>{c("No creator updates yet.", "暂时没有博主新动态。")}</Empty>
              )}
              <Link
                href="/dashboard/youtube-opinions/stocks"
                className="mt-2 flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {c("Explore creator-covered stocks", "查看博主覆盖股票")}
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            </Panel>
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
        <div className="mx-auto min-w-0 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <StockLookup />
          <Tabs value={tab} onValueChange={selectTab} className="mt-6 min-w-0">
            <TabsList aria-label={c("Market views", "行情视图")}>
              <TabsTrigger value="overview">{c("Market overview", "市场概览")}</TabsTrigger>
              <TabsTrigger value="trends">{c("Market trends", "市场走势")}</TabsTrigger>
              <TabsTrigger value="calendar">{c("Event calendar", "事件日历")}</TabsTrigger>
              <TabsTrigger value="macro">{c("Macro indicators", "宏观指标")}</TabsTrigger>
            </TabsList>
            <TabsContent value="overview"><MarketOverview range={range} setRange={setRange} view={view} setView={setView} /></TabsContent>
            <TabsContent value="trends"><MarketTrends range={range} setRange={setRange} view={view} setView={setView} /></TabsContent>
            <TabsContent value="calendar"><MarketEventCalendar /></TabsContent>
            <TabsContent value="macro"><MacroIndicators /></TabsContent>
          </Tabs>
        </div>
      </main>
    </DashboardLayout>
  );
}
