"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PriceChart from "@/components/youtube/PriceChart";
import CompanyLogo from "@/components/ui/company-logo";
import CreatorAvatar from "@/components/youtube/CreatorAvatar";
import { MarkdownBody } from "@/components/trading-analysis/markdown";
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
  opinion.sentiment === "bullish" ? "bullish" : opinion.sentiment === "bearish" ? "bearish" : "neutral";

export default function StockWorkspace({ ticker }: { ticker: string }) {
  const c = useCopy();
  const { t } = useTranslation();
  const { setContext } = useDecisionCommand();
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [opinions, setOpinions] = useState<YouTubeOpinion[]>([]);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [research, setResearch] = useState<TradingAnalysis | null>(null);
  const [technical, setTechnical] = useState<AiTechnicalAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [showAllOpinions, setShowAllOpinions] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErrors([]);
    Promise.allSettled([
      getStockQuote(ticker),
      getYouTubeStockDetail(ticker),
      getMyHoldings(),
      getPublishedAnalyses({ ticker, limit: 20 }),
    ]).then((results) => {
      if (!alive) return;
      const [q, o, p, r] = results;
      setQuote(q.status === "fulfilled" && q.value.price > 0 ? q.value : null);
      setOpinions(o.status === "fulfilled" ? o.value.opinions : []);
      setPositions(
        p.status === "fulfilled"
          ? p.value.accounts
              .flatMap((a) => a.portfolio_positions || [])
              .filter((p) => p.symbol === ticker && p.position_type !== "option")
          : [],
      );
      setResearch(
        r.status === "fulfilled"
          ? (r.value.items.find((x) => x.status === "completed") ?? null)
          : null,
      );
      setErrors(
        results.flatMap((result, index) =>
          result.status === "rejected"
            ? [[c("Market", "行情"), c("Creators", "博主观点"), c("Portfolio", "持仓"), c("Research", "深度研究")][index]]
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
      .map(({ channel_title, opinion_date, sentiment, summary, thesis, risks }) => ({
        channel_title,
        opinion_date,
        sentiment,
        summary,
        thesis,
        risks,
      })),
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
  const sorted = [...opinions].sort((a, b) => b.opinion_date.localeCompare(a.opinion_date));
  const shownOpinions = showAllOpinions ? sorted.slice(0, 30) : sorted.slice(0, 8);
  const up = (quote?.changePercent ?? 0) >= 0;

  const evidenceItems = [
    {
      label: c("Technical", "技术面"),
      direction: technical?.bias,
      detail: technical
        ? [technical.interval, date(technical.generated_at)].join(c(", ", "，"))
        : c("Run AI analysis on the chart", "在图表上运行 AI 分析"),
    },
    {
      label: c("Creators", "博主"),
      direction: creators.direction,
      detail: creators.count
        ? c(`${creators.count} creators, last 30 days`, `${creators.count} 位博主，近 30 天`)
        : c("No calls in 30 days", "近 30 天无观点"),
    },
    {
      label: c("Fundamental", "基本面"),
      direction: null,
      detail: research?.fundamentals_report
        ? c("In deep research below", "见下方深度研究")
        : c("Needs deep research", "需要深度研究"),
    },
    {
      label: c("News", "新闻"),
      direction: null,
      detail: research?.news_report
        ? c("In deep research below", "见下方深度研究")
        : c("Needs deep research", "需要深度研究"),
    },
  ];

  const opinionBody = (opinion: YouTubeOpinion, align: "left" | "right" = "left") => (
    <div className={cn("min-w-0", align === "right" && "md:text-right")}>
      <Link
        href={`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(opinion.channel_id)}`}
        className={cn(
          "inline-flex max-w-full items-center gap-2 rounded-sm text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          align === "right" && "md:flex-row-reverse",
        )}
      >
        <CreatorAvatar name={opinion.channel_title || opinion.channel_id} avatarUrl={opinion.channel_avatar_url} size="sm" />
        <span className="min-w-0 truncate">{opinion.channel_title || opinion.channel_id}</span>
      </Link>
      <p className="mt-2 line-clamp-4 text-sm leading-6">{opinion.thesis || opinion.summary}</p>
      {!!opinion.risks?.length && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {c("Risks", "风险")}：{opinion.risks.join("；")}
        </p>
      )}
      {opinion.video_id && (
        <a
          href={opinion.video_url || `https://www.youtube.com/watch?v=${encodeURIComponent(opinion.video_id)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {c("Source video", "视频来源")}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}
    </div>
  );

  return (
    <DashboardLayout title={c("Research", "研究")}>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-4 pb-16 pt-4 md:px-8 md:pt-6">
          <Link
            href="/dashboard/research"
            className="-ml-1 inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-[13px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {c("Research", "研究")}
          </Link>

          <div className="mt-4 grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0 xl:col-start-1 xl:row-start-1" aria-labelledby="stock-title">
              <div className="flex items-center gap-3">
                <CompanyLogo symbol={ticker} size="md" />
                <div className="min-w-0">
                  <h1 id="stock-title" className="text-lg font-semibold leading-tight">
                    {ticker}
                    {positions.length > 0 && <HeldMark />}
                  </h1>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {quote?.name || (loading ? "" : c("Stock workspace", "股票工作台"))}
                  </p>
                </div>
              </div>
              <div className="mt-4" aria-live="polite">
                <div className="figure text-[34px] font-semibold leading-tight tracking-[-0.02em] sm:text-[40px]">
                  {loading && !quote ? <Skeleton className="h-10 w-40" /> : money(quote?.price)}
                </div>
                {quote && (
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className={cn("figure font-semibold", up ? "text-positive" : "text-negative")}>
                      {signedMoney(quote.change)} ({up ? "+" : "−"}
                      {Math.abs(quote.changePercent).toFixed(2)}%)
                    </span>
                    <span className="text-muted-foreground">{c("Today", "今天")}</span>
                  </p>
                )}

              </div>
              {!!errors.length && (
                <p role="alert" className="mt-3 text-[13px] text-muted-foreground">
                  {c("Some sources could not be loaded", "部分数据源未能加载")}：{errors.join(c(", ", "、"))}。
                </p>
              )}
              <div className="mt-6">
                <PriceChart
                  symbol={ticker}
                  range="3m"
                  from=""
                  to=""
                  opinions={[]}
                  formatDate={date}
                  t={t}
                  onAnalysisChange={onAnalysis}
                />
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
                {evidenceItems.map((item) => (
                  <div key={item.label} className="min-w-0">
                    <dt className="text-[13px] text-muted-foreground">{item.label}</dt>
                    <dd className="mt-1">
                      <DirectionBadge direction={item.direction} />
                    </dd>
                    <dd className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <aside className="min-w-0 space-y-10 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:sticky xl:top-6 xl:self-start">
              <section aria-labelledby="position-title">
                <h2 id="position-title" className="text-[13px] font-semibold text-muted-foreground">
                  {c("Your position", "你的仓位")}
                </h2>
                {positions.length ? (
                  <>
                    <p className="figure mt-1 text-2xl font-semibold">{money(positionValue)}</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      <span className="tabular-nums">{shares}</span> {c("shares across linked accounts", "股，来自已连接账户")}
                      {positionPnl !== null && (
                        <>
                          {c(", ", "，")}
                          <span className={cn("figure font-semibold", positionPnl >= 0 ? "text-positive" : "text-negative")}>
                            {signedMoney(positionPnl)}
                          </span>{" "}
                          {c("unrealized", "浮动盈亏")}
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {loading ? "…" : c("You don't hold this stock in a linked account.", "已连接账户中没有这只股票。")}
                  </p>
                )}
              </section>

              <Panel title={c("Latest creator update", "博主最新观点")}>
                {sorted[0] ? (
                  <div className="space-y-3 pt-4">
                    <p className="text-xs text-muted-foreground">{date(sorted[0].opinion_date)} · {sorted[0].channel_title || sorted[0].channel_id}</p>
                    <DirectionBadge direction={sideOf(sorted[0])} />
                    <p className="text-sm leading-6">{sorted[0].summary || sorted[0].thesis || c("Read the source for details.", "查看原始视频了解详情。")}</p>
                    {!!sorted[0].risks?.length && <div className="border-t border-border pt-3"><h3 className="text-xs font-semibold text-muted-foreground">{c("Risks mentioned", "提到的风险")}</h3><ul className="mt-2 space-y-2 text-sm">{sorted[0].risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul></div>}
                    <a className="inline-block text-sm font-medium underline-offset-4 hover:underline" href={sorted[0].video_url || `https://www.youtube.com/watch?v=${encodeURIComponent(sorted[0].video_id)}`} target="_blank" rel="noreferrer">{c("Watch source video", "查看原始视频")}</a>
                  </div>
                ) : <Empty>{loading ? c("Loading…", "加载中…") : c("No creator coverage yet.", "暂时没有博主观点。")}</Empty>}
                <TextLink href="/dashboard/journal" className="mt-4 inline-block">{c("All updates", "全部变化动态")}</TextLink>
              </Panel>

              {technical?.setup && (
                <Panel title={c("AI setup", "AI 条件计划")}>
                  <div className="pt-4">
                    <h3 className="font-semibold">{technical.setup.name}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{technical.setup.reason}</p>
                    <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      {[
                        [c("Entry", "入场"), `${money(technical.setup.entry_low)} – ${money(technical.setup.entry_high)}`],
                        [c("Invalidation", "失效价"), money(technical.setup.invalidation)],
                        [c("Targets", "目标"), technical.setup.targets.map(money).join(" / ")],
                        [c("Risk / reward", "风险收益比"), `1 : ${technical.setup.risk_reward}`],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-muted-foreground">{label}</dt>
                          <dd className="figure mt-1 font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-4 text-sm font-medium">
                      {c("Setup alignment", "计划证据一致性")}：
                      {technical.setup.score === null ? c("Incomplete evidence", "证据不完整") : `${technical.setup.score}/100`}
                    </p>
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer">{c("How the score works", "评分如何计算")}</summary>
                      <p className="mt-2 leading-5">
                        {c(
                          "Five equal checks (20 points each): trend alignment, price vs EMA20, EMA20 vs EMA50, RSI momentum, volume confirmation. Evidence alignment, not a probability of returns.",
                          "5 项等权检查，每项20分：趋势一致性、价格与 EMA20、EMA20 与 EMA50、RSI 动量、成交量确认。代表证据一致性，不代表收益概率。",
                        )}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {Object.entries(technical.setup.checks).map(([name, passed]) => (
                          <li key={name}>
                            {passed === null ? "—" : passed ? "✓" : "△"} {name.replaceAll("_", " ")}
                          </li>
                        ))}
                      </ul>
                    </details>

                  </div>
                </Panel>
              )}

              <Panel title={c("AI technical read", "AI 技术解读")}>
                {technical ? (
                  <div className="pt-4">
                    <DirectionBadge direction={technical.bias} />
                    <p className="mt-2 text-sm leading-6">{technical.summary}</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      {technical.signals.map((signal) => (
                        <li key={signal} className="flex gap-2.5">
                          <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/50" />
                          {signal}
                        </li>
                      ))}
                    </ul>
                    {technical.invalidation && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {c("What changes the view", "什么会改变判断")}：{technical.invalidation}
                      </p>
                    )}
                  </div>
                ) : (
                  <Empty>
                    {c(
                      "Run AI analysis on the chart to draw support, resistance, trendlines and Fibonacci levels.",
                      "在图表上运行 AI 分析，绘制支撑、阻力、趋势线和斐波那契水平。",
                    )}
                  </Empty>
                )}
              </Panel>
            </aside>

            <div className="min-w-0 space-y-12 xl:col-start-1 xl:row-start-2">
              <Panel
                title={c("What creators say", "博主怎么看")}
                description={c(
                  "Latest call per creator in the past 30 days decides the split. All tracked creators, not a personal list.",
                  "按近 30 天每位博主的最新观点统计。覆盖所有追踪的博主，并非个人关注列表。",
                )}
                action={<TextLink href={`/dashboard/youtube-opinions?tab=stocks&stock=${encodeURIComponent(ticker)}`}>{c("Full record", "完整记录")}</TextLink>}
              >
                {opinions.length ? (
                  <>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4 pb-2 pt-5">
                      <p className="text-positive">
                        <span className="figure text-2xl font-semibold">{creators.bullish}</span>{" "}
                        <span className="text-sm font-semibold">{c("bullish", "看多")}</span>
                      </p>
                      <p className="text-center text-xs text-muted-foreground">
                        <span className="figure">{creators.neutral}</span> {c("neutral or mixed", "中性或分歧")}
                      </p>
                      <p className="text-right text-negative">
                        <span className="text-sm font-semibold">{c("bearish", "看空")}</span>{" "}
                        <span className="figure text-2xl font-semibold">{creators.bearish}</span>
                      </p>
                    </div>
                    {creators.count > 0 && (
                      <div aria-hidden className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                        {creators.bullish > 0 && <span className="bg-positive-fill" style={{ flex: creators.bullish }} />}
                        {creators.neutral > 0 && <span className="bg-muted-foreground/40" style={{ flex: creators.neutral }} />}
                        {creators.bearish > 0 && <span className="bg-negative-fill" style={{ flex: creators.bearish }} />}
                      </div>
                    )}
                    <ol className="relative mt-6">
                      <span aria-hidden className="absolute bottom-0 left-[7px] top-0 w-px bg-border md:left-1/2" />
                      {shownOpinions.map((opinion) => {
                        const side = sideOf(opinion);
                        const dot = side === "bullish" ? "bg-positive-fill" : side === "bearish" ? "bg-negative-fill" : "bg-muted-foreground";
                        const word = side === "bullish" ? c("Bullish", "看多") : side === "bearish" ? c("Bearish", "看空") : opinion.sentiment === "mixed" ? c("Mixed", "分歧") : c("Neutral", "中性");
                        return (
                          <li
                            key={opinion.id}
                            className="relative grid grid-cols-[15px_minmax(0,1fr)] gap-x-4 pb-8 md:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] md:gap-x-0"
                          >
                            <span className="relative z-[1] flex justify-center md:col-start-2 md:row-start-1 md:flex-col md:items-center">
                              <span aria-hidden className={cn("mt-1.5 h-[9px] w-[9px] rounded-full ring-4 ring-background", dot)} />
                              <time dateTime={opinion.opinion_date} className="mt-1 hidden bg-background px-1 text-center text-[11px] tabular-nums text-muted-foreground md:block">
                                {date(opinion.opinion_date)}
                              </time>
                            </span>
                            <div
                              className={cn(
                                "min-w-0",
                                side === "bullish" && "md:col-start-1 md:row-start-1 md:pr-6",
                                side === "bearish" && "md:col-start-3 md:row-start-1 md:pl-6",
                                side === "neutral" && "md:col-span-3 md:col-start-1 md:row-start-2 md:mx-auto md:max-w-md md:pt-2 md:text-center",
                              )}
                            >
                              <p className="mb-1 flex items-center gap-2 text-xs md:hidden">
                                <span className={cn("font-semibold", side === "bullish" ? "text-positive" : side === "bearish" ? "text-negative" : "text-muted-foreground")}>{word}</span>
                                <time dateTime={opinion.opinion_date} className="tabular-nums text-muted-foreground">{date(opinion.opinion_date)}</time>
                              </p>
                              {side === "neutral" && (
                                <p className="mb-1 hidden text-xs font-semibold text-muted-foreground md:block">{word}</p>
                              )}
                              {opinionBody(opinion, side === "bullish" ? "right" : "left")}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    {sorted.length > 8 && (
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowAllOpinions((value) => !value)}>
                        {showAllOpinions ? c("Show fewer", "收起") : c(`Show ${Math.min(sorted.length, 30) - 8} more`, `再看 ${Math.min(sorted.length, 30) - 8} 条`)}
                      </Button>
                    )}
                  </>
                ) : (
                  <Empty>{loading ? c("Loading creator opinions…", "正在加载博主观点…") : c("No creator opinions for this stock yet.", "这只股票暂时没有博主观点。")}</Empty>
                )}
              </Panel>

              <Panel
                title={c("Deep research", "深度研究")}
                description={research && completedAt ? `${c("Last completed", "最近完成")}：${date(completedAt)}` : undefined}
              >
                {research ? (
                  <div className="pt-5">
                    <h3 className="mb-3 text-sm font-semibold">
                      {c("Investment thesis and what could change it", "投资判断与可能改变判断的因素")}
                    </h3>
                    <div className="max-w-[72ch]">
                      <MarkdownBody content={research.investment_plan || research.trader_plan || research.market_report || ""} />
                    </div>
                    <details className="mt-5 border-t border-border pt-4">
                      <summary className="cursor-pointer text-sm font-semibold">
                        {c("Why Kolvex sees it this way", "为什么得出这样的判断")}
                      </summary>
                      <div className="mt-4 grid gap-6 md:grid-cols-2">
                        {[
                          [c("Technical", "技术面"), research.market_report],
                          [c("Fundamental", "基本面"), research.fundamentals_report],
                          [c("News", "新闻"), research.news_report],
                          [c("Social context", "社交环境"), research.sentiment_report],
                        ].map(
                          ([label, report]) =>
                            report && (
                              <section key={label}>
                                <h4 className="mb-2 font-medium">{label}</h4>
                                <MarkdownBody content={report} />
                              </section>
                            ),
                        )}
                      </div>
                    </details>
                    <details className="mt-4 border-t border-border pt-4">
                      <summary className="cursor-pointer text-sm">
                        {c("See how AI reached this conclusion", "查看 AI 的推理过程")}
                      </summary>
                      <div className="mt-4 space-y-4">
                        {research.investment_debate?.bull_history && (
                          <MarkdownBody content={research.investment_debate.bull_history} />
                        )}
                        {research.investment_debate?.bear_history && (
                          <MarkdownBody content={research.investment_debate.bear_history} />
                        )}
                      </div>
                      <TextLink className="mt-4 inline-block" href={`/dashboard/trading-analysis/explore/${research.id}`}>
                        {c("Full research report", "完整研究报告")}
                      </TextLink>
                    </details>
                  </div>
                ) : (
                  <Empty>
                    {c(
                      "No published research for this stock yet.",
                      "这只股票暂时没有已发布的研究报告。",
                    )}
                  </Empty>
                )}
              </Panel>
            </div>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
