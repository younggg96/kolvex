"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Same breakpoint as Tailwind's `sm`: below it a section opens as a bottom sheet. */
const PHONE_QUERY = "(max-width: 639.98px)";

/**
 * A collapsible chart section ("画线图层", "AI 图表操作"). One header row everywhere: icon, label,
 * quiet summary, chevron. Larger screens expand it in place; phones open the body in a bottom
 * sheet so the chart never gets pushed around.
 */
export default function ChartSection({
  icon,
  label,
  summary,
  summaryClassName,
  open,
  onOpenChange,
  dismissKey,
  closeLabel,
  className,
  children,
}: {
  icon: ReactNode;
  label: string;
  summary?: ReactNode;
  summaryClassName?: string;
  /** Inline expansion on larger screens. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Closes the sheet whenever it changes, e.g. when an action it started begins running. */
  dismissKey?: unknown;
  closeLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => { setSheetOpen(false); }, [dismissKey]);

  function toggle() {
    let phone = false;
    try { phone = window.matchMedia(PHONE_QUERY).matches; } catch { /* Treat as desktop. */ }
    if (phone) setSheetOpen(true);
    else onOpenChange(!open);
  }

  return (
    <div className={cn("shrink-0", className)}>
      <button
        type="button"
        aria-expanded={open || sheetOpen}
        aria-haspopup="dialog"
        onClick={toggle}
        className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl px-2 text-left text-sm transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="shrink-0 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">{icon}</span>
        <span className="shrink-0 font-medium">{label}</span>
        {summary && <span className={cn("min-w-0 truncate text-muted-foreground", summaryClassName)}>{summary}</span>}
        <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "sm:rotate-180")} aria-hidden="true" />
      </button>
      {open && <div className="px-2 pb-2 pt-1 max-sm:hidden">{children}</div>}

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent layout="sheet" showCloseButton={false} className="flex flex-col px-4 pt-2" onEscapeKeyDown={(event) => event.stopPropagation()}>
          <div className="mx-auto mb-2 h-1 w-9 shrink-0 rounded-full bg-foreground/20 sm:hidden" aria-hidden="true" />
          <div className="flex shrink-0 items-center gap-2 pb-3">
            <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">{icon}</span>
            <DialogTitle className="text-base font-semibold">{label}</DialogTitle>
            <DialogDescription className="sr-only">{typeof summary === "string" ? summary : label}</DialogDescription>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="-mr-2 ml-auto min-h-11 min-w-11" aria-label={closeLabel}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
          <div className="-mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">{children}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
