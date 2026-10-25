"use client";

import { isProductFeatureEnabled } from "@/lib/productFeatures";

import Link from "next/link";
import AnalysisSummary from "@/components/youtube/chart/AnalysisSummary";
import TechnicalFindings from "@/components/youtube/chart/TechnicalFindings";
import HeaderBackButton from "@/components/layout/HeaderBackButton";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { ReportCard } from "@/components/trading-analysis/report-card";
import {
  getStockQuote,
  type StockQuote,
  type AiTechnicalAnalysis,
} from "@/lib/stockApi";
import {
  getYouTubeStockDetail,
  type YouTubeOpinion,
} from "@/lib/youtubeOpinionsApi";
import { getMyHoldings } from "@/lib/portfolioApi";
import {
  getPublishedAnalyses,
  type TradingAnalysis,
} from "@/lib/tradingAnalysisApi";
import type { PortfolioPosition } from "@/lib/supabase/database.types";
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
  signedMoney,
  useCopy,
} from "./shared";
import { useDecisionCommand } from "./CommandLayer";

type Side = "bullish" | "bearish" | "neutral";
const sideOf = (opinion: YouTubeOpinion): Side =>
  opinion.sentiment === "bullish"
    ? "bullish"
    : opinion.sentiment === "bearish"
      ? "bearish"
      : "neutral";

