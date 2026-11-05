"use client";

import { useCachedResource } from "@/hooks/useCachedResource";
import { useStockQuote } from "@/hooks/useStockData";
import { latestChartQuote } from "@/lib/chart/quote";
import { isProductFeatureEnabled } from "@/lib/productFeatures";

import { usePathname, useSearchParams } from "next/navigation";
import PageBreadcrumb from "@/components/layout/PageBreadcrumb";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PriceChart from "@/components/youtube/PriceChart";
import CompanyLogo from "@/components/ui/company-logo";
import { ResearchReportContent } from "@/components/trading-analysis/ResearchReportContent";
import AnalysisHistory from "./AnalysisHistory";
import { useStockResearch } from "./useStockResearch";
import CreatorIntelligence from "./CreatorIntelligence";
import StockNews from "./StockNews";
import dynamic from "next/dynamic";
import StockFundamentalOverview, {
  StockCompanyProfile,
} from "./StockFundamentalOverview";
import { finite, getStockOverview } from "@/lib/stockFundamentals";
import WatchlistButton from "./WatchlistButton";
import { ReportCard } from "@/components/trading-analysis/report-card";
import type { AiTechnicalAnalysis } from "@/lib/stockApi";
import {
  getYouTubeStockDetail,
  type YouTubeOpinion,
} from "@/lib/youtubeOpinionsApi";
import { getMyHoldings } from "@/lib/portfolioApi";
import {
  getPublishedAnalyses,
  publishedAnalysesKey,
} from "@/lib/tradingAnalysisApi";
import { creatorEvidence } from "@/lib/decision";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BENCHMARKS, indexValue } from "@/lib/marketBenchmarks";
import {
  DirectionBadge,
  Empty,
  HeldMark,
  Panel,
  TextLink,
  money,
  useCopy,
} from "./shared";
import { useDecisionCommand } from "./CommandLayer";
import SetupTradeLink from "@/components/paper-trading/SetupTradeLink";

const StockFinancialsTab = dynamic(() => import("./StockSecFinancials"));
const StockPeers = dynamic(() => import("./StockPeers"));
const StockOwnership = dynamic(() => import("./StockOwnership"));
const StockMulticharts = dynamic(() =>
  import("./StockFinancials").then((module) => module.StockMulticharts),
);
const StockEarnings = dynamic(() => import("./StockEarnings"));
const StockAnalyst = dynamic(() => import("./StockAnalyst"));
const StockValuation = dynamic(() => import("./StockValuation"));
const StockPaperTrading = dynamic(() => import("@/components/paper-trading/StockPaperTrading"));

type Side = "bullish" | "bearish" | "neutral";
const sideOf = (opinion: YouTubeOpinion): Side =>
  opinion.sentiment === "bullish"
    ? "bullish"
    : opinion.sentiment === "bearish"
      ? "bearish"
      : "neutral";

