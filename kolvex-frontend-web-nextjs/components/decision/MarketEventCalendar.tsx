"use client";
import { useEffect, useState } from "react";
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
  const [data, setData] = useState<MarketCalendar | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let controller = new AbortController();
    async function load() {
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setLoading(true);
      setError(false);
      try {
        const response = await fetch("/api/market/events", {
          signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error();
        const result: MarketCalendar = await response.json();
        if (!signal.aborted) setData(result);
      } catch {
        if (!signal.aborted) setError(true);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    void load();
    // Refresh the server-defined window after a sleeping tab resumes or the date rolls over.
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 60_000);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [attempt]);
  return (
    <section
      className="space-y-6 pt-6"
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
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => setAttempt((n) => n + 1)}
        >
          {c("Refresh", "刷新")}
        </Button>
      </div>
      {error ? (
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
            onClick={() => setAttempt((n) => n + 1)}
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
        <Tabs value={week} onValueChange={setWeek}>
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
              <TabsContent key={w} value={String(w)} className="mt-4 space-y-4">
                <p className="figure text-sm text-muted-foreground">
                  {days[0]} ~ {days[6]} · {events.length}{" "}
                  {c("events", "个事件")}
                </p>
                {!events.length ? (
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
                  days.map((day) => {
                    const items = events
                      .filter((event) => event.event_date === day)
                      .sort(
                        (a, b) =>
                          eventOrder(a) - eventOrder(b) ||
                          a.id.localeCompare(b.id),
                      );
                    if (!items.length) return null;
                    return (
                      <section
                        key={day}
                        className="rounded-xl border border-border bg-card p-4"
                      >
                        <h3 className="figure mb-4 text-sm font-semibold">
                          <time dateTime={day}>
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
                            <span className="ml-2 text-positive">
                              {c("Today", "今天")}
                            </span>
                          )}
                        </h3>
                        <ul className="divide-y divide-border">
                          {items.map((event) => (
                            <li
                              key={event.id}
                              className="py-4 first:pt-0 last:pb-0"
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
                                : event.summary) && (
                                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">
                                  {english
                                    ? event.summary_en || event.summary
                                    : event.summary}
                                </p>
                              )}
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
                                    className="rounded underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                  >
                                    {event.source_name || c("Source", "来源")} ↗
                                  </a>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </section>
  );
}
