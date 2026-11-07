"use client";

import * as React from "react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Repeats a skeleton row `count` times. */
export function SkeletonRepeat({ count, children }: { count: number; children: (index: number) => React.ReactNode }) {
  return <>{Array.from({ length: count }, (_, i) => <React.Fragment key={i}>{children(i)}</React.Fragment>)}</>;
}

/**
 * Cold-load wrapper for a skeleton. `children` must mirror the layout that replaces it
 * (same containers, grids and row heights), so nothing shifts when data arrives.
 * Fades in after 300ms so fast reads never flash a placeholder; the label is read to
 * screen readers only.
 */
export function ContentLoading({ label, className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return <div role="status" aria-busy="true" className={cn("flex min-w-0 animate-[content-loading-in_200ms_ease-out_300ms_both] flex-col motion-reduce:animate-none", className)}>
    <span className="sr-only">{label ?? t("common.loadingStatus")}</span>
    <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col">{children}</div>
  </div>;
}

/** A value still on its way inside a row whose identity is already shown. Distinct from the "—" of missing data. */
export function PendingValue({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("flex items-center justify-end", className)}>
    <span className="h-0.5 w-8 animate-pulse rounded-full bg-muted-foreground/50 motion-reduce:animate-none" />
  </span>;
}
