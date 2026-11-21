"use client";

import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  XHS_DAYS_PATH,
  XHS_STANCES,
  XhsNotFound,
  countsTotal,
  dominantStance,
  isIsoDate,
  neighbours,
  readXhsDay,
  readXhsDays,
  stanceLabel,
  xhsDayPath,
  type XhsDaySummary,
} from "@/lib/xhsSentiment";
import XhsDayView, { STANCE_FILL, formatPtDate } from "./XhsDayView";

const CACHE = { ttl: 60_000, maxAge: 10 * 60_000, timeout: 20_000 };

/** 30-day strip: one stacked column per imported day, oldest on the left. */
function Trend({
  days,
  selected,
  onSelect,
}: {
  days: XhsDaySummary[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  const c = useCopy();
  const { locale } = useTranslation();
  const lang = locale === "zh" ? "zh" : "en";
  if (days.length < 2) return null;
  return (
    <section aria-label={c("Recent days", "近期情绪")} className="w-fit max-w-full space-y-1.5">
      <ol className="flex h-14 items-end gap-1 overflow-x-auto pb-1">
        {[...days].reverse().map((day) => {
          const counts = day.sentiment.all;
          const total = countsTotal(counts) || 1;
          const dominant = dominantStance(counts);
          const active = day.date_pt === selected;
          const label = `${formatPtDate(day.date_pt, lang)} · ${
            dominant ? stanceLabel(dominant, lang) : c("No single lean", "没有单一倾向")
          }`;
          return (
            <li key={day.date_pt} className="h-full w-6 min-w-[10px] shrink">
              <button
                type="button"
                onClick={() => onSelect(day.date_pt)}
                aria-label={label}
                aria-current={active ? "date" : undefined}
                title={label}
                className={cn(
                  "flex h-full w-full flex-col-reverse overflow-hidden rounded-md border transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
                  active ? "border-foreground" : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                {XHS_STANCES.map(({ key }) => (
                  <span
                    key={key}
                    className={STANCE_FILL[key]}
                    style={{ height: `${(counts[key] / total) * 100}%` }}
                  />
                ))}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="flex justify-between gap-4 text-xs text-muted-foreground">
        <span>{formatPtDate(days.at(-1)!.date_pt, lang, false)}</span>
        <span>{formatPtDate(days[0].date_pt, lang, false)}</span>
      </p>
    </section>
  );
}

function DayLoading() {
  const c = useCopy();
  return (
    <ContentLoading label={c("Loading the digest", "正在加载情绪日报")}>
      <Card className="space-y-4 p-5">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </ContentLoading>
  );
}

function Retry({
  message,
  onRetry,
  busy,
}: {
  message: string;
  onRetry: () => void;
  busy: boolean;
}) {
  const c = useCopy();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm"
    >
      <p>{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={busy}>
        {c("Retry", "重试")}
      </Button>
    </div>
  );
}

export default function XhsSentimentPage() {
  const c = useCopy();
  const { locale } = useTranslation();
  const lang = locale === "zh" ? "zh" : "en";
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const requested = search.get("date");

  const days = useCachedResource(XHS_DAYS_PATH, readXhsDays, CACHE);
  const list = days.data ?? [];
  const selected = isIsoDate(requested) ? requested : list[0]?.date_pt;
  const day = useCachedResource(
    selected ? xhsDayPath(selected) : "xhs:none",
    selected ? readXhsDay(selected) : async () => null,
    { ...CACHE, enabled: Boolean(selected) },
  );
  const { older, newer } = selected ? neighbours(list, selected) : { older: null, newer: null };
  const busy = days.loading || days.refreshing || day.loading || day.refreshing;

  const select = (date: string | null) => {
    if (!date) return;
    const next = new URLSearchParams(search.toString());
    if (date === list[0]?.date_pt) next.delete("date");
    else next.set("date", date);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const refresh = () => {
    days.refresh();
    day.refresh();
  };

  let body: React.ReactNode;
  if (days.loading && !days.data) body = <DayLoading />;
  else if (days.error && !days.data)
    body = (
      <Retry
        message={c("Could not load the digest.", "暂时无法加载小红书情绪。")}
        onRetry={refresh}
        busy={busy}
      />
    );
  else if (!selected)
    body = (
      <p role="status" className="py-16 text-center text-sm text-muted-foreground">
        {c("No digest has been imported yet.", "还没有导入任何一天的情绪日报。")}
      </p>
    );
  else if (day.error instanceof XhsNotFound)
    body = (
      <div role="status" className="py-16 text-center text-sm text-muted-foreground">
        <p>{c("No digest for this date.", "这一天没有情绪日报。")}</p>
        {list[0] && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => select(list[0].date_pt)}
          >
            {c("Show the latest day", "查看最新一天")}
          </Button>
        )}
      </div>
    );
  else if (day.error && !day.data)
    body = (
      <Retry
        message={c("Could not load this day.", "暂时无法加载这一天的内容。")}
        onRetry={day.refresh}
        busy={busy}
      />
    );
  else if (!day.data) body = <DayLoading />;
  else body = <XhsDayView day={day.data} />;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-5 px-[16px] pb-8 pt-[12px] md:px-8 md:py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:text-[2rem]">
            {c("Xiaohongshu sentiment", "小红书情绪")}
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => select(older)}
              disabled={!older}
              aria-label={c("Previous day", "前一天")}
              title={c("Previous day", "前一天")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <span className="min-w-[6.5rem] text-center text-sm font-medium tabular-nums">
              {selected ? formatPtDate(selected, lang) : "—"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => select(newer)}
              disabled={!newer}
              aria-label={c("Next day", "后一天")}
              title={c("Next day", "后一天")}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={refresh}
              disabled={busy}
              aria-label={c("Refresh", "刷新")}
              title={c("Refresh", "刷新")}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
        {Boolean(days.error) && days.data && (
          <p role="status" className="text-sm text-muted-foreground">
            {c("Could not refresh. Showing saved days.", "暂时无法刷新，正在显示上次读取的内容。")}
          </p>
        )}
        {selected && <Trend days={list} selected={selected} onSelect={select} />}
        {body}
      </div>
    </div>
  );
}
