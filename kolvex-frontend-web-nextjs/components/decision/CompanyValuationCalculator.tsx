"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContentLoading } from "@/components/ui/content-loading";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import { buildCompanyCommand, calculateCompany, companyScenarios, initialCompanyDraft, loadCompanyInputs,
  type CompanyDraft, type CompanyInput, type CompanyInputs, type CompanyModel, type CompanyResult } from "@/lib/companyValuation";
import { useCopy } from "./shared";

const names = { conservative: ["Conservative", "保守"], base: ["Base", "基准"], optimistic: ["Optimistic", "乐观"] } as const;

function NumericField({ label, value, onChange, note, min, max, exclusiveMin = false }: { label: string; value: string; onChange: (value: string) => void; note?: string; min?: number; max?: number; exclusiveMin?: boolean }) {
  const id = useId();
  const invalid = value !== "" && (!Number.isFinite(Number(value)) || (min != null && (Number(value) < min || (exclusiveMin && Number(value) === min))) || (max != null && Number(value) > max));
  const range = min != null && max != null ? `${min} ${exclusiveMin ? "<" : "≤"} x ≤ ${max}` : undefined;
  return <div className="min-w-0 space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" step="any" min={min} max={max} aria-invalid={invalid || undefined} aria-describedby={note || range ? `${id}-note` : undefined} value={value} onChange={e => onChange(e.target.value)} />{(note || range) && <p id={`${id}-note`} className="text-xs text-muted-foreground">{[note, range].filter(Boolean).join(" · ")}</p>}</div>;
}

export default function CompanyValuationCalculator({ symbol }: { symbol: string }) {
  const c = useCopy();
  const resource = useCachedResource(`/api/market/valuation/${symbol}/inputs`, signal => loadCompanyInputs(symbol, signal), { ttl: 300_000, timeout: 45_000 });
  if (resource.loading && !resource.data) return <ContentLoading label={c("Loading company financial inputs…", "正在读取公司财务数据…")} className="min-h-80" />;
  if (!resource.data || resource.data.status !== "available") return <Card className="space-y-3 p-5">
    <h2 className="text-lg font-semibold">{c("Company valuation", "公司估值计算")}</h2>
    <p className="text-sm text-muted-foreground">{resource.data?.status === "unsupported" ? c("Automatic inputs currently cover US companies with USD financials and USD-listed ordinary equity.", "自动取数目前支持美元上市、使用美元财报的美国公司普通股。") : c("Financial inputs are temporarily unavailable. Retry to load a fresh snapshot.", "财务数据暂时不可用，请重试获取。")}</p>
    <Button variant="outline" onClick={resource.refresh} disabled={resource.refreshing}>{c("Retry", "重试")}</Button>
  </Card>;
  return <Calculator key={symbol} data={resource.data} refresh={resource.refresh} refreshing={resource.refreshing} refreshFailed={Boolean(resource.error)} />;
}

