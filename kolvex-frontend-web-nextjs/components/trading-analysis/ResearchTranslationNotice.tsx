"use client";

import Link from "next/link";
import { AlertCircle, Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResearchTranslationControl } from "@/hooks/useResearchTranslation";

/** One-line language bar above a research report: switch to the original, or request a translation. */
export function ResearchTranslationNotice({ control, t, className }: {
  control: ResearchTranslationControl;
  t: (key: string) => string;
  className?: string;
}) {
  const { state, showOriginal, setShowOriginal, translate, error } = control;
  if (state === "original") return null;

  const base = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-foreground/[0.04] px-3 py-2 text-xs leading-5 text-muted-foreground";
  const link = "rounded font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (state === "translated") {
    return (
      <p className={cn(base, className)}>
        <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{t(showOriginal ? "tradingAnalysis.translation.showingOriginal" : "tradingAnalysis.translation.showingTranslation")}</span>
        <button type="button" className={link} onClick={() => setShowOriginal(!showOriginal)}>
          {t(showOriginal ? "tradingAnalysis.translation.viewTranslation" : "tradingAnalysis.translation.viewOriginal")}
        </button>
      </p>
    );
  }

  if (state === "translating") {
    return (
      <p role="status" className={cn(base, className)}>
        <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />
        <span className="min-w-0 flex-1">{t("tradingAnalysis.translation.translating")}</span>
      </p>
    );
  }

  if (state === "error") {
    const notConfigured = error === "ai_not_configured";
    return (
      <div role="alert" className={cn(base, "text-warning", className)}>
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{t(notConfigured ? "tradingAnalysis.translation.notConfigured" : "tradingAnalysis.translation.failed")}</span>
        {notConfigured
          ? <Link href="/dashboard/settings?tab=api-keys" className={link}>{t("tradingAnalysis.translation.openSettings")}</Link>
          : <Button size="sm" variant="ghost" onClick={() => void translate()}>{t("tradingAnalysis.translation.retry")}</Button>}
      </div>
    );
  }

  return (
    <div className={cn(base, className)}>
      <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{t("tradingAnalysis.translation.missing")}</span>
      <Button size="sm" variant="outline" onClick={() => void translate()}>{t("tradingAnalysis.translation.translate")}</Button>
    </div>
  );
}
