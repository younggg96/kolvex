"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import { CNN_FEAR_GREED_URL, type FearGreedRating, type FearGreedSnapshot } from "@/lib/fearGreed";
import { cn } from "@/lib/utils";
import { useCopy } from "./shared";

const ratings: Record<FearGreedRating, string> = {
  "extreme fear": "极度恐惧", fear: "恐惧", neutral: "中性", greed: "贪婪", "extreme greed": "极度贪婪",
};

export default function FearGreedCard() {
  const c = useCopy();
  const { locale } = useTranslation();
  const [snapshot, setSnapshot] = useState<FearGreedSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceOnly, setSourceOnly] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    fetch("/api/market/fear-greed", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json() as Promise<FearGreedSnapshot | { status: "source_only" }>;
      })
      .then(data => {
        if (controller.signal.aborted) return;
        const sourceOnly = data.status === "source_only";
        setSourceOnly(sourceOnly);
        setSnapshot(sourceOnly ? null : data as FearGreedSnapshot);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  const tone = snapshot?.rating.includes("fear") ? "text-negative" : snapshot?.rating.includes("greed") ? "text-positive" : "text-muted-foreground";
  const change = snapshot?.previousClose == null ? null : snapshot.score - snapshot.previousClose;
  const date = snapshot ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(snapshot.timestamp)) : null;
  return (
    <article aria-label={c("CNN Fear & Greed Index", "CNN 恐惧与贪婪指数")} className="relative h-[244px] w-[272px] shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30" aria-busy={loading}>
      <a href={CNN_FEAR_GREED_URL} target="_blank" rel="noopener noreferrer" className="flex h-full flex-col rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label={c("View CNN Fear & Greed Index on CNN (opens in new tab)", "在 CNN 查看恐惧与贪婪指数（新标签页）")}>
        <h2 className="text-base font-semibold">{c("CNN Fear & Greed", "CNN 恐惧与贪婪指数")}</h2>
        <p className="figure mt-0.5 min-h-4 text-xs text-muted-foreground">{snapshot ? <><time dateTime={snapshot.timestamp}>{date}</time> ET</> : c("US market sentiment", "美股市场情绪")}</p>
        <div className="figure mt-2 flex min-h-8 items-baseline gap-1.5 text-2xl font-semibold tracking-tight">
          {loading && !snapshot ? <Skeleton className="h-8 w-20" /> : snapshot ? <>{snapshot.score.toFixed(1)}<span className="text-xs font-normal text-muted-foreground">/ 100</span></> : "—"}
        </div>
        <p className={cn("mt-0.5 min-h-5 text-xs font-medium", tone)}>{snapshot ? c(snapshot.rating.replace(/\b\w/g, letter => letter.toUpperCase()), ratings[snapshot.rating]) : loading ? c("Loading sentiment", "正在加载情绪指数") : sourceOnly ? c("View the reading on CNN", "在 CNN 查看官方读数") : c("Reading unavailable", "读数暂不可用")}</p>
        <div className="mt-4" aria-hidden="true">
          <div className="relative h-1.5 rounded-full bg-muted">{snapshot && <span className={cn("absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current", tone)} style={{ left: `${snapshot.score}%` }} />}</div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>{c("0 · Extreme fear", "0 · 极度恐惧")}</span><span>{c("Extreme greed · 100", "极度贪婪 · 100")}</span></div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{sourceOnly ? c("0–100 sentiment scale", "0–100 市场情绪评分") : failed || snapshot?.status === "stale" ? snapshot ? c("Last available reading", "上次可用读数") : c("View the latest on CNN", "前往 CNN 查看最新读数") : change !== null ? c(`${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)} vs. previous close`, `较前收盘 ${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}`) : ""}</p>
        <span className="mt-auto inline-flex items-center gap-1 text-xs text-muted-foreground">{c("Source: CNN", "来源：CNN")}<ArrowUpRight className="h-3 w-3" aria-hidden /></span>
      </a>
      {failed && <Button size="xs" variant="ghost" disabled={loading} className="absolute bottom-3 right-3" onClick={() => setAttempt(value => value + 1)}>{c("Retry", "重试")}</Button>}
    </article>
  );
}