function Calculator({ data, refresh, refreshing, refreshFailed }: { data: CompanyInputs; refresh: () => void; refreshing: boolean; refreshFailed: boolean }) {
  const c = useCopy(); const { locale } = useTranslation();
  const region = locale === "zh" ? "zh-CN" : "en-US";
  const money = (v: number | null | undefined, compact = false) => v == null ? "—" : new Intl.NumberFormat(region, { style: "currency", currency: "USD", maximumFractionDigits: 2, ...(compact ? { notation: "compact" as const } : {}) }).format(v);
  const percent = (v: number | null | undefined) => v == null ? "—" : new Intl.NumberFormat(region, { style: "percent", maximumFractionDigits: 1 }).format(v);
  const [model, setModel] = useState<CompanyModel>(data.dcf_exclusion ? "pe" : "dcf");
  const [draft, setDraft] = useState<CompanyDraft>(() => initialCompanyDraft(data));
  const [success, setSuccess] = useState<{ key: string; data: CompanyResult } | null>(null);
  const [request, setRequest] = useState<{ key: string; error?: string; pending?: boolean }>({ key: "" });
  const [retry, setRetry] = useState(0);
  const previousSource = useRef(data);
  useEffect(() => {
    if (previousSource.current.snapshot_id === data.snapshot_id) return;
    const before = initialCompanyDraft(previousSource.current), after = initialCompanyDraft(data);
    setDraft(previous => ({ ...previous,
      inputs: Object.fromEntries((Object.keys(after.inputs) as CompanyInput[]).map(key => [key, previous.edited.includes(key) ? previous.inputs[key] : after.inputs[key]])) as CompanyDraft["inputs"],
      scenarios: Object.fromEntries(companyScenarios.map(name => [name, Object.fromEntries(Object.keys(after.scenarios[name]).map(key => [key, previous.scenarios[name][key] === before.scenarios[name][key] ? after.scenarios[name][key] : previous.scenarios[name][key]]))])) as CompanyDraft["scenarios"],
    }));
    previousSource.current = data;
  }, [data]);
  let commandKey = "", validation = "";
  try { commandKey = JSON.stringify(buildCompanyCommand(data, model, draft)); }
  catch (error) { validation = error instanceof Error ? error.message : "required"; }
  useEffect(() => {
    if (!commandKey) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setRequest({ key: commandKey, pending: true });
      calculateCompany(data.symbol, JSON.parse(commandKey), controller.signal).then(result => {
        if (controller.signal.aborted) return;
        setSuccess({ key: commandKey, data: result }); setRequest({ key: commandKey });
      }).catch(error => {
        if (!controller.signal.aborted) setRequest({ key: commandKey, error: error.status === 409 ? "snapshot" : error.message === "scenario_values_cross" ? "cross" : error.status === 422 ? "invalid" : "network" });
      });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [commandKey, data.symbol, retry]);
  const result = success?.data.model === model && success.data.snapshot_id === data.snapshot_id ? success.data : null;
  const stale = Boolean(result && success?.key !== commandKey);
  const error = request.key === commandKey ? request.error : undefined;
  const pending = Boolean(commandKey && (request.key !== commandKey || request.pending));
  const base = result?.scenarios.base;
  const inputLabels: Record<CompanyInput, string> = {
    revenue: c("Annual / TTM revenue (USD billions)", "全年／TTM 营收（十亿美元）"), eps: c("TTM EPS (USD / share)", "TTM EPS（美元／股）"),
    shares: c("Shares outstanding (millions)", "流通在外股数（百万股）"), cash: c("Nonoperating cash (USD billions)", "非经营现金（十亿美元）"),
    debt: c("Debt (USD billions)", "债务（十亿美元）"), other_claims: c("Other claims (USD billions)", "其他权益请求权（十亿美元）"), tax_rate: c("Tax rate (%)", "税率（%）"),
  };
  const inputKeys: CompanyInput[] = model === "dcf" ? ["revenue", "shares", "cash", "debt", "other_claims", "tax_rate"] : ["eps", "shares"];
  const fields = model === "dcf" ? ["revenue_growth", "operating_margin", "reinvestment_rate", "discount_rate"] : model === "pe" ? ["target_pe"] : ["target_peg", "eps_growth"];
  const bounds: Record<string, { min: number; max: number; exclusiveMin?: boolean }> = { revenue_growth: { min: -100, max: 200, exclusiveMin: true }, operating_margin: { min: -100, max: 100 }, reinvestment_rate: { min: 0, max: 200 }, discount_rate: { min: 0, max: 100, exclusiveMin: true }, target_pe: { min: 0, max: 500, exclusiveMin: true }, target_peg: { min: 0, max: 10, exclusiveMin: true }, eps_growth: { min: 0, max: 200, exclusiveMin: true } };
  const labels: Record<string, string> = { revenue_growth: c("Annual revenue growth (%)", "年营收增长率（%）"), operating_margin: c("Operating margin (%)", "营业利润率（%）"), reinvestment_rate: c("Reinvestment / NOPAT (%)", "再投资／税后营业利润（%）"), discount_rate: c("WACC (%)", "加权平均资本成本 WACC（%）"), target_pe: c("Target PE (×)", "目标 PE（倍）"), target_peg: c("Target PEG (×)", "目标 PEG（倍）"), eps_growth: c("Annual EPS growth, next 3–5Y (%)", "未来3–5年 EPS 年增长率（%）") };
  const originLabel = (key: CompanyInput) => draft.edited.includes(key) ? c("User assumption", "用户假设") : data.origins[key] === "assumed_21_percent" ? c("Assumed 21% — review", "暂按21%假设，请复核") : data.origins[key] === "missing_components_assumed_zero" ? c("Missing components assumed zero — review", "缺失项目暂按0，请复核") : data.origins[key] === "unavailable" ? c("Missing — enter a value", "数据缺失，请填写") : c("Vendor financial input", "供应商财务数据");
  const updateInput = (key: CompanyInput, value: string) => setDraft(previous => ({ ...previous, inputs: { ...previous.inputs, [key]: value }, edited: Array.from(new Set([...previous.edited, key])) }));
  const warning = error === "snapshot" ? c("Financial inputs changed. Refresh inputs to calculate again.", "财务快照已变更，请刷新数据后重新计算。") : error === "cross" ? c("Scenario values cross. Adjust assumptions so conservative ≤ base ≤ optimistic.", "情景估值交叉，请调整假设，使保守值 ≤ 基准值 ≤ 乐观值。") : error === "network" ? c("Calculation could not be completed. Retry or edit an assumption.", "计算暂时失败，请重试或修改假设。") : error ? c("Some assumptions cannot be calculated. Check input ranges and terminal conditions.", "部分假设无法计算，请检查数值范围与终值条件。") : validation === "terminal" ? c("WACC and terminal ROIC must both exceed terminal growth.", "WACC 与永续 ROIC 都必须大于永续增长率。") : validation === "range" ? c("Check the input ranges. Rates use percentage points; PE and PEG must be positive.", "请检查输入范围；增长率等按百分数填写，PE 与 PEG 必须大于0。") : validation ? c("Complete all required financial inputs and scenario assumptions to calculate.", "请补全财务输入及三个情景的假设后计算。") : "";

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold">{c("Company valuation calculator", "公司估值计算器")}</h2><p className="mt-1 text-sm text-muted-foreground">{data.name} · {c("USD · Financial inputs + your assumptions", "USD · 财务数据 + 你的假设")}</p><p className="mt-1 text-xs text-muted-foreground">{c("Revenue basis · ", "营收口径 · ")}{data.income_basis === "ttm_four_quarters" ? c("TTM through vendor period", "TTM 截至供应商财报期") : c("Uses available fiscal year, not TTM", "使用最近可用财年，非 TTM")} {data.income_periods[0] ?? "—"} · {c("Balance sheet", "资产负债表")} {data.balance_period ?? "—"}</p></div>
      <Button variant="outline" onClick={refresh} disabled={refreshing}>{refreshing ? c("Refreshing…", "刷新中…") : c("Refresh financials", "刷新财务数据")}</Button>
    </div>
    {refreshFailed && <p role="status" className="text-sm text-muted-foreground">{c("Refresh failed. The previous financial snapshot is still shown.", "刷新失败，正在使用上次成功获取的财务快照。")}</p>}
    <SegmentedControl label={c("Valuation method", "估值方法")} value={model} onChange={setModel} wrap options={[{ value: "dcf", label: c("DCF · Cash flow", "DCF · 现金流折现"), disabled: Boolean(data.dcf_exclusion) }, { value: "pe", label: "PE" }, { value: "peg", label: "PEG" }]} />
    {data.dcf_exclusion && <p className="text-sm text-muted-foreground">{c("Financial companies and REITs require specialized valuation models; standard FCFF DCF is unavailable.", "金融公司与 REITs 需要专用估值模型，暂不提供标准 FCFF DCF。")}</p>}
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{c("Valuation results", "估值结果")}</h3><p role="status" aria-live="polite" className="text-xs text-muted-foreground">{pending ? c("Calculating…", "计算中…") : stale ? c("Previous valid result · edits not applied", "上次有效结果 · 新假设尚未应用") : result ? c("Calculated from the assumptions below", "已按下方假设计算") : error ? c("Calculation incomplete", "计算未完成") : c("Waiting for assumptions", "等待填写假设")}</p></div>
      <p className="text-sm text-muted-foreground">{c("Market price", "行情价格")} <strong className="figure text-foreground">{money(data.price)}</strong> · {c("Market cap at this price", "按此价格计算的市值")} {money(data.market_cap_reference, true)}<br /><span className="text-xs">{data.quote_time ? new Date(data.quote_time).toLocaleString(region) : c("Quote time unavailable", "行情时间不可用")}</span></p>
      {result?.status === "not_applicable" ? <p className="text-sm">{result.reason === "positive_eps_required" ? c("PE / PEG needs positive EPS. Choose DCF or review the EPS input.", "PE／PEG 需要正 EPS，请切换 DCF 或复核 EPS。") : c("This company needs a specialized financial-sector model. Standard FCFF DCF is unavailable.", "该公司需要金融或房地产行业专用模型，暂不提供标准 FCFF DCF。")}</p> : <div className="grid gap-4 sm:grid-cols-3">{companyScenarios.map(name => {
        const row = result?.scenarios[name];
        return <div key={name} className="min-w-0 space-y-2 rounded-2xl bg-muted/60 p-4"><p className="text-sm font-medium">{c(names[name][0], names[name][1])}</p><p className="figure text-2xl font-semibold">{money(row?.fair_price)}</p><p className="text-xs text-muted-foreground">{c("Model value per share", "模型每股价值")}</p><dl className="space-y-1 text-xs"><div className="flex flex-wrap justify-between gap-2"><dt>{c("Equity value", "股权价值")}</dt><dd className="figure">{money(row?.equity_value, true)}</dd></div>{model === "dcf" && <div className="flex flex-wrap justify-between gap-2"><dt>{c("Enterprise value", "企业价值")}</dt><dd className="figure">{money(row?.enterprise_value, true)}</dd></div>}<div className="flex flex-wrap justify-between gap-2"><dt>{c("Price space", "相对现价空间")}</dt><dd className="figure">{percent(row?.comparison?.price_space)}</dd></div></dl>{row?.status === "nonpositive_equity_value" && <p className="text-xs">{c("Equity value ≤ 0; no positive per-share value.", "股权价值≤0，不输出正每股价值。")}</p>}{row?.status === "not_applicable" && <p className="text-xs">{c("Nonpositive terminal cash flow; this model is not applicable.", "终值现金流非正，此模型不适用。")}</p>}</div>;
      })}</div>}
      <p className="text-xs text-muted-foreground">{c("Scenario estimates depend on your assumptions. They are not analyst consensus or a confidence interval. Price space = model price ÷ quoted price − 1.", "结果取决于输入假设，不代表分析师共识或置信区间。价格空间＝模型每股价值÷标注行情价格−1。")}</p>
    </Card>

    <Card className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{c("Scenario assumptions", "情景假设")}</h3><Button variant="outline" size="sm" disabled={JSON.stringify(draft) === JSON.stringify(initialCompanyDraft(data))} onClick={() => setDraft(initialCompanyDraft(data))}>{c("Reset assumptions", "重置假设")}</Button></div>
      <p className="text-sm text-muted-foreground">{model === "dcf" ? c("Trial defaults: zero revenue growth, reported operating margin, zero forecast reinvestment, WACC 12% / 10% / 8%, terminal growth 2% and ROIC 10%. These are editable trial assumptions, not a calibrated forecast or estimated cost of capital. Forecast reinvestment is the net investment in fixed assets, working capital and other operating assets.", "初始试算：营收零增长、沿用财报营业利润率、预测期再投资为0，WACC为12%／10%／8%，永续增长率2%、ROIC为10%。这些是可修改的试算假设，并非已校准预测或计算得到的资本成本。再投资指固定资产、营运资本等经营资产的净投入。") : model === "pe" ? c("Enter a justified target PE for each scenario. The current market PE is not automatically treated as fair value. Uses TTM EPS, with no future EPS growth applied.", "请为三个情景填写有依据的目标 PE；不会把当前市场 PE 自动当作合理估值。此处使用 TTM EPS，不额外推算未来 EPS。") : c("PEG implies PE = target PEG × annual EPS growth in percentage points. Initial PEG values are trial assumptions. Enter positive, sustainable EPS growth; this method is unsuitable for losses or unstable earnings.", "隐含 PE＝目标 PEG×EPS 年增长率（百分数）。初始 PEG 只是试算假设；请填写正的、可持续的 EPS 增速，亏损或盈利不稳定时不适用。")}</p>
      <div className="grid gap-5 sm:grid-cols-3">{companyScenarios.map(name => <fieldset key={name} className="min-w-0 space-y-4"><legend className="mb-3 text-sm font-semibold">{c(names[name][0], names[name][1])}</legend>{fields.map(key => <NumericField key={key} {...bounds[key]} label={`${c(names[name][0], names[name][1])} · ${labels[key]}`} value={draft.scenarios[name][key]} onChange={value => setDraft(previous => ({ ...previous, scenarios: { ...previous.scenarios, [name]: { ...previous.scenarios[name], [key]: value } } }))} />)}</fieldset>)}</div>
      {model === "dcf" && <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3"><div className="space-y-2"><p className="text-sm font-medium">{c("Forecast period", "预测期")}</p><SegmentedControl label={c("Forecast years", "预测年数")} value={draft.years} onChange={years => setDraft(p => ({ ...p, years }))} options={[{ value: "5", label: c("5 years", "5年") }, { value: "10", label: c("10 years", "10年") }]} /></div><NumericField label={c("Terminal growth (%)", "永续增长率（%）")} value={draft.terminal_growth} onChange={terminal_growth => setDraft(p => ({ ...p, terminal_growth }))} note={c("0–5%; lower than every WACC", "范围0–5%，须低于各情景 WACC")} /><NumericField label={c("Terminal ROIC (%)", "永续 ROIC（%）")} value={draft.terminal_roic} onChange={terminal_roic => setDraft(p => ({ ...p, terminal_roic }))} note={c("Terminal reinvestment = growth / ROIC", "终值再投资率＝永续增长率／ROIC")} /></div>}
      {warning && <p role="status" className="text-sm text-muted-foreground">{warning} {stale && c("The values above are from the last valid calculation.", "上方保留上次有效结果。")}</p>}
      {(error === "network" || error === "snapshot") && <Button variant="outline" onClick={() => { if (error === "snapshot") refresh(); else { setRequest({ key: "" }); setRetry(value => value + 1); } }}>{error === "snapshot" ? c("Refresh inputs", "刷新数据") : c("Retry calculation", "重试计算")}</Button>}
    </Card>

    <Card className="p-4 sm:p-5"><details open={inputKeys.some(key => data.inputs[key] == null)}><summary className="cursor-pointer font-semibold">{c("Financial inputs & sources", "财务输入与来源")}</summary><div className="space-y-5 pt-5">
      <p className="text-sm text-muted-foreground">Yahoo Finance · {data.income_basis === "ttm_four_quarters" ? c("TTM, four contiguous quarters", "连续四季度 TTM") : c("Latest available fiscal year", "最近可用财年")} · {c("Vendor financial periods", "供应商财报期")}: {data.income_periods.join(" / ") || "—"}<br />{c("Balance-sheet period", "资产负债表期")}: {data.balance_period ?? "—"} · {c("Fetched", "获取时间")}: {new Date(data.fetched_at).toLocaleString(region)}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{inputKeys.map(key => <NumericField key={key} label={inputLabels[key]} value={draft.inputs[key]} onChange={value => updateInput(key, value)} note={originLabel(key)} />)}</div>
      <p className="text-xs text-muted-foreground">{c("Shares default to current shares outstanding, not fully diluted shares. Adjust for expected dilution. Cash defaults to all reported cash and short-term investments; review operating cash needs and restrictions. Other claims include preferred equity and noncontrolling interests; missing components default to zero. Debt and other claims use reported book balances as initial approximations; review market values. EPS and share count are current vendor metrics; the financial periods above describe income statements and balance sheets. Financial-period dates follow the vendor’s normalized reporting convention.", "股数默认取当前流通在外股数，并非完全稀释股数，可手动调整预期摊薄。现金默认使用披露的全部现金及短期投资，请复核经营所需及受限现金。其他权益请求权含优先股和少数股东权益，缺失项目暂按0。债务及其他请求权默认使用披露的账面余额近似值，可按市场价值调整。EPS及股数为供应商当前指标，上方财报期标注利润表和资产负债表口径；日期采用供应商标准化口径。")}</p>
      <p className="flex flex-wrap gap-4 text-sm"><a href={data.sources.financials} target="_blank" rel="noreferrer" className="underline underline-offset-4">{c("Income statement source", "利润表来源")}</a><a href={data.sources.balance_sheet} target="_blank" rel="noreferrer" className="underline underline-offset-4">{c("Balance sheet source", "资产负债表来源")}</a></p>
    </div></details></Card>

    {model === "dcf" && base?.enterprise_value != null && <Card className="space-y-4 p-4 sm:p-5"><h3 className="font-semibold">{c("Base case · enterprise to equity", "基准情景 · 企业价值到股权价值")}</h3><dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">{[
      [c("Enterprise value", "企业价值"), money(base.enterprise_value, true)], [c("+ Nonoperating cash", "＋非经营现金"), money(result?.inputs.cash, true)], [c("− Debt", "−债务"), money(result?.inputs.debt, true)],
      [c("− Other claims", "−其他权益请求权"), money(result?.inputs.other_claims, true)], [c("= Equity value", "＝股权价值"), money(base.equity_value, true)], [c("Terminal value / EV", "终值现值／企业价值"), percent(base.terminal_value_share)],
    ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="figure mt-1 font-medium">{value}</dd></div>)}</dl>
      <details><summary className="cursor-pointer text-sm font-medium">{c("Forecast cash flows & sensitivity", "预测现金流与敏感性")}</summary><div className="space-y-5 pt-4">
        <p className="text-xs text-muted-foreground sm:hidden">{c("Scroll tables horizontally to see all columns.", "横向滚动表格可查看全部列。")}</p>
        <div role="region" aria-label={c("Forecast cash flows", "预测现金流表")} tabIndex={0} className="overflow-x-auto rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"><table className="w-full text-left text-xs"><caption className="mb-3 text-left text-muted-foreground">{c("Base case · USD billions · FCFF = NOPAT − net reinvestment", "基准情景 · 十亿美元 · FCFF＝税后营业利润−净再投资")}</caption><thead><tr>{[c("Year", "年份"), c("Revenue", "营收"), "NOPAT", c("Reinvestment", "再投资"), "FCFF", c("Present value", "现值")].map(v => <th key={v} scope="col" className="whitespace-nowrap border-b border-border p-2 font-medium">{v}</th>)}</tr></thead><tbody>{base.forecast?.map(row => <tr key={row.year}>{[row.year, row.revenue / 1e9, row.nopat / 1e9, row.reinvestment / 1e9, row.fcff / 1e9, row.present_value / 1e9].map((v, i) => <td key={i} className="figure border-b border-border p-2">{i === 0 ? v : v.toLocaleString(region, { maximumFractionDigits: 2 })}</td>)}</tr>)}</tbody></table></div>
        <div role="region" aria-label={c("Sensitivity table", "敏感性表")} tabIndex={0} className="overflow-x-auto rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"><table className="w-full text-left text-xs"><caption className="mb-3 text-left text-muted-foreground">{c("Base per-share value · sensitivity to WACC and terminal growth", "基准每股价值 · WACC 与永续增长率敏感性")}</caption><thead><tr><th scope="col" className="p-2">WACC</th>{result?.sensitivity.slice(0, 3).map(v => <th key={v.terminal_growth} scope="col" className="p-2">{percent(v.terminal_growth)}</th>)}</tr></thead><tbody>{[0, 3, 6].map(start => <tr key={start}><th scope="row" className="p-2 font-medium">{percent(result?.sensitivity[start]?.discount_rate)}</th>{result?.sensitivity.slice(start, start + 3).map(cell => <td key={cell.terminal_growth} className="figure p-2">{money(cell.fair_price)}</td>)}</tr>)}</tbody></table></div>
      </div></details>
      <p className="text-xs text-muted-foreground">{c("FCFF discounts operating cash flow at WACC. Terminal cash flow includes reinvestment at growth / ROIC. Equity value = enterprise value + nonoperating cash − debt − other claims. Per-share value = equity value / entered share count.", "FCFF 按 WACC 折现经营现金流，终值按增长率／ROIC 扣除必要再投资。股权价值＝企业价值＋非经营现金−债务−其他权益请求权；每股价值＝股权价值／输入股数。")}</p>
    </Card>}
  </div>;
}