export default function StockWorkspace({ ticker }: { ticker: string }) {
  const c = useCopy();
  const benchmark = BENCHMARKS.find((item) => item.symbol === ticker);
  const priceLabel = (value: number | undefined) =>
    benchmark
      ? value === undefined || !Number.isFinite(value)
        ? "—"
        : indexValue(value)
      : money(value);
  const changeLabel = (value: number) =>
    benchmark
      ? `${value >= 0 ? "+" : "−"}${indexValue(Math.abs(value))}`
      : signedMoney(value);
  const { t, locale } = useTranslation();
  const { setContext } = useDecisionCommand();
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [opinions, setOpinions] = useState<YouTubeOpinion[]>([]);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const personalResearch = useStockResearch(ticker);
  const [generationRequest, setGenerationRequest] = useState(0);
  const [drawingRequest, setDrawingRequest] = useState(0);
  const [technicalBusy, setTechnicalBusy] = useState(false);
  const [publishedResearch, setResearch] = useState<TradingAnalysis | null>(
    null,
  );
  const [opinionsError, setOpinionsError] = useState(false);
  const [positionsError, setPositionsError] = useState(false);
  const [technical, setTechnical] = useState<AiTechnicalAnalysis | null>(null);
  const research =
    personalResearch.history.selected?.payload || publishedResearch;
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErrors([]);
    setOpinionsError(false);
    setPositionsError(false);
    Promise.allSettled([
      getStockQuote(ticker),
      getYouTubeStockDetail(ticker),
      isProductFeatureEnabled("portfolio")
        ? getMyHoldings()
        : Promise.resolve({ accounts: [] }),
      getPublishedAnalyses({ ticker, limit: 20 }),
    ]).then((results) => {
      if (!alive) return;
      const [q, o, p, r] = results;
      setQuote(q.status === "fulfilled" && q.value.price > 0 ? q.value : null);
      setOpinions(o.status === "fulfilled" ? o.value.opinions : []);
      setOpinionsError(o.status === "rejected");
      setPositions(
        p.status === "fulfilled"
          ? p.value.accounts
              .flatMap((a) => a.portfolio_positions || [])
              .filter(
                (p) => p.symbol === ticker && p.position_type !== "option",
              )
          : [],
      );
      setResearch(
        r.status === "fulfilled"
          ? (r.value.items.find((x) => x.status === "completed") ?? null)
          : null,
      );
      setPositionsError(p.status === "rejected");
      setErrors(
        results.flatMap((result, index) =>
          result.status === "rejected"
            ? [
                [
                  c("Market", "行情"),
                  c("Creators", "博主观点"),
                  c("Portfolio", "持仓"),
                  c("AI research", "AI 研究"),
                ][index],
              ]
            : [],
        ),
      );
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, refresh]);
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

  useEffect(() => {
    document.title = `${ticker} · ${locale === "zh" ? "行情" : "Markets"} — Kolvex`;
  }, [ticker, locale]);
  const sorted = [...opinions].sort((a, b) =>
    b.opinion_date.localeCompare(a.opinion_date),
  );
  const up = (quote?.changePercent ?? 0) >= 0;

  const evidenceItems = [
    {
      action: !technical ? "technical" : null,
      label: c("Technical", "技术面"),
      direction: technical?.bias,
      detail: technical
        ? [technical.interval, date(technical.generated_at)].join(c(", ", "，"))
        : c("Run AI analysis on the chart", "在图表上运行 AI 分析"),
    },
    {
      action: !creators.count ? "creators" : null,
      label: c("Creators", "博主"),
      direction: creators.direction,
      detail: creators.count
        ? c(
            `${creators.count} creators, last 30 days`,
            `${creators.count} 位博主，近 30 天`,
          )
        : c("No calls in 30 days", "近 30 天无观点"),
    },
    {
      action: !research?.fundamentals_report ? "research" : null,
      label: c("Fundamental", "基本面"),
      direction: null,
      detail: research?.fundamentals_report
        ? c("In the AI research tab", "见 AI 研究标签")
        : c("Needs AI research", "需要 AI 研究"),
    },
    {
      action: !research?.news_report ? "research" : null,
      label: c("News", "新闻"),
      direction: null,
      detail: research?.news_report
        ? c("In the AI research tab", "见 AI 研究标签")
        : c("Needs AI research", "需要 AI 研究"),
    },
  ];

  return (
    <DashboardLayout title={c("Markets", "行情")}>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1800px] px-4 pb-16 pt-4 md:px-8 md:pt-6">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
            <section
              className="min-w-0 xl:col-span-2"
              aria-labelledby="stock-title"
            >
              <div className="flex items-center gap-3">
                <HeaderBackButton
                  href="/dashboard"
                  label={c("Back to Markets", "返回行情")}
                />
                <CompanyLogo symbol={ticker} size="md" />
                <div className="min-w-0">
                  <h1
                    id="stock-title"
                    className="text-lg font-semibold leading-tight"
                  >
                    {ticker}
                    {positions.length > 0 && <HeldMark />}
                  </h1>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {benchmark
                      ? c(benchmark.en, benchmark.zh)
                      : quote?.name ||
                        (loading ? "" : c("Stock workspace", "股票工作台"))}
                  </p>
                </div>
              </div>
              <div className="mt-4" aria-live="polite">
                <div className="figure text-[34px] font-semibold leading-tight tracking-[-0.02em] sm:text-[40px]">
                  {loading && !quote ? (
                    <Skeleton className="h-10 w-40" />
                  ) : (
                    priceLabel(quote?.price)
                  )}
                </div>
                {quote && (
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span
                      className={cn(
                        "figure font-semibold",
                        up ? "text-positive" : "text-negative",
                      )}
                    >
                      {changeLabel(quote.change)} ({up ? "+" : "−"}
                      {Math.abs(quote.changePercent).toFixed(2)}%)
                    </span>
                    <span className="text-muted-foreground">
                      {c("Today", "今天")}
                    </span>
                  </p>
                )}
              </div>
              {!!errors.length && (
                <div
                  role="alert"
                  className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground"
                >
                  <span>
                    {c(
                      "Some sources could not be loaded",
                      "部分数据源未能加载",
                    )}
                    ：{errors.join(c(", ", "、"))}。
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRefresh((value) => value + 1)}
                  >
                    {c("Retry", "重试")}
                  </Button>
                </div>
              )}
            </section>
            <section className="min-w-0" aria-label={c("Price chart and AI drawings", "K 线图与 AI 画线")}>
              <div>
                <PriceChart
                  key={ticker}
                  symbol={ticker}
                  layout="workspace"
                  range="3m"
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

            <aside className="min-w-0 rounded-xl border border-border bg-card p-4" aria-label={c("Analysis beside the chart", "图表分析")}>
              <Tabs key={`analysis-${ticker}`} defaultValue="summary">
                <TabsList className="grid grid-cols-3 gap-2 overflow-visible" aria-label={c("Stock analysis", "个股分析")}>
                  <TabsTrigger value="summary">{c("Summary", "变化摘要")}</TabsTrigger>
                  <TabsTrigger value="technical">{c("Technicals", "技术分析")}</TabsTrigger>
                  <TabsTrigger value="setup">{c("Setup", "条件计划")}</TabsTrigger>
                </TabsList>
                <TabsContent value="summary" forceMount className="pt-5 data-[state=inactive]:hidden">
              <Panel>
                <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {c("Market today", "今日行情")}
                    </p>
                    <p className="figure mt-1 text-sm font-semibold">
                      {quote
                        ? `${changeLabel(quote.change)} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {c("Latest creator call", "最新博主观点")}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {sorted[0]
                        ? `${sorted[0].channel_title || sorted[0].channel_id} · ${date(sorted[0].opinion_date)}`
                        : c("No coverage yet", "暂无观点")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {c("Latest AI research", "最近 AI 研究")}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {completedAt
                        ? date(completedAt)
                        : c("No published report", "暂无已发布报告")}
                    </p>
                    {!research && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={personalResearch.busy}
                        onClick={() => void personalResearch.generate()}
                      >
                        {personalResearch.busy
                          ? c("Generating…", "正在生成…")
                          : c("Generate AI research", "生成 AI 研究")}
                      </Button>
                    )}
                  </div>
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-5 sm:grid-cols-4 xl:grid-cols-2">
                  {evidenceItems.map((item) => (
                    <div key={item.label} className="min-w-0">
                      <dt className="text-[13px] text-muted-foreground">
                        {item.label}
                      </dt>
                      <dd className="mt-1">
                        <DirectionBadge direction={item.direction} />
                      </dd>
                      <dd className="mt-1 text-xs leading-5 text-muted-foreground">
                        {item.detail}
                      </dd>
                      {item.action === "creators" ? (
                        <dd className="mt-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href="/dashboard/youtube-opinions">
                              {c("Browse creators", "查看博主观点")}
                            </Link>
                          </Button>
                        </dd>
                      ) : (
                        item.action && (
                          <dd className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                item.action === "technical"
                                  ? technicalBusy
                                  : personalResearch.busy
                              }
                              onClick={() =>
                                item.action === "technical"
                                  ? setGenerationRequest((value) => value + 1)
                                  : void personalResearch.generate()
                              }
                            >
                              {item.action === "technical"
                                ? technicalBusy
                                  ? c("Analyzing…", "正在分析…")
                                  : c("Generate analysis", "生成分析")
                                : personalResearch.busy
                                  ? c("Generating…", "正在生成…")
                                  : c("Generate AI research", "生成 AI 研究")}
                            </Button>
                          </dd>
                        )
                      )}
                    </div>
                  ))}
                </dl>
              </Panel>

                </TabsContent>
                <TabsContent value="technical" forceMount className="pt-5 data-[state=inactive]:hidden">
              <Panel>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={technicalBusy}
                    onClick={() => setGenerationRequest((value) => value + 1)}
                  >
                    {c("AI analysis", "AI 分析")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={technicalBusy}
                    onClick={() => setDrawingRequest((value) => value + 1)}
                  >
                    {c("AI drawings", "AI 画线")}
                  </Button>
                </div>
                {technical ? (
                  <div className="pt-4">
                    <DirectionBadge direction={technical.bias} />
                    <div className="mt-3">
                      <AnalysisSummary
                        key={technical.summary}
                        text={technical.summary}
                        t={t}
                      />
                    </div>
                    <TechnicalFindings result={technical} t={t} />
                    {!technical.findings?.length && (
                      <ul className="mt-3 space-y-2 text-sm">
                        {technical.signals.map((signal) => (
                          <li key={signal} className="flex gap-2.5">
                            <span
                              aria-hidden
                              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/50"
                            />
                            {signal}
                          </li>
                        ))}
                      </ul>
                    )}
                    {technical.invalidation && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {c("What changes the view", "什么会改变判断")}：
                        {technical.invalidation}
                      </p>
                    )}
                  </div>
                ) : (
                  <Empty>
                    {c(
                      "Use AI analysis for a written interpretation, or AI drawings for support, resistance, trendlines and Fibonacci levels.",
                      "点击 AI 分析获取文字解读；点击 AI 画线绘制支撑、阻力、趋势线和斐波那契水平。",
                    )}
                  </Empty>
                )}
              </Panel>

                </TabsContent>
                <TabsContent value="setup" forceMount className="pt-5 data-[state=inactive]:hidden">
              {technical?.setup ? (
                <Panel>
                  <div>
                    <h3 className="font-semibold">{technical.setup.name}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      {technical.setup.reason}
                    </p>
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
                          <dd className="figure mt-1 font-medium">{value}</dd>
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
                </Panel>
              ) : (
                <Panel title={c("AI setup", "AI 条件计划")}>
                  <Empty>{c("Generate technical analysis to see entry conditions, invalidation and targets when a setup is available.", "生成技术分析后，若有适用的条件计划，将在这里显示入场条件、失效价与目标。")}</Empty>
                  <Button variant="outline" size="sm" disabled={technicalBusy} onClick={() => setGenerationRequest((value) => value + 1)}>
                    {technicalBusy ? c("Analyzing…", "正在分析…") : c("Generate analysis", "生成分析")}
                  </Button>
                </Panel>
              )}
                </TabsContent>
              </Tabs>
            </aside>
            <section className="min-w-0 border-t border-border pt-4 xl:col-span-2" aria-label={c("News and research", "资讯与研究")}>
              <Tabs key={`evidence-${ticker}`} defaultValue="news">
                <TabsList className="sticky top-0 z-10 flex flex-wrap gap-x-6 overflow-visible bg-background" aria-label={c("Stock evidence", "个股资讯")}>
                  <TabsTrigger value="news">{c("Latest news", "最新相关新闻")}</TabsTrigger>
                  <TabsTrigger value="creators">{c("Creator intelligence", "博主情报")}</TabsTrigger>
                  <TabsTrigger value="research">{c("AI research", "AI 研究")}</TabsTrigger>
                </TabsList>
                <TabsContent value="news" forceMount className="min-w-0 pt-6 data-[state=inactive]:hidden">
              <StockNews key={ticker} ticker={ticker} />

                </TabsContent>
                <TabsContent value="creators" forceMount className="min-w-0 pt-6 data-[state=inactive]:hidden">
              <CreatorIntelligence
                key={ticker}
                ticker={ticker}
                opinions={opinions}
                loading={loading}
                error={opinionsError}
                onRetry={() => setRefresh((value) => value + 1)}
              />


                </TabsContent>
                <TabsContent value="research" forceMount className="min-w-0 pt-6 data-[state=inactive]:hidden">
              <Panel
                title={c("AI research", "AI 研究")}
                description={
                  research && completedAt
                    ? `${c("Last completed", "最近完成")}：${date(completedAt)}`
                    : undefined
                }
              >
                <div className="pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      personalResearch.busy || personalResearch.history.busy
                    }
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
                          {c("Full saved research report", "完整历史研究报告")}
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
              </Tabs>
            </section>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
