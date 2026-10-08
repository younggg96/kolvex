"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { listTheses, thesisHistory, type Thesis } from "@/lib/decision";
import {
  DirectionBadge,
  Empty,
  Panel,
  TickerSearch,
  WorkspaceLink,
  money,
  useCopy,
} from "./shared";
import ThesisEditor from "./ThesisEditor";
import ThesisWatch from "./ThesisWatch";
import { useDecisionCommand } from "./CommandLayer";
import { getMyHoldings } from "@/lib/portfolioApi";

export default function Journal({ embedded = false }: { embedded?: boolean }) {
  const c = useCopy();
  const { setContext } = useDecisionCommand();
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [heldTickers, setHeldTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState("active");
  const [editing, setEditing] = useState<Thesis | null>(null);
  const [history, setHistory] = useState<{
    id: string;
    items: Thesis[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      listTheses(),
      embedded ? getMyHoldings() : Promise.resolve(null),
    ])
      .then(([data, holdings]) => {
        if (alive) {
          setTheses(data.items);
          setHeldTickers(
            holdings
              ? [
                  ...new Set(
                    holdings.accounts
                      .flatMap((account) => account.portfolio_positions || [])
                      .filter((position) => position.position_type !== "option")
                      .map((position) => position.symbol),
                  ),
                ]
              : [],
          );
        }
      })
      .catch((reason) => {
        if (alive) setError(reason.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [attempt, embedded]);
  async function showHistory(id: string) {
    if (history?.id === id) {
      setHistory(null);
      return;
    }
    setHistory({ id, items: [] });
    try {
      const data = await thesisHistory(id);
      setHistory((previous) =>
        previous?.id === id ? { id, items: data.items } : previous,
      );
    } catch (reason) {
      setHistory((previous) =>
        previous?.id === id
          ? {
              id,
              items: [],
              error:
                reason instanceof Error
                  ? reason.message
                  : "History unavailable",
            }
          : previous,
      );
    }
  }
  const visible = theses.filter(
    (thesis) => filter === "all" || thesis.status === filter,
  );
  const active = theses.filter(
    (thesis) =>
      thesis.status === "active" &&
      (!embedded || heldTickers.includes(thesis.ticker)),
  );
  const commandContext = JSON.stringify({
    workspace: embedded ? "Portfolio thesis review" : "Decision journal",
    heldTickers,
    theses: theses.slice(0, 20),
    error: error || null,
  });
  useEffect(() => {
    setContext(commandContext);
    return () => setContext("");
  }, [commandContext, setContext]);
  const content = (
    <>
      {!embedded && (
        <section className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            {c("Keep the reason. Review the decision.", "保留理由，复盘决策。")}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {c(
              "Your investment theses, their plans, and how your reasoning changed over time.",
              "你的投资判断、行动计划，以及理由如何随时间改变。",
            )}
          </p>
          <TickerSearch />
        </section>
      )}
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          {c("Loading your theses…", "正在加载投资判断…")}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
        >
          <p>{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {c("Retry", "重试")}
          </Button>
        </div>
      )}
      {!error && (
        <Panel
          title={
            embedded
              ? c("Thesis review", "投资判断复核")
              : c("Check what changed", "检查发生了什么变化")
          }
          action={
            <span className="text-xs text-muted-foreground">
              {c(
                "Current quote and creator evidence · checked on page load",
                "当前报价与创作者证据 · 页面加载时检查",
              )}
            </span>
          }
        >
          <ThesisWatch key={attempt} theses={active} />
          {!active.length && !loading && (
            <Empty>
              {c(
                "No active theses. Open a stock workspace and save your reasoning to start tracking a decision.",
                "暂无活跃判断。打开股票工作台，保存理由，开始追踪一项决策。",
              )}
            </Empty>
          )}
        </Panel>
      )}
      {!embedded && (
        <Panel
          title={c("Your decision journal", "我的决策日志")}
          action={
            <div className="flex gap-1">
              {[
                ["active", c("Active", "活跃")],
                ["closed", c("Closed", "已结束")],
                ["all", c("All", "全部")],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={filter === value ? "secondary" : "ghost"}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          }
        >
          <div className="divide-y divide-border">
            {visible.map((thesis) => (
              <article key={thesis.thesis_id} className="py-5">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <WorkspaceLink ticker={thesis.ticker} />
                    <DirectionBadge direction={thesis.direction} />
                    <span className="text-xs text-muted-foreground">
                      v{thesis.version} ·{" "}
                      {thesis.status === "active"
                        ? c("Active", "活跃")
                        : c("Closed", "已结束")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => showHistory(thesis.thesis_id)}
                    >
                      {c("History", "历史")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(thesis)}
                    >
                      {c("Review thesis", "复盘判断")}
                    </Button>
                  </div>
                </header>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                  {thesis.reasoning}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                  <div>
                    <dt>{c("Entry", "入场")}</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {money(thesis.entry_low)}
                      {thesis.entry_high
                        ? ` – ${money(thesis.entry_high)}`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>{c("Invalidation", "失效价")}</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {money(thesis.invalidation)}
                    </dd>
                  </div>
                  <div>
                    <dt>{c("Target", "目标")}</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {money(thesis.target)}
                    </dd>
                  </div>
                  <div>
                    <dt>{c("Horizon", "周期")}</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {thesis.horizon}
                    </dd>
                  </div>
                </dl>
                {thesis.review && (
                  <p className="mt-4 whitespace-pre-wrap border-l-2 border-primary/40 pl-3 text-sm leading-6">
                    {thesis.review}
                  </p>
                )}
                {history?.id === thesis.thesis_id && (
                  <section className="mt-5 rounded-lg bg-muted/40 p-4">
                    <h3 className="mb-3 text-sm font-medium">
                      {c("Reasoning history", "判断演变")}
                    </h3>
                    {history.error ? (
                      <p role="alert" className="text-sm text-red-500">
                        {history.error}
                      </p>
                    ) : !history.items.length ? (
                      <p
                        role="status"
                        className="text-sm text-muted-foreground"
                      >
                        {c("Loading history…", "加载历史中…")}
                      </p>
                    ) : (
                      <ol className="space-y-4">
                        {history.items.map((version) => (
                          <li
                            key={version.id}
                            className="border-l border-border pl-4"
                          >
                            <p className="text-xs text-muted-foreground">
                              v{version.version} ·{" "}
                              {new Date(version.created_at).toLocaleString()} ·{" "}
                              {version.direction} · {version.status}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                              {version.reasoning}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {c("Entry", "入场")} {money(version.entry_low)} –{" "}
                              {money(version.entry_high)} ·{" "}
                              {c("Invalidation", "失效价")}{" "}
                              {money(version.invalidation)} ·{" "}
                              {c("Target", "目标")} {money(version.target)}
                            </p>
                            {version.review && (
                              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                                {version.review}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                )}
              </article>
            ))}
          </div>
          {!visible.length && !loading && !error && (
            <Empty>
              {c("No theses in this view yet.", "这里暂时没有投资判断。")}
            </Empty>
          )}
        </Panel>
      )}
      {embedded && (
        <Link
          href="/dashboard/journal"
          className="inline-block text-sm text-primary"
        >
          {c("Open full decision journal", "打开完整决策日志")}
        </Link>
      )}
      {editing && (
        <ThesisEditor
          ticker={editing.ticker}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setTheses((previous) => [
              saved,
              ...previous.filter((x) => x.thesis_id !== saved.thesis_id),
            ]);
            setEditing(null);
            setHistory(null);
          }}
        />
      )}
    </>
  );
  if (embedded) return <div className="mb-8 space-y-4">{content}</div>;
  return (
    <DashboardLayout
      title={c("Journal", "决策日志")}
      headerActions={
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => setAttempt((n) => n + 1)}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {c("Refresh", "刷新")}
        </Button>
      }
    >
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 md:px-8">
          {content}
        </div>
      </main>
    </DashboardLayout>
  );
}