export default function StockWorkspace({
  ticker,
  returnHref = "/dashboard",
  initialInsight,
}: {
  ticker: string;
  returnHref?: string;
  initialInsight?: "creators";
}) {
  const c = useCopy();
  const { t, locale } = useTranslation();
  const benchmark = BENCHMARKS.find((item) => item.symbol === ticker);
  const priceLabel = (value: number | undefined) =>
    benchmark
      ? value === undefined || !Number.isFinite(value)
        ? "—"
        : indexValue(value)
      : !finite(value)
        ? "—"
        : new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
            style: "currency",
            currency,
          }).format(value);
  const { setContext } = useDecisionCommand();
  const quoteResource = useStockQuote(ticker);
  const opinionsResource = useCachedResource(
    `/api/youtube-opinions/stocks/${encodeURIComponent(ticker)}`,
    (signal) => getYouTubeStockDetail(ticker, {}, signal),
    { ttl: 60_000 },
  );
  const positionsResource = useCachedResource(
    "/api/portfolio/holdings",
    (signal) =>
      isProductFeatureEnabled("portfolio")
        ? getMyHoldings(signal)
        : Promise.resolve({
            accounts: [],
            is_connected: false,
            is_public: false,
          }),
    { ttl: 30_000, maxAge: 60_000 },
  );
  const publishedResource = useCachedResource(
    publishedAnalysesKey({ ticker, limit: 20 }),
    () => getPublishedAnalyses({ ticker, limit: 20 }),
    { ttl: 60_000 },
  );
  const overviewResource = useCachedResource(
    `/api/stocks?action=overview&symbol=${encodeURIComponent(ticker)}`,
    (signal) => getStockOverview(ticker, signal),
    { ttl: 300_000 },
  );
  const overview = overviewResource.data;
  const quote = quoteResource.data ?? null;
  const latestQuote = latestChartQuote(quote);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const sections = benchmark
    ? ["technical", "summary", "news", "creators", "research"]
    : [
        "technical",
        "paper-trading",
        "summary",
        "financials",
        "valuation",
        "earnings",
        "multicharts",
        "analyst",
        "peers",
        "ownership",
        "news",
        "creators",
        "research",
        "profile",
      ];
  const requestedTab = searchParams.get("tab") || "";
  const activeTab = sections.includes(requestedTab)
    ? requestedTab
    : requestedTab === "setup"
      ? "technical"
      : (initialInsight ?? "technical");
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([activeTab]));
  useEffect(() => {
    setVisitedTabs((previous) =>
      previous.has(activeTab) ? previous : new Set([...previous, activeTab]),
    );
  }, [activeTab]);
  const setActiveTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    window.history.replaceState(null, "", `${pathname}?${params}`);
  };
  const currency = /^[A-Z]{3}$/.test(overview?.quote.currency ?? "")
    ? overview!.quote.currency
    : "USD";
  const financialCurrency = overview?.financials.financial_currency || currency;
  const opinions = opinionsResource.data?.opinions ?? [];
  const positions = (positionsResource.data?.accounts ?? [])
    .flatMap((account) => account.portfolio_positions || [])
    .filter(
      (position) =>
        position.symbol === ticker && position.position_type !== "option",
    );
  const personalResearch = useStockResearch(ticker);
  const [generationRequest, setGenerationRequest] = useState(0);
  const [drawingRequest, setDrawingRequest] = useState(0);
  const [technicalBusy, setTechnicalBusy] = useState(true);
  const [technicalContainer, setTechnicalContainer] =
    useState<HTMLDivElement | null>(null);
  const [technical, setTechnical] = useState<AiTechnicalAnalysis | null>(null);
  const publishedResearch =
    publishedResource.data?.items.find((item) => item.status === "completed") ??
    null;
  const research =
    personalResearch.history.selected?.payload || publishedResearch;
  const loading = quoteResource.loading;
  const opinionsError = Boolean(opinionsResource.error);
  const positionsError = Boolean(positionsResource.error);
  const errors = [
    quoteResource.error && c("Market", "行情"),
    opinionsResource.error && c("Creators", "博主观点"),
    positionsResource.error && c("Portfolio", "持仓"),
    publishedResource.error && c("AI research", "AI 研究"),
  ].filter(Boolean) as string[];
  const refreshSources = () => {
    quoteResource.refresh();
    opinionsResource.refresh();
    positionsResource.refresh();
    publishedResource.refresh();
    overviewResource.refresh();
  };
  const onAnalysis = useCallback(
    (value: AiTechnicalAnalysis | null) => setTechnical(value),
    [],
  );
  const creators = creatorEvidence(opinions);
  const commandContext = JSON.stringify({
    ticker,
    quote,
    positions,
    technical,
    creatorEvidence: creators,
    opinions: opinions
      .slice(0, 8)
      .map(
        ({
          channel_title,
          opinion_date,
          sentiment,
          summary,
          thesis,
          risks,
        }) => ({
          channel_title,
          opinion_date,
          sentiment,
          summary,
          thesis,
          risks,
        }),
      ),
    deepResearch: research
      ? {
          date: research.trade_date,
          thesis: research.investment_plan?.slice(0, 4000),
          news: research.news_report?.slice(0, 4000),
          fundamentals: research.fundamentals_report?.slice(0, 4000),
        }
      : null,
    unavailableSources: errors,
  });
  useEffect(() => {
    setContext(commandContext);
    return () => setContext("");
  }, [commandContext, setContext]);
  const shares = positions.reduce((sum, p) => sum + p.units, 0);
  const positionValue = positions.reduce(
    (sum, p) => sum + (p.market_value ?? (p.price ?? 0) * p.units),
    0,
  );
  const positionPnl = positions.some((p) => typeof p.open_pnl === "number")
    ? positions.reduce((sum, p) => sum + (p.open_pnl ?? 0), 0)
    : null;
  const date = (value: string) =>
    new Date(value).toLocaleDateString(t("common.intlLocale"));
  const completedAt = research?.completed_at || research?.created_at;
  const researchLoading =
    publishedResource.loading || personalResearch.history.busy;

  useEffect(() => {
    document.title = `${ticker} · ${locale === "zh" ? "行情" : "Markets"} — Kolvex`;
  }, [ticker, locale, activeTab]);
  const up = (quote?.changePercent ?? 0) >= 0;
  const changeLabel = (value: number) =>
    benchmark
      ? `${value >= 0 ? "+" : "−"}${indexValue(Math.abs(value))}`
      : `${value >= 0 ? "+" : "−"}${priceLabel(Math.abs(value))}`;

  return (
    <DashboardLayout title={c("Markets", "行情")}>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[112.5rem] px-[16px] pb-16 pt-4 md:px-8 md:pt-6">
          <div className="min-w-0 space-y-6">
            <section className="min-w-0" aria-labelledby="stock-title">
              <PageBreadcrumb
                className="mb-6 min-w-0"
                items={[
                  {
                    label: returnHref.startsWith("/dashboard/watchlist")
                      ? c("Watchlist", "自选股")
                      : c("Markets", "行情"),
                    href: returnHref,
                  },
                  { label: ticker },
                ]}
              />
              <div className="flex items-start gap-3">
                <CompanyLogo symbol={ticker} size="md" />
                <div className="min-w-0 flex-1">
                  <h1
                    id="stock-title"
                    className="text-xl font-semibold leading-tight sm:text-2xl"
                  >
                    {benchmark
                      ? c(benchmark.en, benchmark.zh)
                      : overview?.company.name || quote?.name || ticker}
                    {positions.length > 0 && <HeldMark />}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {ticker}
                    {overview?.quote.exchange &&
                      ` · ${overview.quote.exchange}`}{" "}
                    · {currency}
                  </p>
                </div>
                <WatchlistButton ticker={ticker} showLabel />
              </div>
              <div
                className="mt-6 flex flex-wrap items-start gap-x-8 gap-y-4"
                aria-live="polite"
              >
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <div className="figure text-3xl font-semibold tracking-tight sm:text-4xl">
                      {loading && !quote ? (
                        <Skeleton className="h-10 w-40" />
                      ) : (
                        priceLabel(quote?.price)
                      )}
                    </div>
                    {quote && (
                      <span
                        className={cn(
                          "figure text-sm font-semibold",
                          up ? "text-positive" : "text-negative",
                        )}
                      >
                        {changeLabel(quote.change)} ({up ? "+" : "−"}
                        {Math.abs(quote.changePercent).toFixed(2)}%)
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {quote?.marketTime
                      ? new Date(
                          quote.marketTime * 1000,
                        ).toLocaleString(t("common.intlLocale"), {
                          timeZone: "America/New_York",
                          timeZoneName: "short",
                        })
                      : c("Latest available quote", "最新可用报价")}
                  </p>
                </div>
                {latestQuote && latestQuote.session !== "regular" && (
                    <div className="border-border sm:border-l sm:pl-6">
                      <p className="figure text-2xl font-semibold">
                        {priceLabel(latestQuote.price)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {latestQuote.session === "pre" ? c("Pre-market", "盘前") : c("After hours", "盘后")}
                        {" · "}{latestQuote.time && new Date(latestQuote.time * 1000).toLocaleTimeString(t("common.intlLocale"), { timeZone: "America/New_York", timeZoneName: "short" })}
                      </p>
                    </div>
                  )}
              </div>
              {!!errors.length && (
                <div
                  role="alert"
                  className="mt-3 flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground"
                >
                  <span>
                    {c(
                      "Some sources could not be loaded",
                      "部分数据源未能加载",
                    )}
                    ：{errors.join(c(", ", "、"))}。
                  </span>
                  <Button size="sm" variant="outline" onClick={refreshSources}>
                    {c("Retry", "重试")}
                  </Button>
                </div>
              )}
            </section>
            <Tabs
              key={`stock-${ticker}`}
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <TabsList
                variant="pill-solid"
                className="sticky top-4 z-30 mb-6 flex max-w-full flex-nowrap overflow-x-auto"
                aria-label={c("Stock sections", "个股研究导航")}
              >
                <TabsTrigger value="summary">
                  {c("Overview", "概览")}
                </TabsTrigger>
                <TabsTrigger value="technical">
                  {c("Technicals", "技术分析")}
                </TabsTrigger>
                {!benchmark && <TabsTrigger value="paper-trading">{c("My virtual trades", "我的虚拟交易")}</TabsTrigger>}
                <TabsTrigger value="creators">
                  {c("Creators", "博主情报")}
                </TabsTrigger>
                <TabsTrigger value="research">
                  {c("AI research", "AI 研究")}
                </TabsTrigger>
                <TabsTrigger value="news">{c("News", "新闻")}</TabsTrigger>
                {!benchmark && (
                  <>
                    <TabsTrigger value="financials">
                      {c("Financials", "财务报表")}
                    </TabsTrigger>
                    <TabsTrigger value="valuation">{c("Valuation", "估值")}</TabsTrigger>
                    <TabsTrigger value="earnings">
                      {c("Earnings", "盈利表现")}
                    </TabsTrigger>
                    <TabsTrigger value="multicharts">
                      {c("Metric trends", "指标趋势")}
                    </TabsTrigger>
                    <TabsTrigger value="analyst">
                      {c("Target price", "分析师目标价")}
                    </TabsTrigger>
                    <TabsTrigger value="peers">
                      {c("Peers", "同行比较")}
                    </TabsTrigger>
                    <TabsTrigger value="ownership">
                      {c("Ownership", "持仓披露")}
                    </TabsTrigger>
                  </>
                )}
                {!benchmark && (
                  <TabsTrigger value="profile">
                    {c("Profile", "公司资料")}
                  </TabsTrigger>
                )}
              </TabsList>
              <section
                hidden={!["summary", "technical", "paper-trading"].includes(activeTab)}
                className="mb-6 min-w-0 rounded-3xl border border-foreground/10 glass-card bg-card-glass p-4 sm:p-5"
                aria-label={c(
                  "Price trend",
                  "价格走势",
                )}
              >
                <div>
                  <PriceChart
                    key={ticker}
                    symbol={ticker}
                    layout="workspace"
                    resultsContainer={technicalContainer}
                    range="3M"
                    from=""
                    to=""
                    opinions={[]}
                    formatDate={date}
                    t={t}
                    onAnalysisChange={onAnalysis}
                    generationRequest={generationRequest}
                    drawingRequest={drawingRequest}
                    onAnalysisBusy={setTechnicalBusy}
                  />
                </div>
              </section>

              <section
                id="stock-insights"
                className="min-w-0 scroll-mt-16"
                aria-label={c("Stock insights", "个股洞察")}
              >
                {!benchmark && <TabsContent value="paper-trading" forceMount className="stock-tab-panel data-[state=inactive]:hidden">
                  {(activeTab === "paper-trading" || visitedTabs.has("paper-trading")) && <StockPaperTrading key={ticker} symbol={ticker} active={activeTab === "paper-trading"} />}
                </TabsContent>}
                {!benchmark && <TabsContent value="valuation" forceMount className="stock-tab-panel data-[state=inactive]:hidden">
                  {(activeTab === "valuation" || visitedTabs.has("valuation")) && <StockValuation key={ticker} symbol={ticker} />}
                </TabsContent>}
                <TabsContent
                  value="financials"
                  forceMount
                  className="stock-tab-panel data-[state=inactive]:hidden"
                >
                  {(activeTab === "financials" ||
                    visitedTabs.has("financials")) && (
                    <>
                      <StockFinancialsTab
                        symbol={ticker}
                        currency={financialCurrency}
                      />
                    </>
                  )}
                </TabsContent>
                <TabsContent
                  value="earnings"
                  forceMount
                  className="stock-tab-panel data-[state=inactive]:hidden"
                >
                  {(activeTab === "earnings" ||
                    visitedTabs.has("earnings")) && (
                    <>
                      <StockEarnings symbol={ticker} currency={currency} />
                    </>
                  )}
                </TabsContent>
                <TabsContent
                  value="multicharts"
                  forceMount
                  className="stock-tab-panel data-[state=inactive]:hidden"
                >
                  {(activeTab === "multicharts" ||
                    visitedTabs.has("multicharts")) && (
                    <>
                      <StockMulticharts
                        symbol={ticker}
                        currency={financialCurrency}
                      />
                    </>
                  )}
                </TabsContent>
                <TabsContent
                  value="analyst"
                  forceMount
                  className="stock-tab-panel data-[state=inactive]:hidden"
                >
                  {(activeTab === "analyst" || visitedTabs.has("analyst")) && (
                    <>
                      <StockAnalyst symbol={ticker} currency={currency} />
                    </>
                  )}
                </TabsContent>
                <TabsContent
                  value="peers"
                  forceMount
                  className="stock-tab-panel data-[state=inactive]:hidden"
                >
                  {(activeTab === "peers" || visitedTabs.has("peers")) && (
                    <StockPeers symbol={ticker} />
                  )}
                </TabsContent>
                <TabsContent
                  value="ownership"
                  forceMount
                  className="stock-tab-panel data-[state=inactive]:hidden"
                >
                  {(activeTab === "ownership" ||
                    visitedTabs.has("ownership")) && (
                    <StockOwnership
                      symbol={ticker}
                      companyName={overview?.company.name}
                    />
                  )}
                </TabsContent>
                <TabsContent
                  value="profile"
                  forceMount
                  className="stock-tab-panel data-[state=inactive]:hidden"
                >
                  {(activeTab === "profile" || visitedTabs.has("profile")) && (
                    <>
                      <StockCompanyProfile
                        overview={overview}
                        loading={overviewResource.loading}
                        error={Boolean(overviewResource.error)}
                        retry={overviewResource.refresh}
                      />
                    </>
                  )}
                </TabsContent>
                <TabsContent
                  value="summary"
                  forceMount
                  className="stock-tab-panel space-y-6 data-[state=inactive]:hidden"
                >
                  {!benchmark && (
                    <StockFundamentalOverview
                      symbol={ticker}
                      overview={overview}
                      quote={quote}
                      loading={overviewResource.loading}
                      error={Boolean(overviewResource.error)}
                      retry={overviewResource.refresh}
                    />
                  )}
                </TabsContent>
                <TabsContent
                  value="technical"
                  forceMount
                  className="stock-tab-panel space-y-6 pt-2 data-[state=inactive]:hidden"
                >
                  <Card className="min-w-0 p-4 sm:p-5">
                    <div
                      ref={setTechnicalContainer}
                      className="flex min-w-0 flex-col"
                    />
                  </Card>
                  {technicalBusy && !technical ? (
                    <Card className="min-w-0 p-4 sm:p-5">
                      <div role="status" className="space-y-4">
                        <span className="sr-only">
                          {c(
                            "Loading technical analysis…",
                            "正在加载技术分析…",
                          )}
                        </span>
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    </Card>
                  ) : technical?.setup ? (
                    <Card
                      className="min-w-0 p-4 sm:p-5"
                      role="region"
                      aria-labelledby="stock-setup-title"
                    >
                      <div>
                        <h3
                          id="stock-setup-title"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          {c("Setup plan", "条件计划")}
                        </h3>
                        <p className="mt-2 font-semibold">
                          {technical.setup.name}
                        </p>
                        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                          {technical.setup.reason}
                        </p>
                        {!benchmark && <SetupTradeLink symbol={ticker} setup={technical.setup} />}
                        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                          {[
                            [
                              c("Entry", "入场"),
                              `${money(technical.setup.entry_low)} – ${money(technical.setup.entry_high)}`,
                            ],
                            [
                              c("Invalidation", "失效价"),
                              money(technical.setup.invalidation),
                            ],
                            [
                              c("Targets", "目标"),
                              technical.setup.targets.map(money).join(" / "),
                            ],
                            [
                              c("Risk / reward", "风险收益比"),
                              `1 : ${technical.setup.risk_reward}`,
                            ],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <dt className="text-xs text-muted-foreground">
                                {label}
                              </dt>
                              <dd className="figure mt-1 font-medium">
                                {value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <p className="mt-4 text-sm font-medium">
                          {c("Setup alignment", "计划证据一致性")}：
                          {technical.setup.score === null
                            ? c("Incomplete evidence", "证据不完整")
                            : `${technical.setup.score}/100`}
                        </p>
                        <details className="mt-2 text-xs text-muted-foreground">
                          <summary className="cursor-pointer">
                            {c("How the score works", "评分如何计算")}
                          </summary>
                          <p className="mt-2 leading-5">
                            {c(
                              "Five equal checks (20 points each): trend alignment, price vs EMA20, EMA20 vs EMA50, RSI momentum, volume confirmation. Evidence alignment, not a probability of returns.",
                              "5 项等权检查，每项20分：趋势一致性、价格与 EMA20、EMA20 与 EMA50、RSI 动量、成交量确认。代表证据一致性，不代表收益概率。",
                            )}
                          </p>
                          <ul className="mt-2 space-y-1">
                            {Object.entries(technical.setup.checks).map(
                              ([name, passed]) => (
                                <li key={name}>
                                  {passed === null ? "—" : passed ? "✓" : "△"}{" "}
                                  {name.replaceAll("_", " ")}
                                </li>
                              ),
                            )}
                          </ul>
                        </details>
                      </div>
                    </Card>
                  ) : technical ? (
                    <Card className="min-w-0 p-4 sm:p-5">
                      <h3 className="text-xs font-medium text-muted-foreground">
                        {c("Setup plan", "条件计划")}
                      </h3>
                      <Empty
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={technicalBusy}
                            onClick={() =>
                              setGenerationRequest((value) => value + 1)
                            }
                          >
                            {technicalBusy
                              ? c("Analyzing…", "正在分析…")
                              : c("Generate analysis", "生成分析")}
                          </Button>
                        }
                      >
                        {c(
                          "Generate technical analysis to see entry conditions, invalidation and targets when a setup is available.",
                          "生成技术分析后，若有适用的条件计划，将在这里显示入场条件、失效价与目标。",
                        )}
                      </Empty>
                    </Card>
                  ) : null}
                </TabsContent>
                <TabsContent
                  value="news"
                  forceMount
                  className="stock-tab-panel min-w-0 pt-2 data-[state=inactive]:hidden [&>section>header]:border-0 [&>section>header>div>h2]:sr-only"
                >
                  <StockNews key={ticker} ticker={ticker} />
                </TabsContent>
                <TabsContent
                  value="creators"
                  forceMount
                  className="stock-tab-panel min-w-0 pt-2 data-[state=inactive]:hidden [&>section>header]:border-0 [&>section>header>div>h2]:sr-only"
                >
                  <CreatorIntelligence
                    key={ticker}
                    ticker={ticker}
                    opinions={opinions}
                    loading={opinionsResource.loading}
                    error={opinionsError}
                    onRetry={refreshSources}
                  />
                </TabsContent>
                <TabsContent
                  value="research"
                  forceMount
                  className="stock-tab-panel min-w-0 pt-2 data-[state=inactive]:hidden [&>section>header]:border-0 [&>section>header>div>h2]:sr-only"
                >
                  <Panel
                    title={c("AI research", "AI 研究")}
                    description={
                      research && completedAt
                        ? `${c("Last completed", "最近完成")}：${date(completedAt)}`
                        : undefined
                    }
                  >
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={personalResearch.busy || researchLoading}
                        onClick={() => void personalResearch.generate()}
                      >
                        {personalResearch.busy
                          ? c("Generating research…", "正在生成研究…")
                          : research
                            ? c("Update AI research", "更新 AI 研究")
                            : c("Generate AI research", "生成 AI 研究")}
                      </Button>
                      {personalResearch.busy && (
                        <p
                          role="status"
                          className="mt-2 text-sm text-muted-foreground"
                        >
                          {c(
                            "Research is running. You can leave this page and return later.",
                            "研究正在进行，可以离开页面，稍后返回查看结果。",
                          )}
                        </p>
                      )}
                      {(personalResearch.error ||
                        personalResearch.job?.status === "failed") && (
                        <p role="alert" className="mt-2 text-sm text-negative">
                          {c(
                            "Research could not be generated or its status loaded. Retry; your previous analysis is preserved.",
                            "研究生成或状态加载失败，请重试。之前的分析已保留。",
                          )}
                        </p>
                      )}
                    </div>
                    <AnalysisHistory history={personalResearch.history} />
                    {research ? (
                      <div className="pt-5">
                        <ReportCard
                          key={`${research.id}-thesis`}
                          title={c(
                            "Investment thesis and what could change it",
                            "投资判断与可能改变判断的因素",
                          )}
                          content={
                            research.investment_plan ||
                            research.trader_plan ||
                            research.market_report
                          }
                          locale={locale}
                          t={t}
                          bordered={false}
                        />
                        <details className="mt-5 border-t border-border pt-4">
                          <summary className="cursor-pointer text-sm font-semibold">
                            {c(
                              "Why Kolvex sees it this way",
                              "为什么得出这样的判断",
                            )}
                          </summary>
                          <div className="mt-6 space-y-8">
                            {[
                              {
                                label: c("Technical", "技术面"),
                                report: research.market_report,
                                key: "market",
                              },
                              {
                                label: c("Fundamental", "基本面"),
                                report: research.fundamentals_report,
                                key: "fundamentals",
                              },
                              {
                                label: c("News", "新闻"),
                                report: research.news_report,
                                key: "news",
                              },
                              {
                                label: c("Social context", "社交环境"),
                                report: research.sentiment_report,
                                key: "sentiment",
                              },
                            ].map(({ label, report, key }) => (
                              <ReportCard
                                key={`${research.id}-${key}`}
                                title={label}
                                content={report}
                                locale={locale}
                                t={t}
                              />
                            ))}
                          </div>
                        </details>
                        <details className="mt-4 border-t border-border pt-4">
                          <summary className="cursor-pointer text-sm">
                            {c(
                              "See how AI reached this conclusion",
                              "查看 AI 的推理过程",
                            )}
                          </summary>
                          <div className="mt-6 space-y-8">
                            <ReportCard
                              key={`${research.id}-bull`}
                              title={t("tradingAnalysis.debate.bullResearcher")}
                              content={research.investment_debate?.bull_history}
                              locale={locale}
                              t={t}
                            />
                            <ReportCard
                              key={`${research.id}-bear`}
                              title={t("tradingAnalysis.debate.bearResearcher")}
                              content={research.investment_debate?.bear_history}
                              locale={locale}
                              t={t}
                            />
                          </div>
                          {!personalResearch.history.selected && (
                            <TextLink
                              className="mt-4 inline-block"
                              href={`/dashboard/trading-analysis/explore/${research.id}`}
                            >
                              {c("Full research report", "完整研究报告")}
                            </TextLink>
                          )}
                        </details>
                        {personalResearch.history.selected && (
                          <details className="mt-4 border-t border-border pt-4">
                            <summary className="cursor-pointer text-sm font-semibold">
                              {c(
                                "Full saved research report",
                                "完整历史研究报告",
                              )}
                            </summary>
                            <div className="mt-5">
                              <ResearchReportContent
                                key={research.id}
                                analysis={research}
                                locale={locale}
                                t={t}
                              />
                            </div>
                          </details>
                        )}
                      </div>
                    ) : researchLoading ? (
                      <div role="status" className="space-y-4 py-4">
                        <span className="sr-only">
                          {c("Loading AI research…", "正在加载 AI 研究…")}
                        </span>
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : (
                      <Empty>
                        {c(
                          "No AI research for this stock yet. Generate one to assess fundamentals and news.",
                          "这只股票暂无 AI 研究，点击生成以分析基本面和新闻。",
                        )}
                      </Empty>
                    )}
                  </Panel>
                </TabsContent>
              </section>
            </Tabs>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
