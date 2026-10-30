"use client";
import { useEffect, useState } from "react";
import { useCachedResource } from "@/hooks/useCachedResource";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calendarDays,
  EVENT_CATEGORIES,
  eventTime,
  eventOrder,
  type MarketCalendar,
} from "@/lib/marketEvents";
import { useCopy } from "./shared";

export default function MarketEventCalendar() {
  const c = useCopy();
  const english = c("en", "zh") === "en";
  const [week, setWeek] = useState("1");
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const isCalendar = view === "calendar";
  const { data, error, loading, refreshing, refresh, revalidate } = useCachedResource<MarketCalendar>(
    "/api/market/events",
    async signal => {
      const response = await fetch("/api/market/events", { signal, cache: "no-store" });
      if (!response.ok) throw Object.assign(new Error("Calendar unavailable"), { status: response.status });
      return response.json();
    },
    { ttl: 60_000, maxAge: 5 * 60_000 },
  );
  useEffect(() => {
    // Recheck freshness on resume; keep the server-defined calendar window current.
    const resume = () => { if (!document.hidden) revalidate(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    const timer = setInterval(resume, 60_000);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [revalidate]);
  return (
    <section
      ref={calendarRoot}
      className="min-w-0 max-w-full space-y-6 pt-6"
      aria-labelledby="events-heading"
      aria-busy={loading}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="events-heading" className="text-xl font-semibold">
            {c("Events to watch", "重大事件日历")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {c(
              "Earnings, Fed decisions and major releases · US Eastern time · Monday to Sunday",
              "关注财报、美联储及重要数据 · 美东时间 · 周一至周日",
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label={c("Event view", "事件视图")}
            className="inline-flex gap-1 rounded-full border border-border p-1"
          >
            {(["calendar", "list"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={view === mode ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
              >
                {mode === "calendar"
                  ? c("Calendar", "日历")
                  : c("List", "列表")}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || refreshing}
            onClick={refresh}
          >
            {c("Refresh", "刷新")}
          </Button>
        </div>
      </div>
      {Boolean(error) && data && (
        <p role="status" className="text-sm text-muted-foreground">
          {c("Refresh failed. Showing the previous calendar.", "刷新失败，正在显示上次的日历。")}
        </p>
      )}
      {error && !data ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-border p-4"
        >
          <p className="text-sm">
            {c(
              "Calendar unavailable. Please retry.",
              "暂时无法加载事件日历，请重试。",
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
          >
            {c("Retry", "重试")}
          </Button>
        </div>
      ) : !data ? (
        <div
          role="status"
          aria-label={c("Loading calendar", "正在加载日历")}
          className="space-y-4"
        >
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <Tabs value={week} onValueChange={setWeek} className="min-w-0">
          <TabsList aria-label={c("Calendar week", "日历周")}>
            {[
              c("Last week", "上周"),
              c("This week", "本周"),
              c("Next week", "下周"),
            ].map((label, i) => (
              <TabsTrigger key={i} value={String(i)}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {[0, 1, 2].map((w) => {
            const days = calendarDays(data.start_date, w * 7);
            const events = data.events.filter((event) =>
              days.includes(event.event_date),
            );
            return (
              <TabsContent
                key={w}
                value={String(w)}
                className="mt-4 min-w-0 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <p className="figure">
                    {days[0]} ~ {days[6]} · {events.length}{" "}
                    {c("events", "个事件")}
                  </p>
                  {isCalendar && (
                    <div className="flex items-center gap-3">
                      <p>
                        {c("Scroll to see all days", "左右滑动查看全部日期")}
                      </p>
                      <div
                        role="group"
                        aria-label={c("Scroll calendar", "滚动日历")}
                        className="flex gap-2"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          disabled={!scrollBounds.left}
                          onClick={() => scrollDay(-1)}
                          aria-label={c("Scroll left one day", "向左滚动一天")}
                          title={c("Scroll left one day", "向左滚动一天")}
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          disabled={!scrollBounds.right}
                          onClick={() => scrollDay(1)}
                          aria-label={c("Scroll right one day", "向右滚动一天")}
                          title={c("Scroll right one day", "向右滚动一天")}
                        >
                          <ChevronRight
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {!events.length && !isCalendar ? (
                  <p
                    role="status"
                    className="rounded-xl border border-border p-6 text-sm text-muted-foreground"
                  >
                    {c(
                      "No published major events this week. Check again after the calendar is updated.",
                      "该周暂无已发布的重点事件，管理员更新后会显示在这里。",
                    )}
                  </p>
                ) : (
                  <div
                    data-calendar-scroll={isCalendar ? "" : undefined}
                    role={isCalendar ? "region" : undefined}
                    aria-label={
                      isCalendar
                        ? c(
                            "Weekly event calendar, scroll horizontally to see all days",
                            "每周事件日历，可横向滚动查看全部日期",
                          )
                        : undefined
                    }
                    tabIndex={isCalendar ? 0 : undefined}
                    className={
                      isCalendar
                        ? "w-full min-w-0 max-w-full overscroll-x-contain overflow-x-auto rounded-xl pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        : undefined
                    }
                  >
                    <div
                      className={
                        isCalendar
                          ? "grid min-w-[132rem] grid-cols-7 items-stretch gap-3"
                          : "space-y-4"
                      }
                    >
                      {days.map((day) => {
                        const items = events
                          .filter((event) => event.event_date === day)
                          .sort(
                            (a, b) =>
                              eventOrder(a) - eventOrder(b) ||
                              a.id.localeCompare(b.id),
                          );
                        if (!items.length && !isCalendar) return null;
                        return (
                          <section
                            key={day}
                            aria-label={day}
                            className={`min-w-0 rounded-xl border bg-card p-4 ${day === data.today ? "border-positive" : "border-border"}`}
                          >
                            <h3 className="figure mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
                              <time
                                dateTime={day}
                                aria-current={
                                  day === data.today ? "date" : undefined
                                }
                              >
                                {new Intl.DateTimeFormat(
                                  english ? "en-US" : "zh-CN",
                                  {
                                    timeZone: "UTC",
                                    month: "short",
                                    day: "numeric",
                                    weekday: "short",
                                  },
                                ).format(new Date(`${day}T12:00:00Z`))}
                              </time>
                              {day === data.today && (
                                <span className="text-positive">
                                  {c("Today", "今天")}
                                </span>
                              )}
                            </h3>
                            {!items.length && (
                              <p className="py-4 text-sm text-muted-foreground">
                                {c("No major events", "暂无重点事件")}
                              </p>
                            )}
                            <ul
                              className={
                                isCalendar
                                  ? "space-y-3"
                                  : "divide-y divide-border"
                              }
                            >
                              {items.map((event) => (
                                <li
                                  key={event.id}
                                  className={
                                    isCalendar
                                      ? "rounded-lg border border-border bg-background p-3"
                                      : "py-4 first:pt-0 last:pb-0"
                                  }
                                >
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className="figure">
                                      {eventTime(event, english)} ET
                                    </span>
                                    <span>
                                      {c(
                                        EVENT_CATEGORIES[event.category][0],
                                        EVENT_CATEGORIES[event.category][1],
                                      )}
                                    </span>
                                    {event.importance === "high" && (
                                      <span className="rounded-full bg-muted px-2 py-1 text-foreground">
                                        {c("High impact", "重大")}
                                      </span>
                                    )}
                                    {event.is_hot && (
                                      <span className="rounded-full bg-negative/10 px-2 py-1 text-negative">
                                        {c("Trending", "热门")}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="mt-2 break-words text-base font-semibold">
                                    {english
                                      ? event.title_en || event.title
                                      : event.title}
                                  </h4>
                                  {(english
                                    ? event.summary_en || event.summary
                                    : event.summary) &&
                                    (isCalendar ? (
                                      <details className="mt-2 text-sm text-muted-foreground">
                                        <summary className="cursor-pointer rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                          {c("Event details", "事件详情")}
                                        </summary>
                                        <p className="mt-2 whitespace-pre-line break-words leading-6">
                                          {english
                                            ? event.summary_en || event.summary
                                            : event.summary}
                                        </p>
                                      </details>
                                    ) : (
                                      <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">
                                        {english
                                          ? event.summary_en || event.summary
                                          : event.summary}
                                      </p>
                                    ))}
                                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                                    {event.tickers.map((ticker) => (
                                      <span
                                        key={ticker}
                                        className="figure rounded-full bg-muted px-2 py-1"
                                      >
                                        {ticker}
                                      </span>
                                    ))}
                                    {event.source_url && (
                                      <a
                                        href={event.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="min-w-0 break-words [overflow-wrap:anywhere] rounded underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                      >
                                        {event.source_name ||
                                          c("Source", "来源")}{" "}
                                        ↗
                                      </a>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </section>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </section>
  );
}
