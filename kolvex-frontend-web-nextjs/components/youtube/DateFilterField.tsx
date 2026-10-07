"use client";

import { useId, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useTranslation } from "@/lib/i18n";

export default function DateFilterField({ label, value, onChange, min, max }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  const id = useId();
  const { t } = useTranslation();
  const calendarLocale = { "zh-CN": zhCN, "en-US": enUS }[t("common.intlLocale")] ?? enUS;
  const [open, setOpen] = useState(false);
  // Date-only filters stay in local calendar time, without UTC conversion.
  const selected = value ? parseISO(value) : undefined;
  const from = min ? parseISO(min) : undefined;
  const to = max ? parseISO(max) : undefined;

  return <div className="grid min-w-0 gap-1.5">
    <label htmlFor={id} className="text-xs text-muted-foreground">{label}</label>
    <Button id={id} type="button" variant="outline" aria-label={label} aria-expanded={open} aria-controls={`${id}-calendar`} onClick={() => setOpen(!open)} className="h-11 w-full min-w-0 justify-start gap-2 px-3 font-normal">
      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={value ? "truncate tabular-nums" : "truncate text-muted-foreground"}>{value || label}</span>
    </Button>
    {open && <div id={`${id}-calendar`} className="min-w-0 border border-border p-2">
      <Calendar mode="single" locale={calendarLocale} selected={selected} defaultMonth={selected || from || to} initialFocus
        className="[--rdp-background-color:rgb(var(--muted))] [--rdp-background-color-dark:rgb(var(--muted))] [--rdp-accent-color:rgb(var(--primary))] [--rdp-accent-color-dark:rgb(var(--primary))]"
        classNames={{ head_row: "grid grid-cols-7", head_cell: "text-center text-xs text-muted-foreground", row: "mt-1 grid grid-cols-7", cell: "relative min-w-0 text-center text-sm", day: "h-9 w-full rounded-md p-0 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary" }}
        disabled={(date) => Boolean((from && date < from) || (to && date > to))}
        onSelect={(date) => { onChange(date ? format(date, "yyyy-MM-dd") : ""); setOpen(false); }} />
      {value && <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => { onChange(""); setOpen(false); }}><X className="mr-2 h-4 w-4" />{t("youtubeOpinions.reset")}</Button>}
    </div>}
  </div>;
}
