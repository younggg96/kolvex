"use client";
import { useCachedResource } from "@/hooks/useCachedResource";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsPhone } from "@/hooks/useIsPhone";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EconomicRequestError, getEconomicIndicators, indicatorPeriod, indicatorValue, type EconomicIndicator, macroHistory, MACRO_RANGES, type MacroRange } from "@/lib/economicIndicators";
import ScrubChart, { type ScrubPoint } from "./ScrubChart";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { MarketInfoButton, MarketRefreshButton, MarketToolbarControls } from "./MarketToolbar";
import { useCopy } from "./shared";
import { useDecisionCommand } from "./CommandLayer";
import FedCutChart from "./FedCutChart";

/** Facts shared by the desktop card and the compact phone row. */
function useIndicatorFacts(indicator: EconomicIndicator, range: MacroRange) {
  const c = useCopy();
  const history = useMemo(() => macroHistory(indicator.history, indicator.frequency, range), [indicator.history, indicator.frequency, range]);
  const selected = MACRO_RANGES.find((option) => option.value === range)!;
  const name = c(indicator.name_en, indicator.name_zh);
  const rangeChange = history.length > 1 ? history[history.length - 1].value - history[0].value : 0;
  return {
    history,
    name,
    rangeChange,
    delayed: indicator.status === "stale" && indicator.value !== null ? c("Delayed", "延迟") : null,
    deltaTone: indicator.change === null || indicator.change === 0 ? "text-muted-foreground" : indicator.change > 0 ? "text-positive" : "text-negative",
    frequency: indicator.frequency === "daily" ? c("Daily", "日度") : indicator.frequency === "monthly" ? c("Monthly", "月度") : c("Quarterly", "季度"),
    comparison: indicator.frequency === "daily" ? c("vs. prior observation", "较前一观测日") : indicator.frequency === "monthly" ? c("vs. prior month", "较前月") : c("vs. prior quarter", "较前季"),
    method: indicator.method === "yoy" ? c("Not seasonally adjusted · year-over-year", "未季调 · 同比") : indicator.id === "gdp" ? c("Seasonally adjusted · annualized QoQ", "季调 · 季环比折年率") : indicator.id === "payrolls" ? c("Seasonally adjusted · monthly jobs added", "季调 · 当月就业人数净增") : indicator.id === "unemployment" ? c("Seasonally adjusted · U-3", "季调 · U-3 失业率") : indicator.method === "spread" ? c("10-year minus 2-year · same date", "同日10年收益率减2年收益率") : c("Daily constant-maturity Treasury yield", "日度国债固定期限收益率"),
    chartLabel: c(`${name}, ${selected.en} history`, `${name}，近${selected.zh}走势`) +
      (history.length < 2 ? "" : rangeChange > 0 ? c(" · rising", " · 上升") : rangeChange < 0 ? c(" · falling", " · 下降") : c(" · unchanged", " · 持平")),
    baseline: indicator.id === "spread" || indicator.id === "gdp" ? 0 : undefined,
  };
}

