"use client";
import { useCachedResource } from "@/hooks/useCachedResource";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EconomicRequestError, getEconomicIndicators, indicatorPeriod, indicatorValue, type EconomicIndicator, type EconomicSnapshot } from "@/lib/economicIndicators";
import ScrubChart, { type ScrubPoint } from "./ScrubChart";
import { useCopy } from "./shared";
import { useDecisionCommand } from "./CommandLayer";

const RANGES = [1, 3, 5] as const;

function IndicatorCard({ indicator, years, locale }: { indicator: EconomicIndicator; years: number; locale: string }) {
  const c = useCopy();
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);
  const history = useMemo(() => {
    const latest = indicator.history.at(-1)?.date;
    if (!latest) return [];
    const cutoff = `${Number(latest.slice(0, 4)) - years}${latest.slice(4)}`;
    return indicator.history.filter((point) => point.date >= cutoff);
  }, [indicator.history, years]);
  useEffect(() => setScrub(null), [history]);
  const period = scrub?.date ?? indicator.period;
  const currentValue = scrub?.value ?? indicator.value;
  const name = c(indicator.name_en, indicator.name_zh);
  const rangeChange = history.length > 1 ? history[history.length - 1].value - history[0].value : 0;
  const deltaTone = indicator.change === null || indicator.change === 0 ? "text-muted-foreground" : indicator.change > 0 ? "text-positive" : "text-negative";
  const frequency = indicator.frequency === "daily" ? c("Daily", "日度") : indicator.frequency === "monthly" ? c("Monthly", "月度") : c("Quarterly", "季度");
  const comparison = indicator.frequency === "daily" ? c("vs. prior observation", "较前一观测日") : indicator.frequency === "monthly" ? c("vs. prior month", "较前月") : c("vs. prior quarter", "较前季");
  const method = indicator.method === "yoy" ? c("Not seasonally adjusted · year-over-year", "未季调 · 同比") : indicator.id === "gdp" ? c("Seasonally adjusted · annualized QoQ", "季调 · 季环比折年率") : indicator.id === "payrolls" ? c("Seasonally adjusted · monthly jobs added", "季调 · 当月就业人数净增") : indicator.id === "unemployment" ? c("Seasonally adjusted · U-3", "季调 · U-3 失业率") : indicator.method === "spread" ? c("10-year minus 2-year · same date", "同日10年收益率减2年收益率") : c("Daily constant-maturity Treasury yield", "日度国债固定期限收益率");

  return (
    <article className="min-w-0 rounded-xl border border-border bg-card p-4" aria-labelledby={`indicator-${indicator.id}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 id={`indicator-${indicator.id}`} className="text-[15px] font-semibold leading-5">{name}</h2>
        <span className="shrink-0 text-xs leading-5 text-muted-foreground">{frequency}</span>
      </div>
      <p className="figure mt-1 min-h-5 text-xs text-muted-foreground"><time dateTime={period ?? undefined}>{indicatorPeriod(indicator, period, locale)}</time>{scrub && <span> · {c("History", "历史值")}</span>}</p>
      <p className="figure mt-2 min-h-9 text-[28px] font-semibold tracking-tight">{indicatorValue(currentValue, indicator.unit, locale, indicator.id === "payrolls" || indicator.id === "spread")}</p>
      <p className="mt-1 min-h-5 text-xs leading-5 text-muted-foreground">
        {scrub ? c("Historical observation", "历史观测值") : indicator.change === null ? c("Previous-period change unavailable", "暂无上期变动") : <><span className={cn("figure font-medium", deltaTone)}>{indicatorValue(indicator.change, indicator.change_unit, locale, true)}</span><span className="ml-1.5">{comparison}</span></>}
      </p>
      <div className="mt-3 h-24 [--positive-fill:var(--positive)] [--negative-fill:var(--negative)]">
        {history.length > 1 ? <ScrubChart data={history} positive={rangeChange >= 0} tone={rangeChange === 0 ? "neutral" : "direction"} height={96} baseline={indicator.id === "spread" || indicator.id === "gdp" ? 0 : undefined} onScrub={setScrub} label={c(`${name}, ${years} year history, ${rangeChange > 0 ? "up" : rangeChange < 0 ? "down" : "unchanged"} over this range`, `${name}，近${years}年走势，区间${rangeChange > 0 ? "上升" : rangeChange < 0 ? "下降" : "持平"}`)} /> : <div role="status" className="flex h-full items-center justify-center text-xs text-muted-foreground">{c("History unavailable", "暂无历史走势")}</div>}
      </div>
      <p className="mt-3 min-h-5 text-xs leading-5 text-muted-foreground">{method}</p>
      {indicator.status !== "ready" && <p role="status" className="mt-2 text-xs text-muted-foreground">{indicator.value === null ? c("Data temporarily unavailable", "数据暂不可用") : c("Delayed data · check the observation period", "延迟数据 · 请以数据所属期为准")}</p>}
      <div className="mt-3 border-t border-border/60 pt-1">
        <a href={indicator.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={c(`Source for ${name}: ${indicator.source}`, `${name}数据来源：${indicator.source}`)}>{indicator.source}<ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden /></a>
        <details className="group mt-1 w-full min-w-0 border-t border-border/60 text-xs text-muted-foreground">
          <summary className="flex min-h-10 w-full cursor-pointer list-none items-center justify-between gap-3 rounded-sm font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">{c("Recent values", "近期数据")}<ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden /></summary>
          <table className="w-full table-fixed text-xs">
            <caption className="sr-only">{c(`${name}, latest 12 observations`, `${name}，最近12期观测值`)}</caption>
            <colgroup><col className="w-1/2" /><col className="w-1/2" /></colgroup>
            <thead><tr><th scope="col" className="pb-2 pt-1 text-left font-medium">{c("Period", "数据期")}</th><th scope="col" className="pb-2 pt-1 text-right font-medium">{c("Value", "数值")}</th></tr></thead>
            <tbody>{indicator.history.slice(-12).reverse().map((point) => <tr key={point.date} className="border-t border-border/50"><th scope="row" className="figure whitespace-nowrap py-2 pr-3 text-left font-normal">{indicatorPeriod(indicator, point.date, locale)}</th><td className="figure whitespace-nowrap py-2 text-right text-foreground/85">{indicatorValue(point.value, indicator.unit, locale)}</td></tr>)}</tbody>
          </table>
        </details>
      </div>
    </article>
  );
}

export default function MacroIndicators() {
  const c = useCopy();
  const { locale } = useTranslation();
  const { setContext } = useDecisionCommand();
  const resource = useCachedResource("/api/market/indicators", getEconomicIndicators, { ttl: 5 * 60_000, timeout: 30_000 });
  const snapshot = resource.data ?? null;
  const error = resource.error ? resource.error instanceof EconomicRequestError ? resource.error.status : 503 : null;
  const loading = resource.loading;
  const [years, setYears] = useState<number>(3);

  const context = JSON.stringify({ workspace: "Markets / Economic indicators", snapshot, requestFailed: error !== null });
  useEffect(() => { setContext(context); return () => setContext(""); }, [context, setContext]);
  const intlLocale = locale === "zh" ? "zh-CN" : "en-US";
  const notice = error === 401 ? c("Your session has expired. Sign in again to view the indicators.", "登录已过期，请重新登录后查看指标。") : error ? c("Could not update the indicators. Try again; existing values are from the previous load.", "暂时无法更新指标，请重试。已显示的数值来自上次加载。") : snapshot?.status === "partial" || snapshot?.status === "stale" ? c("Some sources are delayed or unavailable. Check each card's observation period.", "部分数据源延迟或暂不可用，请以各卡片的数据所属期为准。") : snapshot?.status === "unavailable" ? c("Official data sources are temporarily unavailable. Please try again later.", "官方数据源暂不可用，请稍后重试。") : snapshot?.status === "pending" ? c("The first official-data snapshot is being prepared. Check again shortly.", "首份官方数据正在准备中，请稍后刷新。") : null;

  return (
    <section aria-labelledby="economic-indicators-heading" className="pt-6">
      <h1 id="economic-indicators-heading" className="sr-only">{c("Macro indicators", "宏观指标")}</h1>
      <header className="flex justify-end">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label={c("Indicator history range", "指标走势区间")} className="flex gap-1">{RANGES.map((range) => <button key={range} type="button" aria-pressed={years === range} onClick={() => setYears(range)} className={cn("inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", years === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{c(`${range}Y`, `${range}年`)}</button>)}</div>
          <Button variant="outline" size="sm" className="rounded-full" disabled={resource.refreshing} onClick={resource.refresh}><RefreshCw className={cn("mr-2 h-3.5 w-3.5", resource.refreshing && "animate-spin motion-reduce:animate-none")} aria-hidden />{c("Refresh", "刷新")}</Button>
        </div>
      </header>
      <div aria-live="polite" aria-atomic="true" className={notice ? "mt-4 text-sm leading-6 text-muted-foreground" : "sr-only"}>{notice && <p>{notice}</p>}{loading && !snapshot && <p>{c("Loading official economic indicators", "正在加载官方宏观指标")}</p>}</div>
      {error === 401 && <Button asChild variant="outline" size="sm" className="mb-4 rounded-full"><Link href="/auth?redirectTo=%2Fdashboard%3Ftab%3Dmacro">{c("Sign in", "重新登录")}</Link></Button>}
      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] items-start gap-4" aria-busy={loading}>
        {loading && !snapshot ? Array.from({ length: 8 }, (_, index) => <div key={index} className="min-h-[360px] space-y-5 rounded-xl border border-border bg-card p-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-40" /><Skeleton className="h-9 w-28" /><Skeleton className="h-24 w-full" /><Skeleton className="h-4 w-44" /></div>) : snapshot?.indicators.map((indicator) => <IndicatorCard key={indicator.id} indicator={error && indicator.value !== null ? { ...indicator, status: "stale" } : indicator} years={years} locale={intlLocale} />)}
      </div>
      {!loading && !snapshot?.indicators.length && <p className="py-12 text-center text-sm text-muted-foreground">{c("No indicators to display. Try refreshing.", "暂无可显示的指标，请尝试刷新。")}</p>}
      <footer className="mt-5 space-y-2 text-xs leading-6 text-muted-foreground">
        <p>{c("Charts: green for a rise, orange for a fall over the selected range. Signed changes compare with the previous observation; colors indicate direction, not investment returns.", "走势图按所选区间首尾值着色：绿色上升，橙色下降。变动数值与前一期比较，颜色仅表示升降。")}</p>
        <p>{c("Official sources: Board of Governors of the Federal Reserve System, U.S. Bureau of Labor Statistics and U.S. Bureau of Economic Analysis. Retrieved from FRED, Federal Reserve Bank of St. Louis; each card links to its source series.", "官方来源：美联储理事会、美国劳工统计局（BLS）、美国经济分析局（BEA）。通过圣路易斯联储 FRED 获取，每张卡片均附来源序列链接。")}</p>
        <p>{c("Observation periods differ: Treasury yields are daily, inflation and employment are monthly, and GDP is quarterly. Data can be revised; charts use the latest available vintage. Increases and decreases are not investment returns.", "美债收益率按日发布，通胀与就业按月发布，GDP 按季度发布。数据所属期不等于发布日期；统计值可能修订，图表采用当前可用版本。指标升降不代表投资收益。")}</p>
        <p>{c(`Sources checked every ${snapshot?.refresh_hours ?? 6} hours.`, `每 ${snapshot?.refresh_hours ?? 6} 小时检查数据源。`)}{snapshot?.fetched_at && <> {c("Last checked: ", "最近检查：")}<time dateTime={snapshot.fetched_at}>{new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(snapshot.fetched_at))} UTC</time></>}</p>
      </footer>
    </section>
  );
}
