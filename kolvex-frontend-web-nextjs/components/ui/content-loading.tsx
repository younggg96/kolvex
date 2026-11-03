"use client";

import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Cold-load status; fades in after 300ms so fast reads never flash a placeholder. */
export function ContentLoading({ label, className }: { label?: string; className?: string }) {
  const { t } = useTranslation();
  return <div role="status" aria-busy="true" className={cn("flex min-h-24 min-w-0 animate-[content-loading-in_200ms_ease-out_300ms_both] items-center justify-center gap-2 text-sm text-muted-foreground motion-reduce:animate-none", className)}>
    <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />
    <span className="min-w-0">{label ?? t("common.loadingStatus")}</span>
  </div>;
}

/** A value still on its way inside a row whose identity is already shown. Distinct from the "—" of missing data. */
export function PendingValue({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("flex items-center justify-end", className)}>
    <span className="h-0.5 w-8 animate-pulse rounded-full bg-muted-foreground/50 motion-reduce:animate-none" />
  </span>;
}
