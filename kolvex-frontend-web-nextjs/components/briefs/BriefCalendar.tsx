"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DayContent, type DayContentProps } from "react-day-picker";
import { enUS, zhCN } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { briefCalendarDate, briefDateKey, briefLibraryHref, formatBriefDate, pacificBriefToday, type BriefCalendarData, type BriefFilter } from "@/lib/dailyBriefs";
import { useBriefData } from "./useBriefData";

type Availability = Map<string, string[]>;
const CalendarAvailability = createContext<{ days: Availability; status: "loading" | "error" | "ready" }>({ days: new Map(), status: "loading" });

function BriefDay(props: DayContentProps) {
  const { t, locale } = useTranslation();
  const { days, status } = useContext(CalendarAvailability);
  const available = days.get(briefDateKey(props.date)) ?? [];
  return <span className="relative flex h-full w-full items-center justify-center pb-1">
    <span aria-hidden="true"><DayContent {...props} /></span>
    <span className="sr-only">{formatBriefDate(briefDateKey(props.date), locale)}，{status === "loading" ? t("briefs.loadingDates") : status === "error" ? t("common.error") : available.length ? available.map(kind => t(`briefs.${kind}`)).join(" / ") : t("briefs.noIssue")}</span>
    <span aria-hidden="true" className="absolute bottom-1 left-0 flex w-full justify-center gap-1">
      {available.includes("morning") && <span className="h-1 w-1 rounded-full bg-current" />}
      {available.includes("evening") && <span className="h-1 w-1 rounded-full border border-current" />}
    </span>
  </span>;
}

export default function BriefCalendar({ date, type, onSelectDate }: { date: string; type: BriefFilter; onSelectDate?: () => void }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [month, setMonth] = useState(() => briefCalendarDate(date));
  useEffect(() => { setMonth(briefCalendarDate(date)); }, [date]);
  const monthKey = briefDateKey(month).slice(0, 7);
  const { data, loading, error, retry } = useBriefData<BriefCalendarData>(`?calendar=1&month=${monthKey}`);
  const available = useMemo<Availability>(() => new Map(data?.days.map(day => [day.date, day.types]) ?? []), [data]);
  const today = pacificBriefToday();
  return <aside aria-label={t("briefs.calendarLabel")} className="rounded-xl border border-border bg-card p-4">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">{t("briefs.calendarLabel")}</h2>
    </div>
    <CalendarAvailability.Provider value={{ days: available, status: loading ? "loading" : error ? "error" : "ready" }}>
      <Calendar
        mode="single"
        required
        initialFocus
        locale={locale === "zh" ? zhCN : enUS}
        month={month}
        onMonthChange={setMonth}
        today={briefCalendarDate(today)}
        selected={briefCalendarDate(date)}
        onSelect={value => { if (value) { router.push(briefLibraryHref(type, 1, briefDateKey(value))); onSelectDate?.(); } }}
        showOutsideDays={false}
        fixedWeeks
        className="mx-auto w-fit"
        classNames={{
          day_selected: "bg-foreground text-background hover:!bg-foreground hover:!text-background focus:!bg-foreground focus:!text-background",
          day_today: "ring-1 ring-inset ring-border",
        }}
        components={{ DayContent: BriefDay }}
        labels={{
          labelPrevious: () => t("briefs.previousMonth"),
          labelNext: () => t("briefs.nextMonth"),
          labelWeekday: value => new Intl.DateTimeFormat(t("common.intlLocale"), { weekday: "long" }).format(value),
        }}
      />
    </CalendarAvailability.Provider>
    <div className="mt-4 flex items-center justify-center gap-5 text-xs text-muted-foreground">
      <span className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{t("briefs.morning")}</span>
      <span className="flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full border border-current" />{t("briefs.evening")}</span>
    </div>
    <div className="mt-3 min-h-5 text-center text-xs leading-5 text-muted-foreground" aria-live="polite">
      {loading ? t("briefs.loadingDates") : error ? <span>{t("briefs.calendarError")} <button type="button" onClick={retry} className="cursor-pointer underline underline-offset-4 focus-visible:outline focus-visible:outline-2">{t("common.retry")}</button></span> : t("briefs.pacificDates")}
    </div>
    <Button asChild variant="outline" size="sm" className="mt-3 w-full"><Link href={briefLibraryHref(type, 1, today)} onClick={onSelectDate}>{t("briefs.today")}</Link></Button>
  </aside>;
}