function IndicatorInfo({ indicator, facts }: { indicator: EconomicIndicator; facts: ReturnType<typeof useIndicatorFacts> }) {
  const c = useCopy();
  return (
    <MarketInfoButton label={c(`About ${facts.name}`, `${facts.name}说明`)}>
      <p className="font-semibold text-foreground">{facts.name} · {facts.frequency}</p>
      <p>{facts.method}</p>
      {indicator.status !== "ready" && <p>{indicator.value === null ? c("Data temporarily unavailable", "数据暂不可用") : c("Delayed data · check the observation period", "延迟数据 · 请以数据所属期为准")}</p>}
      <a href={indicator.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-md text-foreground underline underline-offset-4 hover:text-muted-foreground" aria-label={c(`Source for ${facts.name}: ${indicator.source}`, `${facts.name}数据来源：${indicator.source}`)}>
        {indicator.source}<ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
      </a>
    </MarketInfoButton>
  );
}

function RecentValues({ indicator, name, locale }: { indicator: EconomicIndicator; name: string; locale: string }) {
  const c = useCopy();
  return (
    <table className="w-full table-fixed text-xs">
      <caption className="sr-only">{c(`${name}, latest 12 observations`, `${name}，最近12期观测值`)}</caption>
      <colgroup><col className="w-1/2" /><col className="w-1/2" /></colgroup>
      <thead><tr><th scope="col" className="pb-2 pt-1 text-left font-medium">{c("Period", "数据期")}</th><th scope="col" className="pb-2 pt-1 text-right font-medium">{c("Value", "数值")}</th></tr></thead>
      <tbody>{indicator.history.slice(-12).reverse().map((point) => <tr key={point.date} className="border-t border-border/50"><th scope="row" className="figure whitespace-nowrap py-2 pr-3 text-left font-normal">{indicatorPeriod(indicator, point.date, locale)}</th><td className="figure whitespace-nowrap py-2 text-right text-foreground/85">{indicatorValue(point.value, indicator.unit, locale)}</td></tr>)}</tbody>
    </table>
  );
}

/** One line per indicator, so a phone shows the whole set; details open in place. */
function IndicatorRow({ indicator, range, locale }: { indicator: EconomicIndicator; range: MacroRange; locale: string }) {
  const c = useCopy();
  const facts = useIndicatorFacts(indicator, range);
  const [open, setOpen] = useState(false);
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);
  useEffect(() => setScrub(null), [facts.history]);
  const signed = indicator.id === "payrolls" || indicator.id === "spread";
  return (
    <li className="border-b border-border/60 last:border-b-0">
      <details className="group" onToggle={(event) => { setOpen(event.currentTarget.open); setScrub(null); }}>
        <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[minmax(0,1fr)_3.5rem_minmax(5rem,auto)_1rem] items-center gap-2 py-2 focus-visible:outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{facts.name}</span>
            <span className="figure mt-0.5 block truncate text-xs text-muted-foreground">{indicatorPeriod(indicator, indicator.period, locale)}{facts.delayed && <> · {facts.delayed}</>}</span>
          </span>
          <span aria-hidden="true" className="pointer-events-none h-10 [--positive-fill:var(--positive)] [--negative-fill:var(--negative)]">
            {facts.history.length > 1 && <ScrubChart data={facts.history} positive={facts.rangeChange >= 0} tone={facts.rangeChange === 0 ? "neutral" : "direction"} height="100%" baseline={facts.baseline} onScrub={() => {}} label="" />}
          </span>
          <span className="min-w-0 text-right">
            <span className="figure block whitespace-nowrap text-base font-semibold">{indicatorValue(indicator.value, indicator.unit, locale, signed)}</span>
            <span className={cn("figure mt-0.5 block whitespace-nowrap text-xs font-medium", facts.deltaTone)}>{indicator.change === null ? "—" : indicatorValue(indicator.change, indicator.change_unit, locale, true)}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
        </summary>
        {open && (
          <div className="pb-3 text-xs leading-5 text-muted-foreground">
            <div className="flex min-h-9 items-center justify-between gap-2">
              <p>{scrub ? <><span className="figure font-medium text-foreground">{indicatorValue(scrub.value, indicator.unit, locale, signed)}</span> · {indicatorPeriod(indicator, scrub.date, locale)}</> : facts.comparison}</p>
              <IndicatorInfo indicator={indicator} facts={facts} />
            </div>
            <div className="mt-2 h-28 [--positive-fill:var(--positive)] [--negative-fill:var(--negative)]">
              {facts.history.length > 0 ? <ScrubChart data={facts.history} positive={facts.rangeChange >= 0} tone={facts.rangeChange === 0 ? "neutral" : "direction"} height="100%" baseline={facts.baseline} onScrub={setScrub} label={facts.chartLabel} /> : <p role="status" className="flex h-full items-center justify-center">{c("History unavailable", "暂无历史走势")}</p>}
            </div>
            <details className="mt-1 border-t border-border/60"><summary className="flex min-h-10 cursor-pointer list-none items-center font-medium focus-visible:outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">{c("Recent values", "近期数据")}</summary><RecentValues indicator={indicator} name={facts.name} locale={locale} /></details>
          </div>
        )}
      </details>
    </li>
  );
}

