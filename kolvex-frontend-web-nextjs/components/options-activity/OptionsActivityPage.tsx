"use client";

import { InfoTip } from "@/components/ui/info-tip";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { ACTIVITY_SESSIONS, runKey, runsKey, type ActivityRun, type RunList } from "@/lib/optionsActivity";
import { ContributionBoard, MarketOverview, ResearchCandidates, SummaryCard, TickerLevels, UnusualContracts, useSessionLabel, type Filter } from "./sections";

class ActivityError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function load<T>(key: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(key, { signal, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ActivityError(typeof body?.error === "string" ? body.error : "unavailable", response.status);
  return body;
}

export default function OptionsActivityPage() {
  const c = useCopy();
  const { locale } = useTranslation();
  const sessionLabel = useSessionLabel();
  const router = useRouter();
  const searchParams = useSearchParams();
  // The day, the run and the contract group live in the URL so a view can be shared
  // and reloaded exactly as it was read.
  const [date, setDate] = useState<string | null>(() => searchParams.get("date"));
  const [runId, setRunId] = useState<string | null>(null);
  const kindParam = searchParams.get("kind");
  const kind: Filter = kindParam === "etf" || kindParam === "stock" ? kindParam : "all";

  const setQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const query = next.toString();
      router.replace(`/dashboard/options-activity${query ? `?${query}` : ""}`, { scroll: false });
    },
    [router, searchParams],
  );

  const list = useCachedResource<RunList>(runsKey(date), (signal) => load(runsKey(date), signal), { ttl: 60_000, timeout: 25_000 });
  // A picked date with no explicit run shows that day's latest run.
  const dayRuns = list.data?.runs ?? [];
  const effectiveId = runId ?? (date ? dayRuns[dayRuns.length - 1]?.id ?? null : null);
  const waitingForDay = Boolean(date && !runId && !list.data);
  const run = useCachedResource<ActivityRun>(runKey(effectiveId), (signal) => load(runKey(effectiveId), signal), {
    ttl: 60_000,
    timeout: 25_000,
    enabled: !waitingForDay,
  });
  const data = run.data;
  const runsForPicker = date ? dayRuns : data?.day_runs ?? [];
  const wantedSession = searchParams.get("session");

  // A session in the URL picks that run once the day's runs are known.
  useEffect(() => {
    if (!wantedSession || data?.session === wantedSession) return;
    const runs = date ? list.data?.runs ?? [] : data?.day_runs ?? [];
    const match = runs.find((r) => r.session === wantedSession);
    if (match && match.id !== runId) setRunId(match.id);
  }, [wantedSession, data, date, list.data, runId]);
  const activeDate = data?.trade_date ?? date ?? list.data?.date ?? null;

  const failure = run.error instanceof ActivityError ? run.error.code : run.error ? "unavailable" : null;
  const errorText: Record<string, string> = {
    no_runs: c(
      "No report yet. The first one appears after the next scheduled run (09:00, 12:30 or 16:20 ET on trading days).",
      "还没有报告。交易日美东 09:00、12:30、16:20 定时运行后会出现第一份。",
    ),
    unauthorized: c("Sign in to view the options activity report.", "登录后可查看期权异动报告。"),
    unavailable: c("The report could not be loaded. Try again.", "报告加载失败，请重试。"),
  };
  const dateLabel = (value: string) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      weekday: "short",
    });

  return (
    <DashboardLayout title={c("Options activity", "期权异动")}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-[16px] pb-12 pt-4 md:px-8 md:py-8">
          <header className="mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-[2rem]">
                {c("Options activity", "期权异动")}
                <InfoTip label={c("About options activity", "关于期权异动")}>
                  {c("Where options money traded across a watchlist of liquid ETFs and stocks, three times each trading day. A starting point for research, not a trading signal.", "每个交易日三次，扫描一组高流动性 ETF 和个股的期权成交，看资金集中在哪里。这是研究的起点，不是交易信号。")}
                </InfoTip>
              </h1>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 rounded-3xl border border-foreground/10 glass-card bg-card-glass p-2 sm:w-auto sm:flex-nowrap">
              <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
                <Select
                  value={activeDate ?? ""}
                  onValueChange={(next) => {
                    setDate(next);
                    setRunId(null);
                    setQuery({ date: next, session: null });
                  }}
                  disabled={!list.data?.dates.length}
                >
                  <SelectTrigger aria-label={c("Trading day", "交易日")} className="h-10 border-foreground/10 bg-foreground/[0.04]">
                    <SelectValue placeholder={c("Trading day", "交易日")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(list.data?.dates ?? []).map((value) => (
                      <SelectItem key={value} value={value}>
                        {dateLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SegmentedControl
                size="sm"
                label={c("Run", "运行时点")}
                value={data?.session ?? null}
                onChange={(session) => {
                  const match = runsForPicker.find((r) => r.session === session);
                  if (match) setRunId(match.id);
                  setQuery({ session });
                }}
                options={ACTIVITY_SESSIONS.map((session) => ({
                  value: session,
                  label: sessionLabel(session),
                  disabled: !runsForPicker.some((r) => r.session === session),
                }))}
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={c("Refresh", "刷新")}
                title={c("Refresh", "刷新")}
                onClick={() => {
                  list.refresh();
                  run.refresh();
                }}
              >
                {run.refreshing
                  ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </div>
          </header>

          {data ? (
            <div className="space-y-8 md:space-y-10">
              <SummaryCard run={data} />
              <ResearchCandidates run={data} />
              <MarketOverview run={data} />
              <ContributionBoard run={data} />
              <UnusualContracts run={data} filter={kind} onFilterChange={(next) => setQuery({ kind: next === "all" ? null : next })} />
              <TickerLevels run={data} />
            </div>
          ) : failure && !run.loading ? (
            <div role="alert" className="flex min-h-44 flex-col items-center justify-center rounded-3xl border border-foreground/10 glass-card bg-card-glass px-6 py-10 text-center">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="max-w-lg text-sm leading-6 text-muted-foreground">{errorText[failure] ?? errorText.unavailable}</p>
              {failure === "unavailable" && (
                <Button variant="outline" size="sm" className="mt-5" onClick={run.refresh}>
                  {c("Try again", "重试")}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-8 md:space-y-10" aria-busy="true" role="status" aria-label={c("Loading options activity", "正在加载期权异动")}>
              <div className="space-y-4 rounded-3xl border border-foreground/10 glass-card bg-card-glass p-5 md:p-6">
                <Skeleton className="h-5 w-32 rounded-md" />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-5/6 rounded-md" />
                  <Skeleton className="h-4 w-2/3 rounded-md" />
                </div>
                <Skeleton className="h-3 w-48 rounded-md" />
              </div>
              <div className="space-y-5">
                <Skeleton className="h-6 w-40 rounded-md" />
                <div className="grid grid-cols-2 gap-4 rounded-3xl border border-foreground/10 glass-card bg-card-glass p-5 sm:grid-cols-4 md:p-6">
                  {[0, 1, 2, 3].map((item) => <div key={item} className="space-y-2"><Skeleton className="h-3 w-20 rounded-md" /><Skeleton className="h-6 w-24 rounded-md" /></div>)}
                </div>
              </div>
              <div className="space-y-4">
                <Skeleton className="h-6 w-44 rounded-md" />
                <div className="space-y-2">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-14 w-full rounded-2xl" />)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
