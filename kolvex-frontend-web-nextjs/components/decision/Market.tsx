"use client";

import { isProductFeatureEnabled } from "@/lib/productFeatures";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanyLogo from "@/components/ui/company-logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import OpinionStrength from "@/components/youtube/OpinionStrength";
import { getStockHistory, type StockQuote } from "@/lib/stockApi";
import { cn } from "@/lib/utils";
import { loadMarketQuotes } from "@/lib/marketQuotes";
import { BENCHMARKS, indexValue } from "@/lib/marketBenchmarks";
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
import StockTrend from "./StockTrend";

const DEFAULT_STOCKS = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AVGO"];
const RANGES = [
  { key: "1D", period: "1d", interval: "5m", en: "1D", zh: "1天" },
  { key: "1W", period: "5d", interval: "30m", en: "1W", zh: "1周" },
  { key: "1M", period: "1mo", interval: "1d", en: "1M", zh: "1月" },
  { key: "3M", period: "3mo", interval: "1d", en: "3M", zh: "3月" },
] as const;
const STOCK_GRID = "grid grid-cols-[minmax(0,1fr)_72px_80px] gap-x-3 sm:grid-cols-[minmax(0,1fr)_120px_88px_88px_72px] sm:gap-x-4";

type Universe = "featured" | "holdings" | "creators";
type Sort = "move" | "gainers" | "losers" | "default";
type RangeKey = (typeof RANGES)[number]["key"];

const pill = (active: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
    active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted hover:text-foreground",
  );

function BenchmarkCard({ benchmark, quote, quoteLoading, range, attempt, onRetry }: {
  benchmark: (typeof BENCHMARKS)[number];
  quote?: StockQuote;
  quoteLoading: boolean;
  range: RangeKey;
  attempt: number;
  onRetry: () => void;
}) {
  const c = useCopy();
  const [series, setSeries] = useState<ScrubPoint[]>([]);
  const [seriesState, setSeriesState] = useState<"loading" | "ready" | "error">("loading");
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const spec = RANGES.find((item) => item.key === range)!;
    setSeriesState("loading");
    setSeries([]);
    setScrub(null);
    getStockHistory(benchmark.symbol, { period: spec.period, interval: spec.interval }, controller.signal)
      .then((bars) => {
        if (controller.signal.aborted) return;
        let points = bars.map((bar) => ({ date: bar.date, value: bar.close }));
        if (range === "1D" && points.length) {
          const lastDay = points[points.length - 1].date.slice(0, 10);
          points = points.filter((point) => point.date.slice(0, 10) === lastDay);
        }
        setSeries(points);
        setSeriesState(points.length ? "ready" : "error");
      })
      .catch(() => {
        if (!controller.signal.aborted) setSeriesState("error");
      });
    return () => controller.abort();
  }, [benchmark.symbol, range, attempt]);

  const value = scrub?.value ?? quote?.price ?? series[series.length - 1]?.value;
  const baseline = range === "1D"
    ? quote?.previousClose ?? (quote ? quote.price - quote.change : undefined)
    : series[0]?.value;
  const change = value !== undefined && baseline ? value - baseline : undefined;
  const percent = change !== undefined && baseline ? change / baseline * 100 : undefined;
  const positive = (change ?? quote?.change ?? 0) >= 0;
  const pointDate = (scrub ?? series[series.length - 1])?.date;
  // Use the trading date supplied by the data, rather than the viewer's local day.
  const date = pointDate?.slice(0, 10);
  const spec = RANGES.find((item) => item.key === range)!;

  return (
    <article className="relative h-[244px] w-[272px] shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30">
      <Link
        href={`/dashboard/market/${encodeURIComponent(benchmark.symbol)}`}
        aria-label={c(`Open ${benchmark.en} market details`, `查看${benchmark.zh}行情详情`)}
        className="block h-full cursor-pointer rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <div className="flex min-h-6 flex-wrap items-baseline gap-x-2">
          <h2 className="text-base font-semibold">{c(benchmark.en, benchmark.zh)}</h2>
          <time dateTime={date} className="figure text-xs text-muted-foreground">{date ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : "—"}</time>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{benchmark.symbol}</p>
        <div className="figure mt-2 min-h-8 text-2xl font-semibold tracking-tight">
          {value === undefined && quoteLoading ? <Skeleton className="h-8 w-28" /> : value === undefined ? "—" : indexValue(value)}
        </div>
        <p className={cn("figure mt-0.5 min-h-5 text-xs font-medium", change === undefined ? "text-muted-foreground" : positive ? "text-positive" : "text-negative")}>
          {change !== undefined && percent !== undefined
            ? `${positive ? "+" : "−"}${indexValue(Math.abs(change))} (${positive ? "+" : "−"}${Math.abs(percent).toFixed(2)}%)`
            : c("Change unavailable", "暂无涨跌数据")}
          <span className="sr-only"> · {c(spec.en, spec.zh)}</span>
        </p>
        <div className="mt-2 h-24" aria-busy={seriesState === "loading"}>
          {seriesState === "loading" ? (
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
              label={c(`${benchmark.en} index, ${spec.en}`, `${benchmark.zh}指数走势，${spec.zh}`)}
            />
          )}
        </div>
      </Link>
      {seriesState === "error" && (
        <Button
          size="xs"
          variant="ghost"
          className="absolute bottom-5 left-1/2 -translate-x-1/2"
          aria-label={c(`Retry ${benchmark.en} chart`, `重试${benchmark.zh}走势`)}
          onClick={onRetry}
        >
          {c("Retry", "重试")}
        </Button>
      )}
    </article>
  );
}

