"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanyLogo from "@/components/ui/company-logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import OpinionStrength from "@/components/youtube/OpinionStrength";
import { getStockHistory, type StockQuote } from "@/lib/stockApi";
import { cn } from "@/lib/utils";
import {
  Change,
  Empty,
  HeldMark,
  Panel,
  TextLink,
  money,
  signedMoney,
  useCopy,
  useCreatorCatalogue,
  useDayLabel,
  useHeldTickers,
} from "./shared";
import ScrubChart, { type ScrubPoint } from "./ScrubChart";
import { useDecisionCommand } from "./CommandLayer";

const DEFAULT_STOCKS = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AVGO"];
const BENCHMARKS = [
  { symbol: "SPY", en: "S&P 500", zh: "标普 500" },
  { symbol: "QQQ", en: "Nasdaq 100", zh: "纳指 100" },
  { symbol: "DIA", en: "Dow Jones", zh: "道琼斯" },
] as const;
const RANGES = [
  { key: "1D", period: "1d", interval: "5m", en: "1D", zh: "1天" },
  { key: "1W", period: "5d", interval: "30m", en: "1W", zh: "1周" },
  { key: "1M", period: "1mo", interval: "1d", en: "1M", zh: "1月" },
  { key: "3M", period: "3mo", interval: "1d", en: "3M", zh: "3月" },
] as const;
type Universe = "featured" | "holdings" | "creators";
type Sort = "move" | "gainers" | "losers" | "default";
type RangeKey = (typeof RANGES)[number]["key"];

const pill = (active: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
    active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted hover:text-foreground",
  );

