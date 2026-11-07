"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MultipleChartSkeleton } from "@/components/decision/ValuationSkeletons";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useCachedResource } from "@/hooks/useCachedResource";
import { loadSalesHistory, type SalesHistoryEvent } from "@/lib/companyValuation";
import { useTranslation } from "@/lib/i18n";
import { loadValuation } from "@/lib/stockValuation";
import { useCopy } from "./shared";

/** Reviewed EPS pipeline: these three get PE. Everyone else gets P/S, which also works for losses. */
export const PE_HISTORY_SYMBOLS = ["NVDA", "AAPL", "MSFT"];

interface Row { date: string; value: number | null; price: number; eventId?: string | null }
interface Reference { p25: number; p50: number; p75: number }

export default function ValuationHistoryCard({ symbol }: { symbol: string }) {
  return PE_HISTORY_SYMBOLS.includes(symbol) ? <PeHistory symbol={symbol} /> : <SalesHistory symbol={symbol} />;
}

function Unavailable({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useCopy();
  return <Card className="space-y-3 p-4 sm:p-5"><h3 className="font-semibold">{c("Valuation history", "历史估值走势")}</h3><p className="text-sm text-muted-foreground">{message}</p>{onRetry && <Button variant="outline" onClick={onRetry}>{c("Retry", "重试")}</Button>}</Card>;
}

function PeHistory({ symbol }: { symbol: string }) {
  const c = useCopy();
  const resource = useCachedResource(`/api/market/valuation/${symbol}/history?years=5`, signal => loadValuation(symbol, 5, signal, true), { ttl: 600_000, timeout: 330_000 });
  const data = resource.data && "points" in resource.data ? resource.data : null;
  const rows = useMemo<Row[]>(() => data?.points.map(p => ({ date: p.date, value: p.pe, price: p.price })) ?? [], [data]);
  if (resource.loading && !data) return <MultipleChartSkeleton label={c("Preparing source-linked PE history…", "正在整理有来源的 PE 历史，首次计算可能需要几分钟…")} />;
  if (!data) return <Unavailable message={c("Valuation history is temporarily unavailable.", "历史估值暂时无法读取。")} onRetry={resource.refresh} />;
  const m = data.current.calibration.multiples;
  return <MultipleChart metric="PE" rows={rows} asOf={data.as_of} current={data.current.pe}
    reference={m ? { p25: m.conservative, p50: m.base, p75: m.optimistic } : null}
    note={c("PE = close ÷ TTM EPS from SEC filings available at the time. Open the history view for scenario references and filing sources.", "PE＝收盘价÷当时已公开 SEC 财报的 TTM EPS。情景参考值和财报来源见“历史估值走势”。")} />;
}

function SalesHistory({ symbol }: { symbol: string }) {
  const c = useCopy();
  const resource = useCachedResource(`/api/market/valuation/${symbol}/sales-history?years=5`, signal => loadSalesHistory(symbol, signal), { ttl: 600_000, timeout: 50_000 });
  const data = resource.data;
  const rows = useMemo<Row[]>(() => data?.points?.map(p => ({ date: p.date, value: p.ps, price: p.price, eventId: p.event_id })) ?? [], [data]);
  if (resource.loading && !data) return <MultipleChartSkeleton label={c("Reading SEC filings and prices…", "正在读取 SEC 财报和历史股价…")} />;
  if (!data) return <Unavailable message={c("Valuation history is temporarily unavailable.", "历史估值暂时无法读取。")} onRetry={resource.refresh} />;
  if (data.status !== "available" || !data.points || !data.as_of) return <Unavailable message={
    data.reason === "share_basis_unverified" ? c("SEC share counts could not be reconciled with this share class, so no chart is shown.", "SEC 股本口径与该股票类别对不上，因此不显示走势图。")
    : data.status === "unsupported" ? c("Automatic history covers USD-listed companies that file with the SEC.", "自动历史目前覆盖在 SEC 申报、以美元上市的公司。")
    : c("SEC filings do not have enough current revenue and share data for a reliable chart.", "SEC 财报里没有足够且最新的营收和股本数据，无法画出可靠的走势。")} />;
  return <MultipleChart metric="P/S" rows={rows} asOf={data.as_of} current={data.current?.ps ?? null} reference={data.reference ?? null}
    percentile={data.reference?.current_percentile} events={data.events}
    note={c("P/S = closing market cap ÷ TTM revenue, using only SEC filings published before each session. No AI or estimates are involved. Market cap uses SEC weighted-average basic shares, split-adjusted. Gaps mean filings lack usable data.", "P/S＝收盘市值÷TTM 营收，每个交易日只使用此前已公开的 SEC 财报，没有 AI 或估算成分。市值按 SEC 加权平均基本股数计算并做拆股调整。缺口表示财报缺少可用数据。")} />;
}

function MultipleChart({ metric, rows, asOf, current, reference, percentile, events, note }: { metric: "PE" | "P/S"; rows: Row[]; asOf: string; current: number | null; reference: Reference | null; percentile?: number; events?: Record<string, SalesHistoryEvent>; note: string }) {
  const c = useCopy(); const { locale } = useTranslation();
  const region = locale === "zh" ? "zh-CN" : "en-US";
  const number = (v: number | null | undefined, digits = 2) => v == null ? "—" : new Intl.NumberFormat(region, { maximumFractionDigits: digits }).format(v);
  const money = (v: number | null | undefined) => v == null ? "—" : new Intl.NumberFormat(region, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
  const [view, setView] = useState<"multiple" | "price">("multiple");
  const [years, setYears] = useState("5");
  const [selected, setSelected] = useState<string | null>(null);
  const cutoff = `${Number(asOf.slice(0, 4)) - Number(years)}${asOf.slice(4)}`;
  const shown = useMemo(() => rows.filter(row => row.date >= cutoff), [rows, cutoff]);
  const index = Math.max(0, selected ? shown.findIndex(row => row.date >= selected) : shown.length - 1);
  const row = shown[index];
  const event = row?.eventId ? events?.[row.eventId] : undefined;
  const isMultiple = view === "multiple";
  const refs = isMultiple && reference ? [reference.p25, reference.p50, reference.p75] : [];
  return <Card className="space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold">{c("Valuation history", "历史估值走势")} · {metric}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{c("Current", "当前")} <strong className="figure text-foreground">{number(current)}×</strong>{percentile != null && <> · {c("Higher than", "高于过去5年")} <span className="figure">{Math.round(percentile * 100)}%</span> {c("of the past 5 years' sessions", "的交易日")}</>}</p></div>
      <div className="flex flex-wrap gap-2">
        <SegmentedControl label={c("History chart", "历史图表")} value={view} onChange={setView} options={[{ value: "multiple", label: metric }, { value: "price", label: c("Price", "股价") }]} />
        <SegmentedControl label={c("History range", "历史范围")} value={years} onChange={value => { setYears(value); setSelected(null); }} options={[{ value: "1", label: c("1Y", "1年") }, { value: "3", label: c("3Y", "3年") }, { value: "5", label: c("5Y", "5年") }]} />
      </div>
    </div>
    {reference && isMultiple && <p className="text-xs text-muted-foreground">{c("Dashed lines, past 5 years", "虚线为过去5年")}: P25 <span className="figure">{number(reference.p25)}×</span> · {c("median", "中位数")} <span className="figure">{number(reference.p50)}×</span> · P75 <span className="figure">{number(reference.p75)}×</span></p>}
    <div className="h-72 w-full min-w-0 sm:h-80" role="img" aria-label={c(`Daily ${metric} history. Use the session buttons below to read values by keyboard.`, `每日 ${metric} 历史，可用下方交易日按钮逐日读取。`)}>
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={shown} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} onClick={state => { const point = state?.activePayload?.[0]?.payload as Row | undefined; if (point) setSelected(point.date); }}>
        <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeOpacity={0.5} />
        <XAxis dataKey="date" minTickGap={65} tickFormatter={(value: string) => value.slice(0, 7)} tick={{ fontSize: 12, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <YAxis width={58} tickFormatter={(v: number) => `${number(v, 1)}${isMultiple ? "×" : ""}`} tick={{ fontSize: 12, fill: "rgb(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
        <Tooltip content={({ active, payload }) => { const p = payload?.[0]?.payload as Row | undefined; if (!active || !p) return null; return <div className="rounded-2xl border border-border bg-card p-3 text-xs text-foreground"><p className="mb-2 font-medium">{p.date}</p><p>{c("Price", "股价")}: {money(p.price)}</p><p>{metric}: {number(p.value)}×</p></div>; }} />
        {refs.map((value, i) => <ReferenceLine key={i} y={value} stroke="rgb(var(--positive))" strokeDasharray="5 4" strokeOpacity={i === 1 ? 1 : .5} />)}
        <Line dataKey={isMultiple ? "value" : "price"} type="linear" stroke="rgb(var(--foreground))" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
      </ComposedChart></ResponsiveContainer>
    </div>
    {row && <div className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm">{row.date} · {c("Close", "收盘价")} <span className="figure">{money(row.price)}</span> · {metric} <span className="figure">{number(row.value)}×</span></p>
        <div className="flex gap-2"><Button variant="outline" size="sm" disabled={index <= 0} onClick={() => setSelected(shown[index - 1].date)}>{c("Previous", "上一交易日")}</Button><Button variant="outline" size="sm" disabled={index >= shown.length - 1} onClick={() => setSelected(shown[index + 1].date)}>{c("Next", "下一交易日")}</Button></div>
      </div>
      {event && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer rounded-lg py-2 hover:text-foreground">{c("Revenue inputs & SEC sources", "营收输入与 SEC 来源")} · {event.period_end}</summary>
        <ul className="mt-2 space-y-2">{event.inputs.map(input => <li key={`${input.start}-${input.end}`} className="flex flex-wrap justify-between gap-2"><span>{input.start} — {input.end} · {money(input.value)}</span><a href={input.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">{input.form} · {c("Filed", "申报")} {input.filed}</a></li>)}</ul>
      </details>}
    </div>}
    <p className="text-xs text-muted-foreground">{note} {c("A high or low multiple is not by itself a buy or sell signal.", "倍数高低本身不构成买卖信号。")}</p>
  </Card>;
}
