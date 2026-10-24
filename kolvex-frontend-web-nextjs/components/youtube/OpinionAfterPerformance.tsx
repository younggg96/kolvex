"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { getStockHistory } from "@/lib/stockApi";
import { opinionDay, formatOpinionDate } from "@/lib/opinionDates";
import { opinionPerformance } from "@/lib/opinionPerformance";
import { cn } from "@/lib/utils";

export default function OpinionAfterPerformance({ ticker, published }: { ticker: string; published: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [result, setResult] = useState<ReturnType<typeof opinionPerformance>>(null);
  const regionId = `opinion-performance-${ticker.replace(/[^a-z0-9]/gi, "-")}`;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setState("loading");
    const today = opinionDay(new Date().toISOString());
    const day = opinionDay(published);
    if (!day || day >= today) { setResult(null); setState("ready"); return () => controller.abort(); }
    getStockHistory(ticker, { start: day, end: today, interval: "1d" }, controller.signal)
      .then(bars => { if (!controller.signal.aborted) { setResult(opinionPerformance(bars, day, today)); setState("ready"); } })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [open, ticker, published, attempt]);
  return <div className="min-w-0">
    <Button variant="ghost" size="xs" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen(value => !value)}>
      {t(open ? "youtubeOpinions.directory.hideAfter" : "youtubeOpinions.directory.showAfter")}
    </Button>
    {open && <div id={regionId} className="mt-2 max-w-sm space-y-1 text-xs text-muted-foreground" role="status" aria-busy={state === "loading"}>
      {state === "loading" ? <p>{t("common.loadingStatus")}</p> : state === "error" ? <div className="flex items-center gap-2"><span>{t("youtubeOpinions.directory.afterError")}</span><Button size="xs" variant="outline" onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</Button></div>
        : result ? <p>{t("youtubeOpinions.directory.afterRange", { from: formatOpinionDate(result.from, t("common.intlLocale")), to: formatOpinionDate(result.to, t("common.intlLocale")) })} <strong className={cn("tabular-nums", result.percent > 0 ? "text-positive" : result.percent < 0 ? "text-negative" : "text-foreground")}>{result.percent > 0 ? "+" : ""}{result.percent.toFixed(2)}%</strong></p>
          : <p>{t("youtubeOpinions.directory.afterEmpty")}</p>}
      <p>{t("youtubeOpinions.directory.afterMethod")}</p>
    </div>}
  </div>;
}