function MarketOverview() {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const { setContext } = useDecisionCommand();
  const [attempt, setAttempt] = useState(0);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [range, setRange] = useState<RangeKey>("1D");
  const [universe, setUniverse] = useState<Universe>("featured");
  const [sort, setSort] = useState<Sort>("move");
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const held = useHeldTickers(attempt);
  const catalogue = useCreatorCatalogue(attempt);
  const coverage = useMemo(() => catalogue.data?.stocks.map((stock) => stock.ticker) ?? [], [catalogue.data]);
  const consensus = useMemo(
    () => new Map(catalogue.data?.stocks.map((stock) => [stock.ticker, stock]) ?? []),
    [catalogue.data],
  );
  const heldSet = useMemo(() => new Set(held.tickers), [held.tickers]);

  const symbols = universe === "holdings" ? held.tickers : universe === "creators" ? coverage : DEFAULT_STOCKS;
  const sourceLoading = universe === "holdings" ? held.loading : universe === "creators" ? catalogue.loading : false;
  const sourceError = universe === "holdings" ? held.error : universe === "creators" ? catalogue.error : false;
  const symbolsKey = symbols.join(",");
  const trendRange = RANGES.find(item => item.key === range)!;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    async function load() {
      const { quotes: result, unavailable } = await loadMarketQuotes(
        [...BENCHMARKS.map(item => item.symbol), ...symbolsKey.split(",")],
        controller.signal,
        batch => setQuotes(previous => ({ ...previous, ...batch })),
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
  }, [symbolsKey, attempt, quoteAttempt]);

  const context = JSON.stringify({ workspace: "Markets", benchmarks: BENCHMARKS.map((item) => item.symbol), range, universe, quotes, quotesUnavailable: failed });
  useEffect(() => {
    setContext(context);
    return () => setContext("");
  }, [context, setContext]);

  const visible = [...symbols].sort((a, b) => {
    if (sort === "default") return 0;
    const left = quotes[a]?.changePercent;
    const right = quotes[b]?.changePercent;
    const leftValid = typeof left === "number" && Number.isFinite(left);
    const rightValid = typeof right === "number" && Number.isFinite(right);
    if (!leftValid || !rightValid) return leftValid ? -1 : rightValid ? 1 : 0;
    if (sort === "move") return Math.abs(right) - Math.abs(left);
    return sort === "gainers" ? right - left : left - right;
  });

  const shifts = [...(catalogue.data?.changes ?? [])]
    .sort((a, b) => Number(heldSet.has(b.ticker)) - Number(heldSet.has(a.ticker)) || b.current_date.localeCompare(a.current_date))
    .slice(0, 5);
  const universeOptions = [
    { key: "featured", en: "Popular", zh: "热门" },
    { key: "holdings", en: "My holdings", zh: "我的持仓" },
    { key: "creators", en: "Creator coverage", zh: "博主覆盖" },
  ] as const;

  return (
        <div className="mx-auto grid gap-x-8 gap-y-10 pt-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 xl:col-span-2">
            <section aria-labelledby="market-overview-heading">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div role="group" aria-label={c("Chart range", "走势区间")} className="flex gap-1">
                  {RANGES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={range === item.key}
                      onClick={() => setRange(item.key)}
                      className={pill(range === item.key)}
                    >
                      {c(item.en, item.zh)}
                    </button>
                  ))}
                </div>
              </div>
              <div
                role="region"
                aria-label={c("Market indices, scroll horizontally", "市场指数，可横向滚动")}
                tabIndex={0}
                className="flex snap-x snap-proximity gap-4 overflow-x-auto overscroll-x-contain pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {BENCHMARKS.map((item) => (
                  <BenchmarkCard
                    key={item.symbol}
                    benchmark={item}
                    quote={quotes[item.symbol]}
                    quoteLoading={loading}
                    range={range}
                    attempt={attempt}
                    onRetry={() => setAttempt((n) => n + 1)}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <p>{c("Index values · Quotes may be delayed", "指数点位 · 报价可能延迟")}{checkedAt && c(`, checked ${checkedAt}`, `，${checkedAt} 查询`)}</p>
                {!loading && BENCHMARKS.some((item) => !quotes[item.symbol]) && (
                  <Button size="xs" variant="ghost" onClick={() => setAttempt((n) => n + 1)}>
                    {c("Retry missing quotes", "重试缺失报价")}
                  </Button>
                )}
              </div>
            </section>
          </div>
          <div className="min-w-0 space-y-10">
            <Panel
              title={c("Biggest moves today", "今天动得最大的")}
              description={c(
                "Ranked within the list you pick, not the whole market.",
                "只在你选的列表内排序，不是全市场排行。",
              )}
              id="market-movers"
              className="[&>header]:items-center"
              action={
                <div className="w-40 shrink-0">
                  <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
                    <SelectTrigger
                      aria-label={c("Sort stocks", "股票排序")}
                      className="!h-10 !rounded-full !border-border !bg-transparent hover:!bg-muted px-4 text-[13px] font-semibold focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:!bg-secondary"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      align="end"
                      sideOffset={4}
                      className="w-[var(--radix-select-trigger-width)] min-w-0 max-h-[var(--radix-select-content-available-height)] motion-reduce:animate-none"
                    >
                      <SelectItem value="move" className="min-h-10 text-[13px] focus-visible:!outline-none focus:bg-secondary data-[state=checked]:bg-muted data-[state=checked]:font-semibold">{c("Biggest move", "变动最大")}</SelectItem>
                      <SelectItem value="gainers" className="min-h-10 text-[13px] focus-visible:!outline-none focus:bg-secondary data-[state=checked]:bg-muted data-[state=checked]:font-semibold">{c("Top gainers", "涨幅最大")}</SelectItem>
                      <SelectItem value="losers" className="min-h-10 text-[13px] focus-visible:!outline-none focus:bg-secondary data-[state=checked]:bg-muted data-[state=checked]:font-semibold">{c("Top losers", "跌幅最大")}</SelectItem>
                      <SelectItem value="default" className="min-h-10 text-[13px] focus-visible:!outline-none focus:bg-secondary data-[state=checked]:bg-muted data-[state=checked]:font-semibold">{c("List order", "列表顺序")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
            >
              <div role="group" aria-label={c("Stock list", "股票列表")} className="flex flex-wrap items-center gap-1 py-4">
                {universeOptions.filter((item) => item.key !== "holdings" || isProductFeatureEnabled("portfolio")).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={universe === item.key}
                    onClick={() => setUniverse(item.key)}
                    className={pill(universe === item.key)}
                  >
                    {c(item.en, item.zh)}
                    {item.key === "holdings" && held.tickers.length > 0 && (
                      <span className={cn("tabular-nums text-xs", universe === item.key ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {held.tickers.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {failed && !loading && (
                <div role="status" className="flex flex-wrap items-center gap-2 pb-2 text-[13px] text-muted-foreground">
                  <span>{c("Some quotes are unavailable.", "部分报价暂不可用。")}</span>
                  <Button size="xs" variant="ghost" onClick={() => setQuoteAttempt(value => value + 1)}>{c("Retry quotes", "重试报价")}</Button>
                </div>
              )}
              <div aria-busy={loading || sourceLoading}>
                <div className={cn(STOCK_GRID, "rounded-lg bg-muted/60 px-3 py-3 text-xs text-muted-foreground")}>
                  <span>{c("Stock", "股票")}</span>
                  <span className="hidden sm:block">{c("Creators", "博主共识")}</span>
                  <span className="text-center">{c(`Trend · ${trendRange.en}`, `走势 · ${trendRange.zh}`)}</span>
                  <span className="text-right"><span className="sm:hidden">{c("Price / Today", "价格 / 今日")}</span><span className="hidden sm:inline">{c("Price", "价格")}</span></span>
                  <span className="hidden text-right sm:block">{c("Today", "今日")}</span>
                </div>
                {(loading && !Object.keys(quotes).length) || sourceLoading
                  ? [0, 1, 2, 3, 4].map((row) => (
                      <div key={row} className="flex min-h-20 items-center justify-between gap-4 border-b border-border/60 px-3 py-4">
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))
                  : visible.map((symbol) => {
                      const stock = consensus.get(symbol);
                      return (
                        <Link
                          key={symbol}
                          href={`/dashboard/market/${encodeURIComponent(symbol)}`}
                          className={cn(STOCK_GRID, "min-h-20 items-center border-b border-border/60 px-3 py-4 transition-colors duration-150 hover:bg-muted/50 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary")}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span aria-hidden="true" className="shrink-0">
                              <CompanyLogo symbol={symbol} size="md" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-semibold">
                                {symbol}
                                {universe !== "holdings" && heldSet.has(symbol) && <HeldMark />}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">{quotes[symbol]?.name || stock?.company_name || "—"}</p>
                            </div>
                          </div>
                          <span className="hidden min-w-0 sm:block">
                            {stock ? (
                              <OpinionStrength value={stock.avg_score} className="text-[13px]" />
                            ) : (
                              <span className="text-[13px] text-muted-foreground/70">{c("No coverage", "暂无观点")}</span>
                            )}
                          </span>
                          <StockTrend symbol={symbol} period={trendRange.period} interval={trendRange.interval} rangeLabel={c(trendRange.en, trendRange.zh)} />
                          <span className="min-w-0 text-right">
                            {loading && !quotes[symbol] ? <Skeleton className="ml-auto h-5 w-16" /> : <span className="figure block text-[15px] font-medium">{money(quotes[symbol]?.price)}</span>}
                            <Change value={quotes[symbol]?.changePercent} className="mt-1 block text-xs font-semibold sm:hidden" />
                          </span>
                          {loading && !quotes[symbol] ? <Skeleton className="ml-auto hidden h-5 w-14 sm:block" /> : <Change value={quotes[symbol]?.changePercent} className="hidden text-right text-[15px] font-semibold sm:block" />}
                        </Link>
                      );
                    })}
                {sourceError && (
                  <Empty action={<Button size="sm" variant="outline" className="rounded-full" onClick={() => setAttempt((n) => n + 1)}>{c("Retry", "重试")}</Button>}>
                    {c("This list could not be loaded.", "暂时无法加载这个列表。")}
                  </Empty>
                )}
                {!visible.length && !sourceLoading && !sourceError && (
                  <Empty action={universe === "holdings" ? <TextLink href="/dashboard/portfolio">{c("Connect an account", "连接账户")}</TextLink> : undefined}>
                    {universe === "holdings"
                      ? c("Connect a brokerage account to see your stocks here.", "连接券商账户后，这里会显示你持有的股票。")
                      : c("No creator coverage yet.", "暂时没有博主覆盖的股票。")}
                  </Empty>
                )}
              </div>
            </Panel>
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
                        {shift.change == null ? (
                          <span className="shrink-0 text-right text-xs">
                            <span className="block text-muted-foreground">{c("New opinion", "新观点")}</span>
                            <OpinionStrength value={shift.current_score} className="text-xs" />
                          </span>
                        ) : (
                          <OpinionStrength value={shift.change} change className="text-xs" />
                        )}
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
  const tab = searchParams.get("tab") === "macro" ? "macro" : "overview";

  function selectTab(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "macro") params.set("tab", "macro");
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
              <TabsTrigger value="macro">{c("Macro indicators", "宏观指标")}</TabsTrigger>
            </TabsList>
            <TabsContent value="overview"><MarketOverview /></TabsContent>
            <TabsContent value="macro"><MacroIndicators /></TabsContent>
          </Tabs>
        </div>
      </main>
    </DashboardLayout>
  );
}