function IndicatorCard({ indicator, range, locale }: { indicator: EconomicIndicator; range: MacroRange; locale: string }) {
  const c = useCopy();
  const facts = useIndicatorFacts(indicator, range);
  const { history, name, rangeChange, deltaTone, comparison, chartLabel, baseline } = facts;
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);
  useEffect(() => setScrub(null), [history]);
  const period = scrub?.date ?? indicator.period;
  const currentValue = scrub?.value ?? indicator.value;
  const periodLabel = scrub ? c("History", "历史值") : facts.delayed;

  return (
    <article className="min-w-0 rounded-3xl border border-foreground/10 glass-card bg-card-glass p-4" aria-labelledby={`indicator-${indicator.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`indicator-${indicator.id}`} className="text-[0.9375rem] font-semibold leading-5">{name}</h2>
          <p className="figure mt-1 min-h-5 text-xs text-muted-foreground"><time dateTime={period ?? undefined}>{indicatorPeriod(indicator, period, locale)}</time>{periodLabel && <> · {periodLabel}</>}</p>
        </div>
        <IndicatorInfo indicator={indicator} facts={facts} />
      </div>
      <p className="figure mt-2 min-h-9 text-[1.75rem] font-semibold tracking-tight">{indicatorValue(currentValue, indicator.unit, locale, indicator.id === "payrolls" || indicator.id === "spread")}</p>
      <p className="mt-1 min-h-5 text-xs leading-5 text-muted-foreground">
        {!scrub && (indicator.change === null ? "—" : <><span className={cn("figure font-medium", deltaTone)}>{indicatorValue(indicator.change, indicator.change_unit, locale, true)}</span><span className="ml-1.5">{comparison}</span></>)}
      </p>
      <div className="mt-3 h-24 [--positive-fill:var(--positive)] [--negative-fill:var(--negative)]">
        {history.length > 0 ? <ScrubChart data={history} positive={rangeChange >= 0} tone={rangeChange === 0 ? "neutral" : "direction"} height="6rem" baseline={baseline} onScrub={setScrub} label={chartLabel} /> : <div role="status" className="flex h-full items-center justify-center text-xs text-muted-foreground">{c("History unavailable", "暂无历史走势")}</div>}
      </div>
      <details className="group mt-3 w-full min-w-0 border-t border-border/60 pt-1 text-xs text-muted-foreground">
        <summary className="flex min-h-10 w-full cursor-pointer list-none items-center justify-between gap-3 rounded-full px-2 font-medium transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none [&::-webkit-details-marker]:hidden">{c("Recent values", "近期数据")}<ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden /></summary>
        <RecentValues indicator={indicator} name={name} locale={locale} />
      </details>
    </article>
  );
}

export default function MacroIndicators({ toolbar }: { toolbar: HTMLElement | null }) {
  const c = useCopy();
  const { locale } = useTranslation();
  const { setContext } = useDecisionCommand();
  const resource = useCachedResource("/api/market/indicators", getEconomicIndicators, { ttl: 5 * 60_000, timeout: 30_000 });
  const snapshot = resource.data ?? null;
  const error = resource.error ? resource.error instanceof EconomicRequestError ? resource.error.status : 503 : null;
  const loading = resource.loading;
  const [range, setRange] = useState<MacroRange>("3Y");
  const isPhone = useIsPhone();

  const context = JSON.stringify({ workspace: "Markets / Economic indicators", snapshot, requestFailed: error !== null });
  useEffect(() => { setContext(context); return () => setContext(""); }, [context, setContext]);
  const intlLocale = locale === "zh" ? "zh-CN" : "en-US";
  const hasDelayedSources = snapshot?.status === "partial" || snapshot?.status === "stale";
  const notice = error === 401 ? c("Your session has expired. Sign in again to view the indicators.", "登录已过期，请重新登录后查看指标。") : error ? c("Could not update the indicators. Try again; existing values are from the previous load.", "暂时无法更新指标，请重试。已显示的数值来自上次加载。") : snapshot?.status === "unavailable" ? c("Official data sources are temporarily unavailable. Please try again later.", "官方数据源暂不可用，请稍后重试。") : snapshot?.status === "pending" ? c("The first official-data snapshot is being prepared. Check again shortly.", "首份官方数据正在准备中，请稍后刷新。") : null;

  return (
    <section aria-labelledby="economic-indicators-heading" className="pt-2 max-md:pt-0">
      <h1 id="economic-indicators-heading" className="sr-only">{c("Macro indicators", "宏观指标")}</h1>
      <MarketToolbarControls toolbar={toolbar}>
        <SegmentedControl<MacroRange> size="sm" label={c("Indicator history range", "指标走势区间")} value={range} onChange={setRange} className="border border-border max-md:flex-1" itemClassName="!min-h-9 max-md:!min-w-0 max-md:!flex-1 max-md:!px-0" options={MACRO_RANGES.map((option) => ({ value: option.value, label: c(option.value, option.zh), ariaLabel: c(option.en, option.zh) }))} />
        <MarketRefreshButton refreshing={resource.refreshing} onClick={resource.refresh} />
        <MarketInfoButton label={c("About macro data", "宏观数据说明")} wide>
          <p className="font-semibold text-foreground">{c("About macro data", "宏观数据说明")}</p>
          {hasDelayedSources && <p>{c("Some sources are delayed or unavailable. Check each card's observation period.", "部分数据源延迟或暂不可用，请以各卡片的数据所属期为准。")}</p>}
          {range === "1D" && <p>{c("The 1-day view shows the last two daily observations and the latest monthly or quarterly observation.", "1日区间显示最近两次日度观测，月度和季度指标只显示最新一期。")}</p>}
          <p>{c("Chart colors reflect the change over the selected range. The signed change compares with the previous observation.", "走势颜色反映所选区间的升降，变动数值与前一期比较。")}</p>
          <p>{c("The underlying data comes from the Federal Reserve, BLS, and BEA via FRED. Each indicator’s info button links to its source.", "原始数据来自美联储、美国劳工统计局（BLS）和美国经济分析局（BEA），经 FRED 获取。各指标的信息按钮内附来源链接。")}</p>
          <p>{c("Cards show observation periods. Data may be revised. Indicator changes do not represent investment returns.", "卡片显示数据所属期，统计值可能修订。指标升降不代表投资收益。")}</p>
          <p>{c(`Sources checked every ${snapshot?.refresh_hours ?? 6} hours.`, `每 ${snapshot?.refresh_hours ?? 6} 小时检查数据源。`)}{snapshot?.fetched_at && <> {c("Last checked: ", "最近检查：")}<time dateTime={snapshot.fetched_at}>{new Intl.DateTimeFormat(intlLocale, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(snapshot.fetched_at))} UTC</time></>}</p>
        </MarketInfoButton>
      </MarketToolbarControls>
      <div aria-live="polite" aria-atomic="true" className={notice ? "mt-4 text-sm leading-6 text-muted-foreground" : "sr-only"}>{notice && <p>{notice}</p>}{loading && !snapshot && <p>{c("Loading official economic indicators", "正在加载官方宏观指标")}</p>}</div>
      {error === 401 && <Button asChild variant="outline" size="sm" className="mb-4 rounded-full"><Link href="/auth?redirectTo=%2Fdashboard%3Ftab%3Dmacro">{c("Sign in", "重新登录")}</Link></Button>}
      <FedCutChart />
      {isPhone ? (
        <ul className="mt-[16px] rounded-3xl border border-foreground/10 glass-card bg-card-glass px-3" aria-busy={loading}>
          {loading && !snapshot ? Array.from({ length: 9 }, (_, index) => <li key={index} aria-hidden="true" className="border-b border-border/60 last:border-b-0"><div className="grid min-h-16 grid-cols-[minmax(0,1fr)_3.5rem_minmax(5rem,auto)_1rem] items-center gap-2 py-2">
            <span className="flex flex-col gap-1.5"><Skeleton className={cn("h-4 rounded-md", index % 2 ? "w-24" : "w-32")} /><Skeleton className="h-3 w-20 rounded-md" /></span>
            <Skeleton className="h-8 w-full rounded-lg" />
            <span className="flex flex-col items-end gap-1.5"><Skeleton className="h-5 w-14 rounded-md" /><Skeleton className="h-3 w-10 rounded-md" /></span>
            <Skeleton className="h-3.5 w-3.5 rounded" />
          </div></li>) : snapshot?.indicators.map((indicator) => <IndicatorRow key={indicator.id} indicator={error && indicator.value !== null ? { ...indicator, status: "stale" } : indicator} range={range} locale={intlLocale} />)}
        </ul>
      ) : <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,16.25rem),1fr))] items-start gap-4" aria-busy={loading}>
        {loading && !snapshot ? Array.from({ length: 9 }, (_, index) => <div key={index} aria-hidden="true" className="min-w-0 rounded-3xl border border-foreground/10 glass-card bg-card-glass p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-h-11"><Skeleton className="h-5 w-32 rounded-md" /><Skeleton className="mt-1.5 h-3 w-20 rounded-md" /></div>
            <div className="flex h-9 w-9 items-center justify-center"><Skeleton className="h-4 w-4 rounded-full" /></div>
          </div>
          <Skeleton className="mt-2 h-9 w-28 rounded-lg" />
          <Skeleton className="mt-1 h-3.5 w-36 rounded-md" />
          <Skeleton className="mt-3 h-24 w-full rounded-xl" />
          <div className="mt-3 border-t border-border/60 pt-1"><div className="flex min-h-10 items-center justify-between px-2"><Skeleton className="h-3 w-20 rounded-md" /><Skeleton className="h-3.5 w-3.5 rounded" /></div></div>
        </div>) : snapshot?.indicators.map((indicator) => <IndicatorCard key={indicator.id} indicator={error && indicator.value !== null ? { ...indicator, status: "stale" } : indicator} range={range} locale={intlLocale} />)}
      </div>}
      {!loading && !snapshot?.indicators.length && <p className="py-12 text-center text-sm text-muted-foreground">{c("No indicators to display. Try refreshing.", "暂无可显示的指标，请尝试刷新。")}</p>}
    </section>
  );
}
