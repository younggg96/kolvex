"use client";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listTheses, riskReward, thesisHistory, type Thesis } from "@/lib/decision";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Change,
  DirectionBadge,
  Empty,
  Panel,
  PriceLadder,
  TickerSearch,
  WorkspaceLink,
  money,
  useCopy,
  useHeldTickers,
} from "./shared";
import ThesisEditor from "./ThesisEditor";
import ThesisWatch, { useThesisSignals } from "./ThesisWatch";
import { useDecisionCommand } from "./CommandLayer";

type Filter = "active" | "closed" | "all";

export default function Journal() {
  const c = useCopy();
  const { t } = useTranslation();
  const { setContext } = useDecisionCommand();
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>("active");
  const [editing, setEditing] = useState<Thesis | null>(null);
  const [history, setHistory] = useState<{ id: string; items: Thesis[]; error?: string } | null>(null);
  const held = useHeldTickers(attempt);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    listTheses()
      .then((data) => alive && setTheses(data.items))
      .catch((reason) => alive && setError(reason.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [attempt]);

  async function showHistory(id: string) {
    if (history?.id === id) {
      setHistory(null);
      return;
    }
    setHistory({ id, items: [] });
    try {
      const data = await thesisHistory(id);
      setHistory((previous) => (previous?.id === id ? { id, items: data.items } : previous));
    } catch (reason) {
      setHistory((previous) =>
        previous?.id === id
          ? { id, items: [], error: reason instanceof Error ? reason.message : "History unavailable" }
          : previous,
      );
    }
  }

  const active = useMemo(() => theses.filter((thesis) => thesis.status === "active"), [theses]);
  const signals = useThesisSignals(active);
  const flagged = active.filter((thesis) => signals.changesFor(thesis).length);
  const visible = theses.filter((thesis) => filter === "all" || thesis.status === filter);
  const counts = {
    active: active.length,
    closed: theses.length - active.length,
    all: theses.length,
  };
  const sep = c(", ", "，");
  const date = (value: string) => new Date(value).toLocaleDateString(t("common.intlLocale"), { year: "numeric", month: "short", day: "numeric" });

  const commandContext = JSON.stringify({
    workspace: "Decision journal",
    heldTickers: held.tickers,
    theses: theses.slice(0, 20),
    needsReview: flagged.map((thesis) => thesis.ticker),
    error: error || null,
  });
  useEffect(() => {
    setContext(commandContext);
    return () => setContext("");
  }, [commandContext, setContext]);

  const headline = loading
    ? null
    : error
      ? c("Your journal could not be loaded", "决策日志暂时无法加载")
      : !theses.length
        ? c("Write down why, before you act", "行动之前，先写下理由")
        : signals.checking && !flagged.length
          ? c("Checking your theses…", "正在检查你的判断…")
          : flagged.length
            ? c(`${flagged.length} ${flagged.length === 1 ? "thesis needs" : "theses need"} review`, `${flagged.length} 条判断需要复核`)
            : c("Every active thesis is within plan", "所有判断都在计划内");

  return (
    <DashboardLayout
      title={c("Journal", "决策日志")}
      headerActions={
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => setAttempt((n) => n + 1)}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "motion-safe:animate-spin")} />
          {c("Refresh", "刷新")}
        </Button>
      }
    >
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1080px] space-y-12 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <section className="flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0" aria-live="polite">
              {headline === null ? (
                <>
                  <Skeleton className="h-10 w-72 max-w-full" />
                  <Skeleton className="mt-3 h-4 w-56" />
                </>
              ) : (
                <>
                  <h1
                    className={cn(
                      "text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[32px]",
                      flagged.length > 0 && "text-warning",
                    )}
                  >
                    {headline}
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    {error ? (
                      <span role="alert">{error}</span>
                    ) : theses.length ? (
                      c(
                        `${active.length} active, ${counts.closed} closed. Price and creator views are checked each time you open this page.`,
                        `${active.length} 条进行中，${counts.closed} 条已结束。每次打开页面时检查价格和博主观点。`,
                      )
                    ) : (
                      c(
                        "A thesis records your reason, entry, target and what would prove you wrong. Kolvex checks it against price and creator views.",
                        "一条判断记录你的理由、入场价、目标价，以及什么会证明你错了。Kolvex 会用价格和博主观点替你检查。",
                      )
                    )}
                  </p>
                  {error && (
                    <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => setAttempt((n) => n + 1)}>
                      {c("Retry", "重试")}
                    </Button>
                  )}
                </>
              )}
            </div>
            <TickerSearch className="lg:w-[340px]" placeholder={c("Start a thesis: NVDA, AAPL…", "为一只股票写判断：NVDA…")} />
          </section>

          {flagged.length > 0 && (
            <Panel
              title={c("Needs review", "需要复核")}
              description={c("Price crossed your plan or creators changed their view since you saved.", "保存之后，价格越过了你的计划，或博主改变了看法。")}
            >
              <ThesisWatch theses={flagged} signals={signals} heldTickers={held.tickers} />
            </Panel>
          )}

          {!error && theses.length > 0 && (
            <Panel
              title={c("Decision journal", "决策日志")}
              action={
                <div role="radiogroup" aria-label={c("Filter theses", "筛选判断")} className="inline-flex items-center gap-0.5 rounded-full bg-muted p-1">
                  {(
                    [
                      ["active", c("Active", "进行中")],
                      ["closed", c("Closed", "已结束")],
                      ["all", c("All", "全部")],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={filter === value}
                      onClick={() => setFilter(value)}
                      className={cn(
                        "h-7 rounded-full px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        filter === value
                          ? "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label} <span className="tabular-nums opacity-70">{counts[value]}</span>
                    </button>
                  ))}
                </div>
              }
            >
              <div className="divide-y divide-border">
                {visible.map((thesis) => {
                  const source = signals.data[thesis.ticker];
                  const rr = riskReward(thesis);
                  return (
                    <article key={thesis.thesis_id} className="py-6">
                      <header className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-lg">
                            <WorkspaceLink ticker={thesis.ticker} held={held.tickers.includes(thesis.ticker)} />
                          </span>
                          <DirectionBadge direction={thesis.direction} />
                          <span className="text-xs text-muted-foreground">
                            {[thesis.horizon, `v${thesis.version}`, date(thesis.created_at), ...(thesis.status === "closed" ? [c("closed", "已结束")] : [])].join(sep)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="rounded-full" aria-expanded={history?.id === thesis.thesis_id} onClick={() => showHistory(thesis.thesis_id)}>
                            {c("History", "历史版本")}
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setEditing(thesis)}>
                            {c("Review", "复盘")}
                          </Button>
                        </div>
                      </header>
                      <div className="mt-4 grid gap-x-10 gap-y-5 md:grid-cols-[minmax(0,1fr)_300px]">
                        <p className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-7">{thesis.reasoning}</p>
                        <div className="min-w-0">
                          {thesis.status === "active" && (
                            <p className="flex items-baseline justify-between gap-3 text-[13px]">
                              <span className="text-muted-foreground">{c("Now", "现价")}</span>
                              <span>
                                <span className="figure font-semibold">{money(source?.quote?.price)}</span>{" "}
                                <Change value={source?.quote?.changePercent} className="text-xs" />
                              </span>
                            </p>
                          )}
                          <PriceLadder
                            direction={thesis.direction}
                            invalidation={thesis.invalidation}
                            entryLow={thesis.entry_low}
                            entryHigh={thesis.entry_high}
                            target={thesis.target}
                            price={thesis.status === "active" ? source?.quote?.price : null}
                          />
                          {rr && (
                            <p className="mt-3 flex justify-between border-t border-border pt-3 text-[13px]">
                              <span className="text-muted-foreground">{c("Risk / reward", "风险收益比")}</span>
                              <span className="figure font-semibold">1 : {rr.toFixed(2)}</span>
                            </p>
                          )}
                          {thesis.direction !== "neutral" && (thesis.invalidation === null || thesis.target === null) && (
                            <p className="text-[13px] text-muted-foreground">
                              {c("No price plan yet. Add a target and invalidation when you review.", "还没有价格计划。复盘时补上目标价和失效价。")}
                            </p>
                          )}
                        </div>
                      </div>
                      {thesis.review && (
                        <div className="mt-5 max-w-[68ch] rounded-xl bg-muted/60 px-4 py-3">
                          <h3 className="text-xs font-semibold text-muted-foreground">{c("Review notes", "复盘笔记")}</h3>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{thesis.review}</p>
                        </div>
                      )}
                      {history?.id === thesis.thesis_id && (
                        <section className="mt-6" aria-label={c("Reasoning history", "判断演变")}>
                          <h3 className="text-sm font-semibold">{c("How your reasoning changed", "判断是怎么变化的")}</h3>
                          {history.error ? (
                            <p role="alert" className="mt-3 text-sm text-negative">{history.error}</p>
                          ) : !history.items.length ? (
                            <p role="status" className="mt-3 text-sm text-muted-foreground">{c("Loading history…", "加载历史中…")}</p>
                          ) : (
                            <ol className="mt-3 space-y-5 border-l border-border pl-5">
                              {history.items.map((version) => (
                                <li key={version.id} className="relative">
                                  <span aria-hidden className="absolute -left-[23.5px] top-1.5 h-2 w-2 rounded-full bg-foreground/40 ring-4 ring-background" />
                                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    <span className="font-semibold text-foreground">v{version.version}</span>
                                    <span>{new Date(version.created_at).toLocaleString(t("common.intlLocale"))}</span>
                                    <DirectionBadge direction={version.direction} className="text-xs" />
                                    {version.status === "closed" && <span>{c("Closed", "已结束")}</span>}
                                  </p>
                                  <p className="mt-2 max-w-[68ch] whitespace-pre-wrap text-sm leading-6">{version.reasoning}</p>
                                  <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                                    {c("Entry", "入场")} {money(version.entry_low)}
                                    {version.entry_high ? `–${money(version.entry_high)}` : ""}{sep}{c("invalidation", "失效")} {money(version.invalidation)}{sep}{c("target", "目标")} {money(version.target)}
                                  </p>
                                  {version.review && (
                                    <p className="mt-2 max-w-[68ch] whitespace-pre-wrap text-sm text-muted-foreground">{version.review}</p>
                                  )}
                                </li>
                              ))}
                            </ol>
                          )}
                        </section>
                      )}
                    </article>
                  );
                })}
              </div>
              {!visible.length && !loading && (
                <Empty>{c("No theses in this view.", "这里暂时没有判断。")}</Empty>
              )}
            </Panel>
          )}
        </div>
      </main>
      {editing && (
        <ThesisEditor
          ticker={editing.ticker}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setTheses((previous) => [saved, ...previous.filter((x) => x.thesis_id !== saved.thesis_id)]);
            setEditing(null);
            setHistory(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
