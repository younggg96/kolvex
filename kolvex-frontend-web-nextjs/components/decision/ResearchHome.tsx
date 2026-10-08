"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  getYouTubeOpinionDashboard,
  type YouTubeOpinionDashboard,
} from "@/lib/youtubeOpinionsApi";
import { getMyHoldings } from "@/lib/portfolioApi";
import { listTheses, type Thesis } from "@/lib/decision";
import { Empty, Panel, TickerSearch, WorkspaceLink, useCopy } from "./shared";
import ThesisWatch from "./ThesisWatch";
import { useDecisionCommand } from "./CommandLayer";

export default function ResearchHome({ home = false }: { home?: boolean }) {
  const c = useCopy();
  const { setContext } = useDecisionCommand();
  const [dashboard, setDashboard] = useState<YouTubeOpinionDashboard | null>(
    null,
  );
  const [holdings, setHoldings] = useState<string[]>([]);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      getYouTubeOpinionDashboard({ limit: 8 }),
      getMyHoldings(),
      listTheses(),
    ]).then(([opinions, portfolio, journal]) => {
      if (!alive) return;
      setDashboard(opinions.status === "fulfilled" ? opinions.value : null);
      setHoldings(
        portfolio.status === "fulfilled"
          ? [
              ...new Set(
                portfolio.value.accounts
                  .flatMap((a) => a.portfolio_positions || [])
                  .filter((p) => p.position_type !== "option")
                  .map((p) => p.symbol),
              ),
            ]
          : [],
      );
      setTheses(journal.status === "fulfilled" ? journal.value.items : []);
      setErrors(
        [
          opinions.status === "rejected" ? "Creator opinions" : "",
          portfolio.status === "rejected" ? "Portfolio" : "",
          journal.status === "rejected" ? "Journal" : "",
        ].filter(Boolean),
      );
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [attempt]);
  const active = theses.filter((t) => t.status === "active");
  const commandContext = JSON.stringify({
    workspace: home ? "Home" : "Research",
    holdings,
    theses: theses.slice(0, 20),
    creatorCoverage: dashboard?.stocks.slice(0, 8),
    recentCreatorChanges: dashboard?.changes.slice(0, 8),
    unavailableSources: errors,
  });
  useEffect(() => {
    setContext(commandContext);
    return () => setContext("");
  }, [commandContext, setContext]);
  return (
    <DashboardLayout
      title={home ? c("Home", "首页") : c("Research", "研究")}
      headerActions={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setAttempt((n) => n + 1)}
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
        <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 md:px-8">
          <section className="space-y-5">
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              {home
                ? c(
                    "What changed in your investment decisions?",
                    "你的投资判断，发生了什么变化？",
                  )
                : c(
                    "One stock. The whole decision.",
                    "一只股票，完整的决策环境。",
                  )}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {c(
                "Bring creator opinions, market structure and your exposure into a thesis you can return to.",
                "将创作者观点、市场结构与真实持仓，汇成一条可以持续复核的投资判断。",
              )}
            </p>
            <TickerSearch />
            <div className="flex flex-wrap gap-2">
              {["NVDA", "TSLA", "AAPL", "MSFT"].map((ticker) => (
                <Link
                  key={ticker}
                  href={`/dashboard/research/${ticker}`}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  {ticker}
                </Link>
              ))}
            </div>
          </section>
          {loading && (
            <p role="status" className="text-sm text-muted-foreground">
              {c("Loading your decision context…", "正在加载决策环境…")}
            </p>
          )}
          {!!errors.length && (
            <p role="alert" className="text-sm text-muted-foreground">
              {c("Sources unavailable", "暂时无法加载的数据源")}:{" "}
              {errors.join(", ")}. {c("Refresh to retry.", "请刷新重试。")}
            </p>
          )}
          {home && (
            <Panel
              title={c("Your theses to revisit", "需要回顾的投资判断")}
              action={
                <Link
                  href="/dashboard/journal"
                  className="text-sm text-primary"
                >
                  {c("Open journal", "打开决策日志")}
                </Link>
              }
            >
              <ThesisWatch key={attempt} theses={active} />
              {!active.length && !loading && (
                <Empty>
                  {c(
                    "Start with a stock, write down why it matters, and come back to check whether that reason still holds.",
                    "从一只股票开始，记录关注它的理由，再回来检查这个理由是否仍然成立。",
                  )}
                </Empty>
              )}
            </Panel>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel
              title={c(
                "Discover through creator opinions",
                "通过创作者观点发现机会",
              )}
              action={
                <Link
                  href="/dashboard/youtube-opinions"
                  className="text-sm text-primary"
                >
                  {c("All opinions", "全部观点")}
                </Link>
              }
            >
              <div className="divide-y divide-border">
                {dashboard?.stocks.slice(0, 8).map((stock) => (
                  <div
                    key={stock.ticker}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div>
                      <WorkspaceLink ticker={stock.ticker} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {stock.company_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        {stock.creator_count} {c("creators", "位创作者")} ·{" "}
                        {stock.total_opinions} {c("opinions", "条观点")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {stock.bullish_count} {c("bullish", "看多")} /{" "}
                        {stock.bearish_count} {c("bearish", "看空")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {!dashboard?.stocks.length && !loading && (
                <Empty>
                  {c(
                    "Creator coverage will appear here when opinions are available.",
                    "有可用观点后，创作者覆盖的股票会出现在这里。",
                  )}
                </Empty>
              )}
            </Panel>
            <div className="space-y-6">
              <Panel
                title={c("Research your exposure", "研究自己的风险敞口")}
                action={
                  <Link
                    href="/dashboard/portfolio"
                    className="text-sm text-primary"
                  >
                    {c("Portfolio", "持仓")}
                  </Link>
                }
              >
                <div className="flex flex-wrap gap-3">
                  {holdings.slice(0, 20).map((ticker) => (
                    <WorkspaceLink key={ticker} ticker={ticker} />
                  ))}
                </div>
                {!holdings.length && (
                  <Empty>
                    {c(
                      "Connect an investment account in Portfolio to bring your holdings into each stock workspace.",
                      "在持仓页连接投资账户，将真实持仓带入每只股票的工作台。",
                    )}
                  </Empty>
                )}
              </Panel>
              <Panel
                title={c("Make your reasoning useful", "让判断可以被复盘")}
              >
                <BookOpen className="mb-3 h-6 w-6 text-primary" />
                <p className="text-sm leading-6 text-muted-foreground">
                  {c(
                    "A thesis keeps your direction, reasons, entry, target and invalidation together. Journal preserves how your thinking changes.",
                    "一条判断记录方向、理由、入场、目标和失效价。决策日志保留思考的演变过程。",
                  )}
                </p>
                <Link
                  href="/dashboard/journal"
                  className="mt-4 inline-block text-sm font-medium text-primary"
                >
                  {c("Your journal", "我的决策日志")}
                </Link>
              </Panel>
            </div>
          </div>
          {!!dashboard?.changes.length && (
            <Panel
              title={c(
                "Recent shifts in creator evidence",
                "近期创作者证据变化",
              )}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.changes.slice(0, 6).map((change) => (
                  <div
                    key={change.ticker}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3"
                  >
                    <WorkspaceLink ticker={change.ticker} />
                    <div className="text-right text-xs text-muted-foreground">
                      <p>
                        {change.change == null
                          ? "—"
                          : `${change.change > 0 ? "+" : ""}${change.change.toFixed(1)}`}{" "}
                        {c("direction score change", "方向分变化")}
                      </p>
                      <p className="mt-1">{change.current_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