export default function Market() {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const { setContext } = useDecisionCommand();
  const [attempt, setAttempt] = useState(0);
  const [benchmark, setBenchmark] = useState<(typeof BENCHMARKS)[number]["symbol"]>("SPY");
  const [range, setRange] = useState<RangeKey>("1D");
  const [series, setSeries] = useState<ScrubPoint[]>([]);
  const [seriesState, setSeriesState] = useState<"loading" | "ready" | "error">("loading");
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);
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

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    async function load() {
      const requested = [...new Set([...BENCHMARKS.map((item) => item.symbol), ...symbolsKey.split(",").filter(Boolean)])];
      const result: Record<string, StockQuote> = {};
      let unavailable = false;
      // Bound each request so large portfolios do not create an unbounded batch.
      for (let offset = 0; offset < requested.length; offset += 20) {
        const batch = requested.slice(offset, offset + 20);
        try {
          const response = await fetch(`/api/stocks?action=multiple&symbols=${encodeURIComponent(batch.join(","))}`, { signal: controller.signal });
          const data: unknown = await response.json();
          if (!response.ok || !Array.isArray(data)) throw new Error("Quotes unavailable");
          for (const quote of data as StockQuote[]) {
            if (batch.includes(quote.symbol) && Number.isFinite(quote.price) && quote.price > 0) result[quote.symbol] = quote;
          }
          if (batch.some((symbol) => !result[symbol])) unavailable = true;
        } catch {
          if (controller.signal.aborted) return;
          unavailable = true;
        }
      }
      if (!controller.signal.aborted) {
        setQuotes(result);
        setFailed(unavailable);
        setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [symbolsKey, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    const spec = RANGES.find((item) => item.key === range)!;
    setSeriesState("loading");
    setScrub(null);
    getStockHistory(benchmark, { period: spec.period, interval: spec.interval }, controller.signal)
      .then((bars) => {
        let points = bars.map((bar) => ({ date: bar.date, value: bar.close }));
        if (range === "1D" && points.length) {
          const lastDay = points[points.length - 1].date.slice(0, 10);
          points = points.filter((point) => point.date.slice(0, 10) === lastDay);
        }
        setSeries(points);
        setSeriesState(points.length ? "ready" : "error");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSeries([]);
          setSeriesState("error");
        }
      });
    return () => controller.abort();
  }, [benchmark, range, attempt]);

  const context = JSON.stringify({ workspace: "Markets", benchmark, range, universe, quotes, quotesUnavailable: failed });
  useEffect(() => {
    setContext(context);
    return () => setContext("");
  }, [context, setContext]);

  const quote = quotes[benchmark];
  const baseline =
    range === "1D" ? quote?.previousClose ?? (quote ? quote.price - quote.change : null) : series[0]?.value ?? null;
  const headlineValue = scrub?.value ?? quote?.price ?? series[series.length - 1]?.value ?? null;
  const headlineChange =
    headlineValue !== null && baseline
      ? { amount: headlineValue - baseline, percent: ((headlineValue - baseline) / baseline) * 100 }
      : null;
  const formatPoint = (value: string) => {
    const date = new Date(value);
    return range === "1D" || range === "1W"
      ? date.toLocaleString([], { month: range === "1W" ? "short" : undefined, day: range === "1W" ? "numeric" : undefined, hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString([], { month: "short", day: "numeric" });
  };
  const rangeCaption = { "1D": c("Today", "今天"), "1W": c("Past week", "过去一周"), "1M": c("Past month", "过去一个月"), "3M": c("Past 3 months", "过去三个月") }[range];
  const up = (headlineChange?.amount ?? 0) >= 0;
  const benchmarkName = BENCHMARKS.find((item) => item.symbol === benchmark)!;

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
    <DashboardLayout title={c("Markets", "行情")}>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto grid gap-x-12 gap-y-10 px-4 pb-16 pt-6 md:px-8 md:pt-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-10">
            <section aria-label={c("Market benchmark", "大盘参考")}>
              <div role="radiogroup" aria-label={c("Benchmark ETF", "参考 ETF")} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-hide">
                {BENCHMARKS.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    role="radio"
                    aria-checked={benchmark === item.symbol}
                    onClick={() => setBenchmark(item.symbol)}
                    className={pill(benchmark === item.symbol)}
                  >
                    {c(item.en, item.zh)}
                    <Change
                      value={quotes[item.symbol]?.changePercent}
                      className={cn("text-xs", benchmark === item.symbol && "text-primary-foreground/80")}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-5" aria-live="polite">
                <h1 className="sr-only">
                  {c("Markets", "行情")}: {benchmark}
                </h1>
                <p className="text-[13px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{benchmark}</span>{" "}
                  {c(`${benchmarkName.en} ETF`, `${benchmarkName.zh} ETF`)}
                </p>
                <div className="figure mt-1 text-[34px] font-semibold leading-tight tracking-[-0.02em] sm:text-[40px]">
                  {headlineValue === null ? <Skeleton className="h-10 w-44" /> : money(headlineValue)}
                </div>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
                  {headlineChange ? (
                    <span className={cn("figure font-semibold", up ? "text-positive" : "text-negative")}>
                      {signedMoney(headlineChange.amount)} ({headlineChange.percent >= 0 ? "+" : "−"}
                      {Math.abs(headlineChange.percent).toFixed(2)}%)
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  <span className="text-muted-foreground">{scrub ? formatPoint(scrub.date) : rangeCaption}</span>
                </p>
              </div>
              <div className="relative mt-4">
                {seriesState === "loading" && !series.length ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : seriesState === "error" ? (
                  <div role="status" className="flex h-[220px] flex-col items-center justify-center gap-3 border-y border-dashed border-border text-sm text-muted-foreground">
                    {c("Price history is unavailable right now.", "暂时无法加载价格走势。")}
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAttempt((n) => n + 1)}>
                      {c("Retry", "重试")}
                    </Button>
                  </div>
                ) : (
                  <ScrubChart
                    data={series}
                    baseline={baseline}
                    positive={up}
                    onScrub={setScrub}
                    label={c(`${benchmark} price, ${rangeCaption}`, `${benchmark} 价格走势，${rangeCaption}`)}
                  />
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-b border-border pb-4">
                <div role="radiogroup" aria-label={c("Chart range", "走势区间")} className="flex gap-1">
                  {RANGES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="radio"
                      aria-checked={range === item.key}
                      onClick={() => setRange(item.key)}
                      className={pill(range === item.key)}
                    >
                      {c(item.en, item.zh)}
                    </button>
                  ))}
                </div>
                <p className="hidden text-right text-xs text-muted-foreground sm:block">
                  {c("Quotes may be delayed", "报价可能延迟")}
                  {checkedAt && c(`, checked ${checkedAt}`, `，${checkedAt} 查询`)}
                </p>
              </div>
            </section>

            <Panel
              title={c("Biggest moves today", "今天动得最大的")}
              description={c(
                "Ranked within the list you pick, not the whole market.",
                "只在你选的列表内排序，不是全市场排行。",
              )}
              action={
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <span className="sr-only">{c("Sort stocks", "股票排序")}</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as Sort)}
                    className="h-8 rounded-full bg-muted px-3 text-[13px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="move">{c("Biggest move", "变动最大")}</option>
                    <option value="gainers">{c("Top gainers", "涨幅最大")}</option>
                    <option value="losers">{c("Top losers", "跌幅最大")}</option>
                    <option value="default">{c("List order", "列表顺序")}</option>
                  </select>
                </label>
              }
            >
              <div role="radiogroup" aria-label={c("Stock list", "股票列表")} className="-mx-1 flex gap-1 overflow-x-auto px-1 py-3 scrollbar-hide">
                {universeOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="radio"
                    aria-checked={universe === item.key}
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
                <p role="status" className="pb-2 text-[13px] text-muted-foreground">
                  {c("Some quotes are unavailable.", "部分报价暂不可用。")}
                </p>
              )}
              <div aria-busy={loading || sourceLoading}>
                <div className="grid grid-cols-[minmax(0,1fr)_88px_72px] gap-3 border-b border-border pb-2 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_140px_104px_80px]">
                  <span>{c("Stock", "股票")}</span>
                  <span className="hidden sm:block">{c("Creators", "博主共识")}</span>
                  <span className="text-right">{c("Price", "价格")}</span>
                  <span className="text-right">{c("Today", "今日")}</span>
                </div>
                {(loading || sourceLoading) && !visible.length
                  ? [0, 1, 2, 3, 4].map((row) => (
                      <div key={row} className="flex items-center justify-between border-b border-border py-4">
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))
                  : visible.map((symbol) => {
                      const stock = consensus.get(symbol);
                      return (
                        <Link
                          key={symbol}
                          href={`/dashboard/research/${encodeURIComponent(symbol)}`}
                          className="-mx-3 grid grid-cols-[minmax(0,1fr)_88px_72px] items-center gap-3 rounded-xl px-3 py-3.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:grid-cols-[minmax(0,1fr)_140px_104px_80px]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span aria-hidden="true">
                              <CompanyLogo symbol={symbol} size="md" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[15px] font-semibold">
                                {symbol}
                                {universe !== "holdings" && heldSet.has(symbol) && <HeldMark />}
                              </p>
                              <p className="truncate text-[13px] text-muted-foreground">{quotes[symbol]?.name || stock?.company_name || "—"}</p>
                            </div>
                          </div>
                          <span className="hidden min-w-0 sm:block">
                            {stock ? (
                              <OpinionStrength value={stock.avg_score} className="text-[13px]" />
                            ) : (
                              <span className="text-[13px] text-muted-foreground/70">{c("No coverage", "暂无观点")}</span>
                            )}
                          </span>
                          <span className="figure text-right text-[15px] font-medium">{money(quotes[symbol]?.price)}</span>
                          <Change value={quotes[symbol]?.changePercent} className="text-right text-[15px] font-semibold" />
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

          <aside className="min-w-0 space-y-10 xl:sticky xl:top-8 xl:self-start">
            <TextLink href="/dashboard/youtube-opinions?tab=stocks">{c("Browse all stocks", "浏览全部股票")}</TextLink>
            <Panel
              title={c("Creator updates", "博主新动态")}
              action={<TextLink href="/dashboard/research">{c("Research", "研究")}</TextLink>}
            >
              {catalogue.loading && !catalogue.data ? (
                <div className="space-y-3 py-3">
                  {[0, 1, 2].map((row) => <Skeleton key={row} className="h-9 w-full" />)}
                </div>
              ) : shifts.length ? (
                <ul className="divide-y divide-border">
                  {shifts.map((shift) => (
                    <li key={shift.ticker}>
                      <Link
                        href={`/dashboard/research/${encodeURIComponent(shift.ticker)}`}
                        className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span aria-hidden><CompanyLogo symbol={shift.ticker} size="sm" /></span>
                          <span className="min-w-0">
                            <span className="block font-semibold">
                              {shift.ticker}
                              {heldSet.has(shift.ticker) && <HeldMark />}
                            </span>
                            <span className="block text-xs text-muted-foreground">{dayLabel(shift.current_date)}</span>
                          </span>
                        </span>
                        {shift.change == null ? (
                          <span className="text-right text-xs">
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
            </Panel>
          </aside>
        </div>
      </main>
    </DashboardLayout>
  );
}
