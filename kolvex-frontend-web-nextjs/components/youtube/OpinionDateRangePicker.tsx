"use client";

import { useState } from "react";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function parseDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDayValue(date: Date | undefined) {
  return date ? format(date, "yyyy-MM-dd") : "";
}

export default function OpinionDateRangePicker({
  from,
  to,
  active,
  compact = false,
  triggerClassName,
  onApply,
  onReset,
}: {
  from: string;
  to: string;
  active: boolean;
  compact?: boolean;
  triggerClassName?: string;
  onApply: (range: { from: string; to: string }) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const invalid = Boolean(draft.from && draft.to && draft.from > draft.to);
  const locale = t("common.intlLocale") === "zh-CN" ? zhCN : enUS;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft({ from, to });
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="radio"
          aria-checked={active}
          className={cn(triggerClassName, "max-w-full gap-1.5")}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {active ? `${from || "…"} – ${to || "…"}` : t("common.custom")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={compact ? "end" : "start"}
        sideOffset={8}
        collisionPadding={16}
        className="!w-[284px] !max-w-[calc(100vw-2rem)] max-h-[var(--radix-popover-content-available-height)] overflow-x-hidden overflow-y-auto p-3"
      >
        <p className="text-sm font-semibold">{t("youtubeOpinions.customRange")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <Label className="text-xs font-normal text-muted-foreground">
              {t("youtubeOpinions.dateFrom")}
            </Label>
            <p className="mt-1 truncate text-sm tabular-nums">
              {draft.from || "—"}
            </p>
          </div>
          <div className="min-w-0">
            <Label className="text-xs font-normal text-muted-foreground">
              {t("youtubeOpinions.dateTo")}
            </Label>
            <p className="mt-1 truncate text-sm tabular-nums">
              {draft.to || "—"}
            </p>
          </div>
        </div>
        <Calendar
          mode="range"
          numberOfMonths={1}
          locale={locale}
          selected={{ from: parseDay(draft.from), to: parseDay(draft.to) }}
          defaultMonth={parseDay(draft.from) || parseDay(draft.to)}
          onSelect={(range: DateRange | undefined) =>
            setDraft({
              from: formatDayValue(range?.from),
              to: formatDayValue(range?.to),
            })
          }
          className="mt-2 w-full p-0"
          classNames={{
            months: "flex w-full flex-col",
            month: "w-full space-y-3",
            caption: "relative flex h-8 items-center justify-center",
            caption_label: "text-sm font-medium",
            nav: "flex items-center",
            nav_button:
              "inline-flex h-7 w-7 items-center justify-center rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            nav_button_previous: "absolute left-0",
            nav_button_next: "absolute right-0",
            table: "w-full border-collapse",
            head_row: "grid grid-cols-7",
            head_cell: "text-center text-xs font-normal text-muted-foreground",
            row: "mt-1 grid grid-cols-7",
            cell: "relative min-w-0 p-0 text-center text-sm first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md [&:has([aria-selected])]:bg-muted",
            day: "inline-flex h-9 w-full items-center justify-center rounded-md p-0 text-sm font-normal hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-selected:opacity-100",
            day_range_start: "day-range-start",
            day_range_end: "day-range-end",
          }}
        />
        {invalid && (
          <p role="alert" className="mt-2 text-xs text-negative">
            {t("youtubeOpinions.invalidDateRange")}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => {
              onReset();
              setOpen(false);
            }}
          >
            {t("youtubeOpinions.resetDates")}
          </Button>
          <Button
            type="button"
            size="xs"
            disabled={invalid || (!draft.from && !draft.to)}
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            {t("youtubeOpinions.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
