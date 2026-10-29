"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";
import { BRIEF_TYPES, isBriefType, briefLibraryHref, briefReadingFilters, formatBriefDate, shiftBriefDate, type BriefSearchParams, type DailyBrief } from "@/lib/dailyBriefs";
import BriefCalendar from "./BriefCalendar";
import BriefContent from "./BriefContent";
import BriefState from "./BriefState";
import { useBriefData } from "./useBriefData";

export default function BriefLibrary({ searchParams }: { searchParams?: BriefSearchParams }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { type, date, id } = briefReadingFilters(searchParams);
  const { data, loading, error, retry } = useBriefData<{ payload: DailyBrief }>(`?id=${encodeURIComponent(id)}`);
  useEffect(() => { document.title = `${data?.payload.brief.headline || t("briefs.title")} | Kolvex`; }, [data, t]);

  return <DashboardLayout title={t("briefs.title")}>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-10 pt-6 md:px-8 md:pt-8">
      <div className="mx-auto max-w-[1080px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" aria-label={`${t("briefs.chooseDate")}：${formatBriefDate(date, locale)}`}>
                <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
                {formatBriefDate(date, locale)}
                <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" collisionPadding={16} aria-label={t("briefs.calendarLabel")} className="max-h-[var(--radix-popover-content-available-height)] max-w-[calc(100vw-2rem)] overflow-y-auto p-0">
              <BriefCalendar date={date} type={type} onSelectDate={() => setCalendarOpen(false)} />
            </PopoverContent>
          </Popover>
          <nav aria-label={t("briefs.dateNavigation")} className="flex gap-2">
            <Button asChild size="icon" variant="outline" title={t("briefs.previousDay")}><Link href={briefLibraryHref(type, 1, shiftBriefDate(date, -1))} aria-label={t("briefs.previousDay")}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Link></Button>
            <Button asChild size="icon" variant="outline" title={t("briefs.nextDay")}><Link href={briefLibraryHref(type, 1, shiftBriefDate(date, 1))} aria-label={t("briefs.nextDay")}><ChevronRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
          </nav>
        </div>
        <Tabs value={type} onValueChange={value => router.push(briefLibraryHref(isBriefType(value) ? value : "morning", 1, date))}>
          <div className="mb-6 flex flex-wrap items-center gap-x-4 border-b border-border">
            <TabsList aria-label={t("briefs.filterLabel")} className="min-w-0 flex-1 gap-3 border-0 sm:gap-5">
              {BRIEF_TYPES.map(edition => <TabsTrigger key={edition} value={edition}>{t(`briefs.${edition}`)}</TabsTrigger>)}
            </TabsList>
            <Button variant="ghost" size="sm" disabled={loading} onClick={retry}><RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />{t("common.refresh")}</Button>
          </div>
          <TabsContent value={type}>
            {error && data && <p role="alert" className="mb-4 text-sm text-muted-foreground">{t("common.error")} <Button variant="outline" size="sm" onClick={retry}>{t("common.retry")}</Button></p>}
            {loading || (error && error !== 404 && !data) ? <BriefState loading={loading} error={error} retry={retry} /> : error === 404 ? <div className="space-y-3 py-12 text-center">
              <h2 className="text-xl font-semibold">{t("briefs.emptyEdition", { edition: t(`briefs.${type}`) })}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{t("briefs.emptyEditionDetail")}</p>
            </div> : data && <BriefContent key={id} document={data.payload} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </DashboardLayout>;
}
