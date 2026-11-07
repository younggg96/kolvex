"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContentLoading } from "@/components/ui/content-loading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { secSourceUrl } from "@/lib/freeResearch";
import { cn } from "@/lib/utils";
import {
  loadValuation, simulateValuation, validateValuationAssumptions, valuationScenarios,
  type Multiples, type StockValuation as ValuationData, type ValuationPoint,
  type ValuationReference, type ValuationSimulation,
} from "@/lib/stockValuation";
import { useCopy } from "./shared";
import CompanyValuationCalculator from "./CompanyValuationCalculator";
import ValuationHistoryCard from "./ValuationHistoryCard";

const names = { conservative: ["Conservative", "保守"], base: ["Base", "基准"], optimistic: ["Optimistic", "乐观"] } as const;
type View = "price" | "pe" | "premium";
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const updateQuery = (key: string, value: string) => {
  const url = new URL(window.location.href); url.searchParams.set(key, value);
  window.history.replaceState(null, "", `${url.pathname}?${url.searchParams}`);
};

function useFormat() {
  const { locale } = useTranslation();
  const region = locale === "zh" ? "zh-CN" : "en-US";
  const number = (value: unknown, digits = 2) => finite(value) ? new Intl.NumberFormat(region, { maximumFractionDigits: digits }).format(value) : "—";
  const money = (value: unknown) => finite(value) ? new Intl.NumberFormat(region, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value) : "—";
  const percent = (value: unknown) => finite(value) ? new Intl.NumberFormat(region, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(value) : "—";
  return { number, money, percent };
}

export default function StockValuation({ symbol }: { symbol: string }) {
  const c = useCopy(); const query = useSearchParams();
  const initial = query.get("valuation_mode") === "history" || (!query.has("valuation_mode") && (query.has("valuation_view") || query.has("valuation_range"))) ? "history" : "calculator";
  const [mode, setMode] = useState(initial);
  const [visited, setVisited] = useState([initial]);
  return <div className="space-y-6">
    <SegmentedControl label={c("Valuation workspace", "估值工作区")} value={mode} onChange={value => { setMode(value); setVisited(previous => Array.from(new Set([...previous, value]))); updateQuery("valuation_mode", value); }} wrap options={[{ value: "calculator", label: c("Company calculator", "公司估值计算") }, { value: "history", label: c("Valuation history", "历史估值走势") }]} />
    {visited.includes("calculator") && <div hidden={mode !== "calculator"}><CompanyValuationCalculator key={symbol} symbol={symbol} /></div>}
    {visited.includes("history") && <div hidden={mode !== "history"}><HistoricalValuation key={symbol} symbol={symbol} /></div>}
  </div>;
}

function HistoricalValuation({ symbol }: { symbol: string }) {
  const c = useCopy();
  const f = useFormat();
  const query = useSearchParams();
  const [years, setYears] = useState(query.get("valuation_range") === "1" ? "1" : query.get("valuation_range") === "5" ? "5" : "3");
  const [view, setView] = useState<View>(query.get("valuation_view") === "pe" ? "pe" : query.get("valuation_view") === "premium" ? "premium" : "price");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<ValuationSimulation | null>(null);
  const resource = useCachedResource(`/api/market/valuation/${symbol}/history?years=5`,
    (signal) => loadValuation(symbol, 5, signal, true), { ttl: 600_000, timeout: 330_000 });
  const data = resource.data && "points" in resource.data ? resource.data : null;
  const cutoff = data ? `${Number(data.as_of.slice(0, 4)) - Number(years)}${data.as_of.slice(4)}` : "";
  const points = useMemo(() => data?.points.filter((p) => p.date >= cutoff) ?? [], [data, cutoff]);
  const selectedIndex = Math.max(0, selectedDate ? points.findIndex((p) => p.date >= selectedDate) : points.length - 1);
  const selected = points[selectedIndex];
  const event = selected && data?.events[selected.event_id];
  const shownSimulation = simulation?.snapshot_id === data?.snapshot_id ? simulation : null;
  const reference = shownSimulation?.reference ?? data?.current.reference ?? null;

  if (resource.loading && !data) return <ContentLoading label={c("Preparing source-linked valuation history…", "正在整理有来源的估值历史，首次计算可能需要几分钟…")} variant="block" className="min-h-80" />;
  // Companies outside the reviewed PE pipeline get a P/S history instead.
  if (!data && resource.data && "status" in resource.data) return <ValuationHistoryCard symbol={symbol} />;
  if (!data) return <Card className="space-y-3 p-5">
    <p>{c("Valuation data is temporarily unavailable.", "估值数据暂时无法读取。")}</p>
    {resource.error ? <Button variant="outline" onClick={resource.refresh}>{c("Retry", "重试")}</Button> : null}
  </Card>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">{c("Valuation analysis", "估值分析")}</h2><p className="mt-1 text-sm text-muted-foreground">{c("Historical PE references · USD · SEC filings", "历史 PE 参考估值 · USD · SEC 财报")}</p></div>
      <Button variant="outline" disabled={resource.refreshing} onClick={resource.refresh}>{resource.refreshing ? c("Refreshing…", "更新中…") : c("Refresh", "刷新")}</Button>
    </div>
    {Boolean(resource.error) && <p role="status" className="text-sm text-muted-foreground">{c("Refresh failed. The previous snapshot remains visible.", "更新失败，正在显示上次成功读取的快照。")}</p>}
    <Card className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap justify-between gap-4">
        <div><h3 className="text-base font-semibold">{shownSimulation ? c("My simulation", "我的模拟") : c("Current reference", "当前参考估值")}</h3><p className="mt-1 text-xs text-muted-foreground">{c("Latest completed close", "最近完整交易日收盘价")} · {data.current.price_date}</p></div>
        <div className="text-right"><div className="figure text-2xl font-semibold">{f.money(data.current.price)}</div><div className="text-xs text-muted-foreground">{c("TTM PE", "TTM 市盈率")} {f.number(data.current.pe)}×</div></div>
      </div>
      <ReferenceRange reference={reference} price={data.current.price} />
      {reference ? <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <p>{c("Space to base reference", "相对基准的价格空间")} <strong className="figure">{f.percent(reference.scenarios.base.comparison.price_space)}</strong></p>
        <p>{c("Premium / discount to base", "相对基准的溢价／折价")} <strong className="figure">{f.percent(reference.scenarios.base.comparison.premium_discount)}</strong></p>
      </div> : <p className="text-sm text-muted-foreground">{c("A complete, verified EPS and sufficient reference samples are required for automatic values.", "自动估值需要完整、可核验的 EPS 和足够的历史参考样本。")}</p>}
      <p className="text-xs text-muted-foreground">{c("This is a model reference range, not a statistical confidence interval or analyst consensus.", "这是模型情景范围，不是统计置信区间或分析师共识。")}</p>
    </Card>

    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl label={c("Valuation chart", "估值图表")} value={view} onChange={(v) => { setView(v); updateQuery("valuation_view", v); }} wrap options={[
          { value: "price", label: c("Price & reference", "股价与参考值") }, { value: "pe", label: c("PE", "PE 倍数") }, { value: "premium", label: c("Premium / discount", "溢价／折价") },
        ]} />
        <SegmentedControl label={c("History range", "历史范围")} value={years} onChange={(v) => { setYears(v); setSelectedDate(null); updateQuery("valuation_range", v); }} options={[
          { value: "1", label: c("1Y", "1年") }, { value: "3", label: c("3Y", "3年") }, { value: "5", label: c("5Y", "5年") },
        ]} />
      </div>
      <HistoryPlot points={points} view={view} onSelect={setSelectedDate} />
      <p className="text-xs text-muted-foreground">{c("Prices are daily; reference values update at filing events. Missing inputs remain gaps. Personal assumptions do not rewrite this history.", "股价按日变化，参考值随财报事件更新；缺失数据保留缺口，个人假设不会改写这条历史。")}</p>
      {selected && <div className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">{c("Selected session", "选中交易日")} · {selected.date}</p>
          <div className="flex gap-2"><Button variant="outline" size="sm" disabled={selectedIndex <= 0} onClick={() => setSelectedDate(points[selectedIndex - 1].date)}>{c("Previous", "上一交易日")}</Button><Button variant="outline" size="sm" disabled={selectedIndex >= points.length - 1} onClick={() => setSelectedDate(points[selectedIndex + 1].date)}>{c("Next", "下一交易日")}</Button></div>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">{[
          [c("Close", "收盘价"), f.money(selected.price)], [c("Base reference", "基准参考值"), f.money(selected.base)],
          ["TTM EPS", f.number(selected.eps)], [c("Premium / discount", "溢价／折价"), f.percent(selected.premium_discount)],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="figure mt-1 font-medium">{value}</dd></div>)}</dl>
        {event && <Sources event={event} />}
      </div>}
    </Card>

    <SimulationPanel key={data.snapshot_id} data={data} onSimulation={setSimulation} />
    <details className="text-sm"><summary className="cursor-pointer rounded-2xl p-3 font-medium hover:bg-foreground/[0.04]">{c("Data & method", "数据与计算方法")}</summary>
      <div className="space-y-3 px-3 py-4 text-muted-foreground">
        <p>{c("System multiples use the prior five years of valid PE samples (25th, 50th and 75th percentiles), with at least 252 sessions and four financial input versions. Samples exclude the calculation day and later disclosures.", "系统倍数采用此前五年有效 PE 样本的第25、50、75分位，至少需要252个交易日及四个财务输入版本；不提前使用计算当日或后来的披露。")}</p>
        <p>{c("TTM uses a reported full-year value or four contiguous reported quarters. Q4 supplements come directly from SEC-filed GAAP earnings tables. Split alignment follows reviewed pilot-company rules; unknown corporate actions leave gaps.", "TTM 使用直接披露的全年值或连续四个单季值；Q4 补充值直接读取 SEC 业绩公告的 GAAP 表格。拆股对齐采用试点公司规则，未知公司行动保留缺口。")}</p>
        <p className="flex flex-wrap gap-3">{data.basis.evidence?.filter((url) => url.startsWith("https://")).map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">{c("Share-basis source", "股本口径依据")} {i + 1}</a>)}</p>
        <p>{c("Reference sample size", "参考样本量")}: {f.number(data.current.calibration.sample_count, 0)} · {data.current.calibration.first_sample} — {data.current.calibration.last_sample}</p>
        <p>{c("The comparison uses the dated close above. It can differ from the live quote in the stock header. Company calculator assumptions do not rewrite this historical PE series. Account-saved scenarios are not included.", "价格比较使用上方标注日期的收盘价，可能与页面顶部即时行情不同。公司计算器中的假设不会改写历史 PE 曲线，暂不支持账户方案保存。")}</p>
      </div>
    </details>
  </div>;
}

