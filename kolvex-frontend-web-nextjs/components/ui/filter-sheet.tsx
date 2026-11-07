"use client";

import * as React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Phone filter pattern: one icon button (its label names the current view)
 * that opens a bottom sheet holding every filter and sort. Pages render their inline
 * desktop controls from `lg` up and this trigger below it (the trigger hides
 * itself at `lg`). Choices apply immediately; Done only closes the sheet.
 */
export function FilterSheet({ title, summary, active = false, onReset, children, className, triggerClassName }: {
  title: string;
  /** Short description of the current view, read out by the trigger and the sheet. */
  summary?: string;
  /** True when anything differs from the default view; marks the trigger and shows Reset. */
  active?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
  className?: string;
  triggerClassName?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-haspopup="dialog"
          aria-label={summary ? `${title} · ${summary}` : title} title={summary ? `${title} · ${summary}` : title}
          className={cn("relative h-10 w-10 shrink-0 rounded-full lg:hidden", triggerClassName)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {active && <span aria-hidden="true" className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-foreground" />}
        </Button>
      </DialogTrigger>
      <DialogContent layout="sheet" className={cn("flex flex-col lg:hidden", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{summary ?? title}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-1">{children}</div>
        <div className="mt-5 flex shrink-0 gap-2">
          {active && onReset && <Button type="button" variant="outline" className="gap-2" onClick={onReset}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{t("common.reset")}</Button>}
          <DialogClose asChild><Button type="button" className="flex-1">{t("common.done")}</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const chipClass = (selected: boolean) => cn(
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
  selected ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
);

/** A single-choice group of chips inside a FilterSheet. */
export function FilterSheetGroup<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: React.ReactNode; disabled?: boolean }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-medium text-muted-foreground">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map(option => (
          <button key={option.value} type="button" role="radio" aria-checked={option.value === value} disabled={option.disabled}
            className={chipClass(option.value === value)} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** An on/off chip inside a FilterSheet (e.g. "Watchlist only"). */
export function FilterSheetToggle({ label, pressed, onChange, disabled, children }: {
  label: string;
  pressed: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-medium text-muted-foreground">{label}</legend>
      <button type="button" aria-pressed={pressed} disabled={disabled} className={chipClass(pressed)} onClick={() => onChange(!pressed)}>{children}</button>
    </fieldset>
  );
}
