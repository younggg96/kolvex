"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Shape of the content that is on its way:
 * - list: rows with an avatar and two lines (default)
 * - rows: compact single-line rows (menus, sidebars, dropdowns)
 * - text: a paragraph
 * - block: one large area (charts, images)
 * - grid: metric tiles
 * - page: a page heading over a few cards
 * - form: labelled inputs and a button
 */
export type ContentLoadingVariant = "list" | "rows" | "text" | "block" | "grid" | "page" | "form";

const widths = ["w-[72%]", "w-[58%]", "w-[66%]", "w-[50%]", "w-[62%]"];

function Shape({ variant, rows }: { variant: ContentLoadingVariant; rows: number }) {
  const n = Array.from({ length: rows }, (_, i) => i);
  switch (variant) {
    case "rows":
      return <div className="flex flex-col gap-2 py-1">{n.map(i => <Skeleton key={i} className={cn("h-4 rounded-md", widths[i % widths.length])} />)}</div>;
    case "text":
      return <div className="flex flex-col gap-2.5">{n.map(i => <Skeleton key={i} className={cn("h-3.5 rounded-md", i === rows - 1 ? "w-[45%]" : "w-full")} />)}</div>;
    case "block":
      return <Skeleton className="h-full min-h-[inherit] w-full flex-1" />;
    case "grid":
      return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{n.map(i => <div key={i} className="flex flex-col gap-2 rounded-2xl border border-foreground/5 p-4"><Skeleton className="h-3 w-1/2 rounded-md" /><Skeleton className="h-5 w-3/4 rounded-md" /></div>)}</div>;
    case "page":
      return <div className="flex flex-col gap-6 py-6">
        <div className="flex flex-col gap-2"><Skeleton className="h-7 w-48 rounded-lg" /><Skeleton className="h-4 w-72 max-w-full rounded-md" /></div>
        <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-64" />
      </div>;
    case "form":
      return <div className="flex flex-col gap-4">
        {n.map(i => <div key={i} className="flex flex-col gap-2"><Skeleton className="h-3.5 w-24 rounded-md" /><Skeleton className="h-11 w-full rounded-xl" /></div>)}
        <Skeleton className="mt-2 h-11 w-full rounded-full" />
      </div>;
    default:
      return <div className="flex flex-col gap-4 py-1">{n.map(i => <div key={i} className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2"><Skeleton className={cn("h-3.5 rounded-md", widths[i % widths.length])} /><Skeleton className={cn("h-3 rounded-md", i % 2 ? "w-[30%]" : "w-[40%]")} /></div>
      </div>)}</div>;
  }
}

const defaultRows: Record<ContentLoadingVariant, number> = { list: 3, rows: 4, text: 4, block: 1, grid: 4, page: 1, form: 2 };

/** Cold-load skeleton; fades in after 300ms so fast reads never flash a placeholder. The label is read to screen readers only. */
export function ContentLoading({ label, className, variant = "list", rows }: { label?: string; className?: string; variant?: ContentLoadingVariant; rows?: number }) {
  const { t } = useTranslation();
  return <div role="status" aria-busy="true" className={cn("flex min-h-24 min-w-0 animate-[content-loading-in_200ms_ease-out_300ms_both] flex-col motion-reduce:animate-none", className)}>
    <span className="sr-only">{label ?? t("common.loadingStatus")}</span>
    <div aria-hidden="true" className="flex min-h-[inherit] min-w-0 flex-1 flex-col"><Shape variant={variant} rows={rows ?? defaultRows[variant]} /></div>
  </div>;
}

/** A value still on its way inside a row whose identity is already shown. Distinct from the "—" of missing data. */
export function PendingValue({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("flex items-center justify-end", className)}>
    <span className="h-0.5 w-8 animate-pulse rounded-full bg-muted-foreground/50 motion-reduce:animate-none" />
  </span>;
}