function ReferenceRange({ reference, price }: { reference: ValuationReference | null; price: number | null }) {
  const c = useCopy(); const f = useFormat();
  const values = reference ? valuationScenarios.map((key) => reference.scenarios[key].reference_value) : [];
  const all = [...values, ...(finite(price) ? [price] : [])];
  const min = Math.min(...all), max = Math.max(...all), span = Math.max(max - min, 1);
  const position = (v: number) => 5 + 90 * ((v - min) / span);
  return <div className="space-y-3">
    <dl className="grid grid-cols-3 gap-3">{valuationScenarios.map((key) => <div key={key}><dt className="text-xs text-muted-foreground">{c(names[key][0], names[key][1])}</dt><dd className="figure mt-1 text-lg font-semibold sm:text-xl">{f.money(reference?.scenarios[key].reference_value)}</dd></div>)}</dl>
    {reference && finite(price) && <div aria-hidden="true" className="relative h-8"><div className="absolute inset-x-0 top-3 h-1 rounded-full bg-muted" />{values.map((v, i) => <span key={i} className="absolute top-1 h-5 w-0.5 bg-muted-foreground" style={{ left: `${position(v)}%` }} />)}<span className="absolute top-2 h-3 w-3 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${position(price)}%` }} /></div>}
  </div>;
}

function Sources({ event }: { event: ValuationData["current"] | ValuationData["events"][string] }) {
  const c = useCopy();
  return <details className="text-xs text-muted-foreground"><summary className="cursor-pointer rounded-lg py-2 hover:text-foreground">{c("Financial inputs & sources", "财务输入与来源")} · {event.period_end}</summary>
    <ul className="mt-2 space-y-2">{event.inputs.map((row, i) => { const url = secSourceUrl(row.source_url); return <li key={`${row.source_url}-${i}`} className="flex flex-wrap justify-between gap-2"><span>{row.start} — {row.end} · EPS {row.value.toFixed(4)}{finite(row.raw_value) && Math.abs(row.raw_value - row.value) > 0.000001 ? ` (${c("as filed", "原披露")} ${row.raw_value})` : ""}</span>{url && <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">{row.form} · {c("Filed", "申报")} {row.filed}</a>}</li>; })}</ul>
  </details>;
}

function HistoryPlot({ points, view, onSelect }: { points: ValuationPoint[]; view: View; onSelect: (date: string) => void }) {
  const c = useCopy(); const f = useFormat();
  const chart = useMemo(() => points.map((p) => ({ ...p,
    band: p.conservative !== null && p.optimistic !== null ? view === "price" ? [p.conservative, p.optimistic] : finite(p.eps) && p.eps > 0 ? [p.conservative / p.eps, p.optimistic / p.eps] : null : null,
    peBase: p.base !== null && finite(p.eps) && p.eps > 0 ? p.base / p.eps : null,
    premiumPercent: p.premium_discount === null ? null : p.premium_discount * 100,
  })), [points, view]);
  const unit = view === "price" ? "USD" : view === "pe" ? "×" : "%";
  return <div>
    <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <span>{view === "price" ? c("Market price", "市场价格") : view === "pe" ? c("TTM PE", "TTM 市盈率") : c("Premium / discount", "溢价／折价")} · {unit}</span>
      {view !== "premium" && <span>{c("Dashed: base reference · shaded: scenario range", "虚线：基准参考 · 阴影：情景范围")}</span>}
    </div>
    <div className="h-80 w-full min-w-0 sm:h-96" role="img" aria-label={c("Daily valuation history. Use the session controls below for keyboard reading.", "每日估值历史，可用下方交易日按钮逐日读取。") }>
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} onClick={(state) => { const p = state?.activePayload?.[0]?.payload as ValuationPoint | undefined; if (p) onSelect(p.date); }}>
        <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeOpacity={0.5} />
        <XAxis dataKey="date" minTickGap={65} tickFormatter={(value: string) => value.slice(0, 7)} tick={{ fontSize: 12, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <YAxis width={58} tickFormatter={(v: number) => `${f.number(v, 0)}${view === "price" ? "" : unit}`} tick={{ fontSize: 12, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
        <Tooltip content={({ active, payload }) => { const p = payload?.[0]?.payload as ValuationPoint | undefined; if (!active || !p) return null; return <div className="rounded-2xl border border-border bg-card p-3 text-xs text-foreground"><p className="mb-2 font-medium">{p.date}</p><p>{c("Price", "股价")}: {f.money(p.price)}</p><p>{c("Base", "基准")}: {f.money(p.base)}</p><p>PE: {f.number(p.pe)}×</p><p>{c("Premium / discount", "溢价／折价")}: {f.percent(p.premium_discount)}</p></div>; }} />
        {view !== "premium" && <Area type="stepAfter" dataKey="band" stroke="none" fill="rgb(var(--positive))" fillOpacity={0.1} connectNulls={false} isAnimationActive={false} />}
        {view === "premium" && <ReferenceLine y={0} stroke="rgb(var(--muted-foreground))" />}
        <Line dataKey={view === "price" ? "price" : view === "pe" ? "pe" : "premiumPercent"} type="linear" stroke="rgb(var(--foreground))" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        {view !== "premium" && <Line dataKey={view === "price" ? "base" : "peBase"} type="stepAfter" stroke="rgb(var(--positive))" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />}
      </ComposedChart></ResponsiveContainer>
    </div>
  </div>;
}

function SimulationPanel({ data, onSimulation }: { data: ValuationData; onSimulation: (value: ValuationSimulation | null) => void }) {
  const c = useCopy(); const f = useFormat();
  const defaults = data.current.calibration.multiples;
  const [pe, setPe] = useState<Record<string, string>>(() => Object.fromEntries(valuationScenarios.map((key) => [key, defaults ? String(Number(defaults[key].toFixed(2))) : ""])));
  const [growth, setGrowth] = useState<Record<string, string>>({ conservative: "0", base: "0", optimistic: "0" });
  const [result, setResult] = useState<ValuationSimulation | null>(null);
  const [state, setState] = useState<"pending" | "success" | "invalid" | "failed">("pending");
  const [retry, setRetry] = useState(0);
  const edited = valuationScenarios.some((key) => pe[key] !== (defaults ? String(Number(defaults[key].toFixed(2))) : "") || growth[key] !== "0");
  useEffect(() => {
    const multiples = Object.fromEntries(valuationScenarios.map((key) => [key, pe[key] === "" ? NaN : Number(pe[key])])) as Multiples;
    const rates = Object.fromEntries(valuationScenarios.map((key) => [key, growth[key] === "" ? NaN : Number(growth[key]) / 100])) as Multiples;
    if (!validateValuationAssumptions(multiples, rates)) { setState("invalid"); return; }
    const controller = new AbortController();
    setState("pending");
    const timer = setTimeout(() => {
      simulateValuation(data.symbol, data, !edited && defaults ? defaults : multiples, rates, controller.signal).then((value) => {
        if (controller.signal.aborted) return;
        setResult(value); onSimulation(edited ? value : null); setState("success");
      }).catch(() => { if (!controller.signal.aborted) setState("failed"); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [data, defaults, pe, growth, retry, edited, onSimulation]);
  const ready = data.current.status === "complete" && data.current.share_basis_status === "verified";
  if (!ready) return null;
  return <Card className="space-y-5 p-4 sm:p-5">
    <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-base font-semibold">{c("Assumptions & future scenarios", "假设与未来情景")}</h3><p className="mt-1 text-xs text-muted-foreground">{c("3, 6 and 9 calendar months ahead; not company fiscal-quarter dates.", "未来3、6、9个日历月的目标时点，不是公司财季末。")}</p></div>
      <Button variant="outline" size="sm" disabled={!edited} onClick={() => { setPe(Object.fromEntries(valuationScenarios.map((key) => [key, defaults ? String(Number(defaults[key].toFixed(2))) : ""]))); setGrowth({ conservative: "0", base: "0", optimistic: "0" }); onSimulation(null); }}>{c("Reset assumptions", "恢复系统假设")}</Button></div>
    <div className="min-h-6 text-sm" aria-live="polite">{state === "pending" ? c("Calculating…", "正在计算…") : state === "invalid" ? c("Check the three PE values and growth rates. Previous results have not been updated.", "请检查三种情景的 PE 顺序和增长率；下方保留上次有效结果。") : state === "failed" ? <span>{c("Calculation failed or scenarios cross. Check assumptions; refresh valuation if the snapshot changed.", "计算失败或目标价情景交叉，请检查假设；快照更新后请刷新估值。 ")}<Button size="sm" variant="ghost" onClick={() => setRetry((v) => v + 1)}>{c("Retry", "重试")}</Button></span> : edited ? c("Personal simulation applied to the current card; system history stays unchanged.", "个人模拟已应用于当前卡片，系统历史保持原样。") : c("System multiples with constant-earnings scenarios.", "采用系统参考倍数和盈利不变情景。")}</div>
    {result && <p className="text-xs text-muted-foreground sm:hidden">{c("Swipe horizontally to see all scenarios.", "左右滑动查看全部情景。")}</p>}
    {result && <div className="overflow-x-auto" role="region" aria-label={c("Scenario prices", "情景目标价") } tabIndex={0}><table className="w-full min-w-[30rem] text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th scope="col" className="py-3 text-left font-normal">{c("Target date", "目标日期")}</th>{valuationScenarios.map((key) => <th key={key} scope="col" className="px-3 py-3 text-right font-normal">{c(names[key][0], names[key][1])}</th>)}</tr></thead><tbody>{result.projections.map((row) => <tr key={row.target_date} className="border-b border-border last:border-0"><th scope="row" className="py-4 text-left font-normal">{row.target_date}</th>{valuationScenarios.map((key) => <td key={key} className="figure px-3 py-4 text-right"><div className="font-medium">{f.money(row.scenarios[key].target_price)}</div><div className={cn("mt-1 text-xs", row.scenarios[key].price_space >= 0 ? "text-positive" : "text-negative")}>{f.percent(row.scenarios[key].price_space)}</div></td>)}</tr>)}</tbody></table></div>}
    <details className="border-t border-border pt-3"><summary className="cursor-pointer rounded-lg py-2 text-sm font-medium hover:bg-foreground/[0.04]">{c("Adjust assumptions", "调整假设")}</summary><div className="mt-3 space-y-4">
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">{valuationScenarios.map((key) => <div key={key} className="space-y-3">
      <h4 className="text-sm font-medium">{c(names[key][0], names[key][1])}</h4>
      <div><Label htmlFor={`valuation-pe-${key}`}>{c("Target TTM PE", "目标 TTM PE")}</Label><Input id={`valuation-pe-${key}`} type="number" min="0.01" max="500" step="0.1" value={pe[key]} onChange={(e) => setPe((old) => ({ ...old, [key]: e.target.value }))} aria-invalid={state === "invalid"} aria-describedby="valuation-assumption-help" className="mt-1" /></div>
      <div><Label htmlFor={`valuation-growth-${key}`}>{c("Annual EPS growth (%)", "EPS 年增长率（%）")}</Label><Input id={`valuation-growth-${key}`} type="number" min="-99.9" max="500" step="1" value={growth[key]} onChange={(e) => setGrowth((old) => ({ ...old, [key]: e.target.value }))} aria-invalid={state === "invalid"} aria-describedby="valuation-assumption-help" className="mt-1" /></div>
    </div>)}</div>
    <p id="valuation-assumption-help" className="text-xs text-muted-foreground">{c("Default growth is 0%: constant earnings, not a forecast. PE must be positive and ordered; growth must exceed −100%. Crossing projected scenarios are rejected.", "默认增长率为0%，表示盈利保持不变，不是盈利预测。PE 须为正且依次递增，增长率须高于−100%；目标价情景交叉时需修改假设。")}</p>
    </div></details>
  </Card>;
}
