"use client";

import { InfoTip } from "@/components/ui/info-tip";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { ACTIVITY_SESSIONS, runKey, runsKey, type ActivityRun, type RunList } from "@/lib/optionsActivity";
import { ContributionBoard, MarketOverview, SummaryCard, TickerLevels, UnusualContracts, useSessionLabel } from "./sections";

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
  const [date, setDate] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

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
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-[2rem]">{c("Options activity", "期权异动")}<InfoTip label={c("About options activity", "关于期权异动")}>{c("Where options money traded across a watchlist of liquid ETFs and stocks, three times each trading day. A starting point for research, not a trading signal.", "每个交易日三次，扫描一组高流动性 ETF 和个股的期权成交，看资金集中在哪里。这是研究的起点，不是交易信号。")}</InfoTip></h1>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
                <Select
                  value={activeDate ?? ""}
                  onValueChange={(next) => {
                    setDate(next);
                    setRunId(null);
                  }}
                  disabled={!list.data?.dates.length}
                >
                  <SelectTrigger aria-label={c("Trading day", "交易日")}>
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
                aria-label={c("Refresh", "刷新")}
                onClick={() => {
                  list.refresh();
                  run.refresh();
                }}
              >
                {run.refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </header>

          {data ? (
            <div className="space-y-10">
              <SummaryCard run={data} />
              <MarketOverview run={data} />
              <ContributionBoard run={data} />
              <UnusualContracts run={data} />
              <TickerLevels run={data} />
            </div>
          ) : failure && !run.loading ? (
            <div className="rounded-lg border border-border px-6 py-10 text-center text-sm text-muted-foreground">
              <p>{errorText[failure] ?? errorText.unavailable}</p>
              {failure === "unavailable" && (
                <Button variant="outline" size="sm" className="mt-4" onClick={run.refresh}>
                  {c("Try again", "重试")}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6" aria-busy="true">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
