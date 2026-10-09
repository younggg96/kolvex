"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  getAnalysisHistory,
  type TradingAnalysis,
} from "@/lib/tradingAnalysisApi";
import type { PortfolioPosition } from "@/lib/supabase/database.types";
import {
  creatorEvidence,
  listTheses,
  riskReward,
  thesisChanges,
  type Thesis,
} from "@/lib/decision";
import { useTranslation } from "@/lib/i18n";
import { DirectionBadge, Empty, Panel, money, useCopy } from "./shared";
import ThesisEditor from "./ThesisEditor";
import { useDecisionCommand } from "./CommandLayer";

export default function StockWorkspace({ ticker }: { ticker: string }) {
  const c = useCopy();
  const { t } = useTranslation();
  const { setContext } = useDecisionCommand();
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [opinions, setOpinions] = useState<YouTubeOpinion[]>([]);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [research, setResearch] = useState<TradingAnalysis | null>(null);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [technical, setTechnical] = useState<AiTechnicalAnalysis | null>(null);
  const [editing, setEditing] = useState<Thesis | "new" | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErrors([]);
    Promise.allSettled([
      getStockQuote(ticker),
      getYouTubeStockDetail(ticker),
      getMyHoldings(),
      getAnalysisHistory({ ticker, limit: 20 }),
      listTheses(ticker),
    ]).then((results) => {
      if (!alive) return;
      const [q, o, p, r, th] = results;
      setQuote(q.status === "fulfilled" && q.value.price > 0 ? q.value : null);
      setOpinions(o.status === "fulfilled" ? o.value.opinions : []);
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
      setTheses(th.status === "fulfilled" ? th.value.items : []);
      setErrors(
        results.flatMap((result, index) =>
          result.status === "rejected"
            ? [
                ["Market", "Creators", "Portfolio", "Research", "Journal"][
                  index
                ],
              ]
            : [],
        ),
      );
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [ticker, refresh]);
  const onAnalysis = useCallback(
    (value: AiTechnicalAnalysis | null) => setTechnical(value),
    [],
  );
  const creators = creatorEvidence(opinions);
  const evidence = {
    technical: technical?.bias ?? null,
    creators: creators.direction,
  };
  const current = theses.find((thesis) => thesis.status === "active");
  const changes = current
    ? thesisChanges(current, quote?.price ?? null, evidence)
    : [];
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
    thesis: current,
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
  const date = (value: string) =>
    new Date(value).toLocaleDateString(t("common.intlLocale"));
  const completedAt = research?.completed_at || research?.created_at;
  const changeLabels = {
    invalidation: c("Price reached your invalidation", "价格已触及失效价"),
    target: c("Price reached your target", "价格已触及目标价"),
    technical: c(
      "Technical bias changed since your last save",
      "技术倾向较上次保存发生变化",
    ),
    creators: c(
      "Creator sentiment changed since your last save",
      "创作者观点较上次保存发生变化",
    ),
  };
  return (
    <DashboardLayout
      title={c("Research / Stock workspace", "研究 / 股票工作台")}
      headerActions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRefresh((n) => n + 1)}
          disabled={loading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          {c("Refresh", "刷新")}
        </Button>
      }
    >
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
          <Link
            href="/dashboard/research"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {c("All research", "全部研究")}
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <CompanyLogo symbol={ticker} size="lg" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{ticker}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {quote?.name ||
                    c("Investment decision workspace", "投资决策工作台")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs text-muted-foreground">
                  {c("Market price", "市场价格")}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {money(quote?.price)}
                </p>
                {quote && (
                  <p
                    className={`text-xs ${quote.changePercent >= 0 ? "text-primary" : "text-red-500"}`}
                  >
                    {quote.changePercent >= 0 ? "+" : ""}
                    {quote.changePercent.toFixed(2)}%
                  </p>
                )}
              </div>
              <div className="border-l border-border pl-6">
                <p className="text-xs text-muted-foreground">
                  {c("Your position", "我的持仓")}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {positions.length ? money(positionValue) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {positions.length
                    ? `${shares} ${c("shares across linked accounts", "股 · 已连接账户")}`
                    : c("No linked equity position", "暂无已连接的股票持仓")}
                </p>
              </div>
            </div>
          </div>
          {loading && (
            <p role="status" className="text-sm text-muted-foreground">
              {c(
                "Loading market, creator opinions, portfolio and your theses…",
                "正在加载行情、观点、持仓与投资判断…",
              )}
            </p>
          )}
          {!!errors.length && (
            <p role="alert" className="text-sm text-muted-foreground">
              {c("Some sources could not be loaded", "部分数据源未能加载")}:{" "}
              {errors.join(", ")}. {c("Refresh to retry.", "请刷新重试。")}
            </p>
          )}
          <Panel
            title={c("Kolvex view", "Kolvex 证据视图")}
            action={
              <span className="text-xs text-muted-foreground">
                {c(
                  "Evidence direction · no combined score",
                  "证据倾向 · 暂无综合评分",
                )}
              </span>
            }
          >
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: c("Technical", "技术面"),
                  direction: technical?.bias,
                  detail: technical
                    ? `${technical.interval} · ${date(technical.generated_at)}`
                    : c("Run AI analysis on the chart", "在图表上运行 AI 分析"),
                },
                {
                  label: c("Creators", "创作者观点"),
                  direction: creators.direction,
                  detail: `${creators.count} ${c("creators · latest call / creator · 30 days", "位创作者 · 各取最近观点 · 30天")}`,
                },
                {
                  label: c("Fundamental", "基本面"),
                  direction: null,
                  detail: research?.fundamentals_report
                    ? c("Research available below", "下方可查看研究报告")
                    : c("Deep research needed", "需要深度研究"),
                },
                {
                  label: c("News", "新闻"),
                  direction: null,
                  detail: research?.news_report
                    ? c("Research available below", "下方可查看研究报告")
                    : c("Deep research needed", "需要深度研究"),
                },
              ].map((item) => (
                <div key={item.label}>
                  <p className="mb-2 text-sm font-medium">{item.label}</p>
                  <DirectionBadge direction={item.direction} />
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Panel
              title={c("Price context", "价格环境")}
              action={
                <span className="text-xs text-muted-foreground">
                  {c("AI levels + creator calls", "AI 关键价位 + 创作者观点")}
                </span>
              }
            >
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
            </Panel>
            <div className="space-y-6">
              {technical?.setup && (
                <Panel title={c("AI setup", "AI 条件计划")}>
                  <h3 className="font-semibold">{technical.setup.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
                        <dd className="mt-1 font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-sm font-medium">
                    {c("Setup alignment", "计划证据一致性")}:{" "}
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={() => setEditing("new")}
                  >
                    {c("Use as thesis draft", "用于判断草稿")}
                  </Button>
                </Panel>
              )}
              <Panel
                title={c("Decision plan", "决策计划")}
                action={
                  <Button
                    size="sm"
                    onClick={() => setEditing(current || "new")}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {current
                      ? c("Review", "复盘")
                      : c("Create thesis", "创建判断")}
                  </Button>
                }
              >
                {current ? (
                  <>
                    <DirectionBadge direction={current.direction} />
                    <p className="my-4 whitespace-pre-wrap text-sm leading-6">
                      {current.reasoning}
                    </p>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      {[
                        [
                          c("Entry", "入场"),
                          `${money(current.entry_low)}${current.entry_high ? ` – ${money(current.entry_high)}` : ""}`,
                        ],
                        [
                          c("Invalidation", "失效价"),
                          money(current.invalidation),
                        ],
                        [c("Target", "目标价"), money(current.target)],
                        [
                          c("Risk / reward", "风险收益比"),
                          riskReward(current)
                            ? `1 : ${riskReward(current)!.toFixed(2)}`
                            : "—",
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-muted-foreground">
                            {label}
                          </dt>
                          <dd className="mt-1 font-medium tabular-nums">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-4 text-xs text-muted-foreground">
                      {current.horizon} · v{current.version} ·{" "}
                      {date(current.created_at)}
                    </p>
                    {!!changes.length && (
                      <div className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                        {changes.map((change) => (
                          <p key={change}>{changeLabels[change]}</p>
                        ))}
                        <p className="mt-2 font-medium">
                          {c("Has your thesis changed?", "你的判断改变了吗？")}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <Empty>
                    {c(
                      "Capture why you're interested, your entry, target, and what would invalidate your reasoning.",
                      "记录为什么关注、入场与目标价，以及什么会让判断失效。",
                    )}
                  </Empty>
                )}
                <Link
                  href="/dashboard/journal"
                  className="mt-4 inline-block text-xs font-medium text-primary"
                >
                  {c("View thesis history", "查看判断历史")}
                </Link>
              </Panel>
              <Panel title={c("AI technical evidence", "AI 技术证据")}>
                {technical ? (
                  <>
                    <DirectionBadge direction={technical.bias} />
                    <p className="mt-3 text-sm leading-6">
                      {technical.summary}
                    </p>
                    <ul className="mt-4 space-y-2 text-sm">
                      {technical.signals.map((signal) => (
                        <li
                          key={signal}
                          className="border-l-2 border-primary/40 pl-3"
                        >
                          {signal}
                        </li>
                      ))}
                    </ul>
                    {technical.invalidation && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        {c("What changes the view", "什么会改变判断")}:{" "}
                        {technical.invalidation}
                      </p>
                    )}
                  </>
                ) : (
                  <Empty>
                    {c(
                      "Use AI analysis in the chart to validate the price structure and draw support, resistance, trendlines and Fibonacci levels.",
                      "使用图表中的 AI 分析验证价格结构，绘制支撑、阻力、趋势线和斐波那契水平。",
                    )}
                  </Empty>
                )}
              </Panel>
            </div>
          </div>
          <Panel
            title={c("What creators are saying", "创作者如何看待这只股票")}
            action={
              <Link
                href="/dashboard/youtube-opinions"
                className="text-sm text-primary"
              >
                {c("YouTube Opinions", "YouTube 观点")}
              </Link>
            }
          >
            <p className="mb-5 text-sm text-muted-foreground">
              {creators.bullish} {c("bullish", "看多")} / {creators.neutral}{" "}
              {c("neutral or mixed", "中性或混合")} / {creators.bearish}{" "}
              {c("bearish", "看空")} ·{" "}
              {c(
                "Latest call per creator in the past 30 days. All tracked creators; not a personal following list.",
                "最近30天每位创作者的最新观点。覆盖所有追踪的创作者，并非个人关注列表。",
              )}
            </p>
            <div className="divide-y divide-border">
              {[...opinions]
                .sort((a, b) => b.opinion_date.localeCompare(a.opinion_date))
                .slice(0, 8)
                .map((opinion) => (
                  <article
                    key={opinion.id}
                    className="grid gap-3 py-4 md:grid-cols-[180px_minmax(0,1fr)]"
                  >
                    <div>
                      <Link
                        href={`/dashboard/youtube-opinions?tab=creators&creator=${encodeURIComponent(opinion.channel_id)}`}
                        className="flex min-w-0 items-center gap-2 font-medium hover:underline"
                      >
                        <CreatorAvatar name={opinion.channel_title || opinion.channel_id} avatarUrl={opinion.channel_avatar_url} />
                        <span className="min-w-0 break-words">{opinion.channel_title || opinion.channel_id}</span>
                      </Link>
                      <div className="mt-2">
                        <DirectionBadge
                          direction={
                            opinion.sentiment === "mixed"
                              ? "neutral"
                              : opinion.sentiment
                          }
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {date(opinion.opinion_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm leading-6">
                        {opinion.thesis || opinion.summary}
                      </p>
                      {!!opinion.risks?.length && (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {c("Risks", "风险")}: {opinion.risks.join(" · ")}
                        </p>
                      )}
                      {opinion.video_id && (
                        <a
                          href={`https://www.youtube.com/watch?v=${encodeURIComponent(opinion.video_id)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs text-primary"
                        >
                          {c("Watch source", "查看视频来源")}
                        </a>
                      )}
                    </div>
                  </article>
                ))}
            </div>
            {!opinions.length && (
              <Empty>
                {c(
                  "No creator opinions available for this ticker yet.",
                  "这只股票暂时没有创作者观点。",
                )}
              </Empty>
            )}
          </Panel>
          <Panel
            title={`${ticker} ${c("deep research", "深度研究")}`}
            action={
              <Link
                href={`/dashboard/trading-analysis?ticker=${ticker}`}
                className="text-sm text-primary"
              >
                {c("Run deep research", "运行深度研究")}
              </Link>
            }
          >
            {research ? (
              <>
                <p className="mb-4 text-xs text-muted-foreground">
                  {c("Last completed research", "最近完成的研究")}:{" "}
                  {completedAt && date(completedAt)}
                </p>
                <h3 className="mb-3 text-sm font-semibold">
                  {c(
                    "Investment thesis and what could change it",
                    "投资判断与可能改变判断的因素",
                  )}
                </h3>
                <MarkdownBody
                  content={
                    research.investment_plan ||
                    research.trader_plan ||
                    research.market_report ||
                    ""
                  }
                />
                <details className="mt-5 border-t border-border pt-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    {c("Why Kolvex sees it this way", "为什么得出这样的判断")}
                  </summary>
                  <div className="mt-4 grid gap-5 md:grid-cols-2">
                    {[
                      [c("Technical", "技术面"), research.market_report],
                      [
                        c("Fundamental", "基本面"),
                        research.fundamentals_report,
                      ],
                      [c("News", "新闻"), research.news_report],
                      [
                        c("Social context", "社交环境"),
                        research.sentiment_report,
                      ],
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
                    {c(
                      "See how AI reached this conclusion",
                      "查看 AI 的推理过程",
                    )}
                  </summary>
                  <div className="mt-4 space-y-4">
                    {research.investment_debate?.bull_history && (
                      <MarkdownBody
                        content={research.investment_debate.bull_history}
                      />
                    )}
                    {research.investment_debate?.bear_history && (
                      <MarkdownBody
                        content={research.investment_debate.bear_history}
                      />
                    )}
                  </div>
                  <Link
                    className="mt-4 inline-block text-sm text-primary"
                    href={`/dashboard/trading-analysis/${research.id}`}
                  >
                    {c("Full research report", "完整研究报告")}
                  </Link>
                </details>
              </>
            ) : (
              <Empty>
                {c(
                  "Validate the idea with technical, news and fundamental research. Configure your AI provider in Settings before running research.",
                  "通过技术面、新闻与基本面研究验证想法。运行研究前，请在设置中配置 AI 服务。",
                )}
              </Empty>
            )}
          </Panel>
        </div>
      </main>
      {editing && (
        <ThesisEditor
          ticker={ticker}
          existing={editing === "new" ? undefined : editing}
          evidence={evidence}
          setup={technical?.setup}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setTheses((previous) => [
              saved,
              ...previous.filter((x) => x.thesis_id !== saved.thesis_id),
            ]);
            setEditing(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
