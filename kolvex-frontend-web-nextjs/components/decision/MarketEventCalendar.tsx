"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCachedResource } from "@/hooks/useCachedResource";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import StockBadge from "@/components/ui/stock-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calendarDays,
  EVENT_CATEGORIES,
  eventTime,
  eventOrder,
  type MarketCalendar,
} from "@/lib/marketEvents";
import { cn } from "@/lib/utils";
import { useCopy } from "./shared";

/** Event summary that shows the opening lines and only collapses the remainder. */
function EventSummary({ text, collapsible }: { text: string; collapsible: boolean }) {
  const c = useCopy();
  const [open, setOpen] = useState(false);
  const clamp = collapsible && text.length > 160;
  return (
    <div className="mt-2">
      <p
        className={cn(
          "whitespace-pre-line break-words text-sm leading-6 text-muted-foreground",
          clamp && !open && "line-clamp-4",
        )}
      >
        {text}
      </p>
      {clamp && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="mt-1 inline-flex min-h-8 items-center rounded-full px-1 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:underline motion-reduce:transition-none"
        >
          {open ? c("Show less", "收起详情") : c("Event details", "事件详情")}
        </button>
      )}
    </div>
  );
}

export default function MarketEventCalendar() {
  const c = useCopy();
  const english = c("en", "zh") === "en";
  const [week, setWeek] = useState("1");
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const isCalendar = view === "calendar";
  const calendarRoot = useRef<HTMLElement>(null);
  const [scrollBounds, setScrollBounds] = useState({ left: false, right: false });
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
  useEffect(() => {
    const scroller = calendarRoot.current?.querySelector<HTMLElement>("[data-calendar-scroll]");
    if (!scroller) {
      setScrollBounds({ left: false, right: false });
      return;
    }
    const measure = () => {
      const next = {
        left: scroller.scrollLeft > 1,
        right: scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1,
      };
      setScrollBounds(previous => previous.left === next.left && previous.right === next.right ? previous : next);
    };
    measure();
    scroller.addEventListener("scroll", measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(scroller);
    if (scroller.firstElementChild) resize.observe(scroller.firstElementChild);
    return () => {
      scroller.removeEventListener("scroll", measure);
      resize.disconnect();
    };
  }, [data, isCalendar, week]);

  function scrollDay(direction: -1 | 1) {
    const scroller = calendarRoot.current?.querySelector<HTMLElement>("[data-calendar-scroll]");
    if (!scroller) return;
    const grid = scroller.firstElementChild as HTMLElement | null;
    const day = grid?.firstElementChild as HTMLElement | null;
    const gap = grid ? parseFloat(getComputedStyle(grid).columnGap) || 0 : 0;
    const distance = day ? day.offsetWidth + gap : scroller.clientWidth;
    scroller.scrollBy({
      left: direction * distance,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  return (
    <section
      ref={calendarRoot}
      className="min-w-0 max-w-full pt-6"
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
          <SegmentedControl
            label={c("Event view", "事件视图")}
            value={view}
            onChange={setView}
            className="border border-border"
            itemClassName="min-h-9 px-4"
            options={[
              { value: "calendar", label: c("Calendar", "日历") },
              { value: "list", label: c("List", "列表") },
            ]}
          />
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
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {c("Refresh failed. Showing the previous calendar.", "刷新失败，正在显示上次的日历。")}
        </p>
      )}
      <Card className="mt-5 p-2.5 sm:p-4">
        {error && !data ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-2">
            <p className="text-sm">
              {c(
                "Calendar unavailable. Please retry.",
                "暂时无法加载事件日历，请重试。",
              )}
            </p>
            <Button variant="outline" size="sm" onClick={refresh}>
              {c("Retry", "重试")}
            </Button>
          </div>
        ) : !data ? (
          <div
            role="status"
            aria-label={c("Loading calendar", "正在加载日历")}
            className="space-y-3"
          >
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <Tabs value={week} onValueChange={setWeek} className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 pb-3">
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
              {isCalendar && (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="hidden text-xs text-muted-foreground sm:block">
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
            {[0, 1, 2].map((w) => {
              const days = calendarDays(data.start_date, w * 7);
              const events = data.events.filter((event) =>
                days.includes(event.event_date),
              );
              return (
                <TabsContent
                  key={w}
                  value={String(w)}
                  className="min-w-0 space-y-3"
                >
                  <p className="figure px-1 text-xs text-muted-foreground">
                    {days[0]} ~ {days[6]} · {events.length}{" "}
                    {c("events", "个事件")}
                  </p>
                  {!events.length && !isCalendar ? (
                    <p
                      role="status"
                      className="rounded-2xl border border-border p-6 text-sm text-muted-foreground"
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
                          ? "w-full min-w-0 max-w-full overscroll-x-contain overflow-x-auto pb-2 focus-visible:outline-none "
                          : undefined
                      }
                    >
                      <div
                        className={
                          isCalendar
                            ? "grid min-w-[168rem] grid-cols-7 items-stretch gap-4"
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
                              className={cn(
                                "flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-card",
                                isCalendar ? "p-4" : "p-5",
                                day === data.today
                                  ? "border-positive/70"
                                  : "border-border",
                              )}
                            >
                              <header className="mb-3 flex items-center justify-between gap-2">
                                <h3 className="figure flex flex-wrap items-center gap-2 text-sm font-semibold">
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
                                {items.length > 0 && (
                                  <span
                                    aria-label={c(
                                      `${items.length} events`,
                                      `${items.length} 个事件`,
                                    )}
                                    className="figure shrink-0 rounded-full border border-border/80 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                                  >
                                    {items.length}
                                  </span>
                                )}
                              </header>
                              {!items.length ? (
                                <p className="relative py-6 text-center text-sm text-muted-foreground">
                                  {c("No major events", "暂无重点事件")}
                                </p>
                              ) : (
                                <ul className="flex-1">
                                  {items.map((event, index) => {
                                    const title = english
                                      ? event.title_en || event.title
                                      : event.title;
                                    const summary = english
                                      ? event.summary_en || event.summary
                                      : event.summary;
                                    return (
                                      <li
                                        key={event.id}
                                        className={cn(
                                          "-mx-2 rounded-2xl px-2 py-3 transition-colors duration-150 hover:bg-primary/[0.07] motion-reduce:transition-none",
                                          index > 0 && "border-t border-border/60",
                                        )}
                                      >
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                          <span className="figure font-medium text-foreground/80">
                                            {eventTime(event, english)} ET
                                          </span>
                                          <span>
                                            {c(
                                              EVENT_CATEGORIES[event.category][0],
                                              EVENT_CATEGORIES[event.category][1],
                                            )}
                                          </span>
                                          {event.importance === "high" && (
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">
                                              {c("High impact", "重大")}
                                            </span>
                                          )}
                                          {event.is_hot && (
                                            <span className="rounded-full bg-negative/10 px-2 py-0.5 text-negative">
                                              {c("Trending", "热门")}
                                            </span>
                                          )}
                                        </div>
                                        {event.tickers.length > 0 && (
                                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                                            {event.tickers.map((ticker) => (
                                              <StockBadge
                                                key={ticker}
                                                symbol={ticker}
                                              />
                                            ))}
                                          </div>
                                        )}
                                        <h4 className="mt-2 break-words text-[15px] font-semibold leading-snug">
                                          {title}
                                        </h4>
                                        {summary && (
                                          <EventSummary
                                            text={summary}
                                            collapsible={isCalendar}
                                          />
                                        )}
                                        {event.source_url && (
                                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                                            <a
                                              href={event.source_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="min-w-0 break-words [overflow-wrap:anywhere] rounded underline underline-offset-4 focus-visible:outline-none "
                                            >
                                              {event.source_name ||
                                                c("Source", "来源")}{" "}
                                              ↗
                                            </a>
                                          </div>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
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
      </Card>
    </section>
  );
}
