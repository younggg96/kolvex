"use client";

import { InfoTip } from "@/components/ui/info-tip";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CompanyLogo from "@/components/ui/company-logo";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTranslation } from "@/lib/i18n";
import { barShare, formatPremium, type ActivityCandidate, type ActivityCandidates, type ActivityContract, type ActivityRun, type ActivitySession, type Contributor, type SymbolSource } from "@/lib/optionsActivity";
import { marketStockHref } from "@/lib/stockLinks";
import { cn } from "@/lib/utils";

export function useSessionLabel() {
  const c = useCopy();
  return (session: ActivitySession) =>
    ({ pre: c("Pre-market", "盘前"), intraday: c("Midday", "盘中"), post: c("After close", "盘后") })[session];
}

const tone = (value: number | null | undefined) =>
  !value ? "" : value > 0 ? "text-positive" : "text-negative";
const fixed = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(digits);
const pct = (value: number | null | undefined, signed = false) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${signed && value > 0 ? "+" : ""}${value.toFixed(2)}%`;
const optionsHref = (symbol: string) => `${marketStockHref(symbol)}?tab=options`;

const chip = "rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground";

/** Why a symbol joined this run beyond the fixed watchlist. Core-only symbols show nothing. */
function SourceTags({ sources }: { sources?: SymbolSource[] }) {
  const c = useCopy();
  const labels: Record<Exclude<SymbolSource, "core">, [string, string]> = {
    earnings: [c("Earnings ahead", "财报前"), c("Reports earnings within the next 7 days", "未来 7 天内发布财报")],
    mover: [c("Mover", "异动"), c("Among today's biggest price moves", "今日涨跌幅居前")],
    active: [c("Volume", "放量"), c("Volume well above its 3-month average", "成交量明显高于 3 个月均量")],
    kol: [c("Buzz", "热议"), c("Widely discussed on Reddit, X or YouTube", "Reddit、X、YouTube 博主热议")],
    manual: [c("Manual", "手动"), c("Added by an admin for this run", "管理员为本轮手动添加")],
  };
  const shown = (sources ?? []).filter((s): s is Exclude<SymbolSource, "core"> => s !== "core");
  if (!shown.length) return null;
  return (
    <>
      {shown.map((source) => (
        <span key={source} title={labels[source][1]} className={cn(chip, "whitespace-nowrap")}>
          {labels[source][0]}
        </span>
      ))}
    </>
  );
}

function useSourcesBySymbol(run?: ActivityRun) {
  return useMemo(() => new Map((run?.payload.tickers ?? []).map((t) => [t.symbol, t.sources])), [run]);
}

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3.5">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
        {title}
        {note && <InfoTip label={title}>{note}</InfoTip>}
      </h2>
    </div>
  );
}

function useEtTime() {
  const { locale } = useTranslation();
  return (iso: string) =>
    new Date(iso).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
      timeZone: "America/New_York",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " ET";
}

export function SummaryCard({ run }: { run: ActivityRun }) {
  const c = useCopy();
  const { locale } = useTranslation();
  const etTime = useEtTime();
  const sessionLabel = useSessionLabel();
  const summary = run.summary;
  const points = summary ? (locale === "zh" ? summary.points_zh : summary.points_en) : [];
  const sentiment = summary?.sentiment;
  const sentimentLabel = { bullish: c("Call-heavy", "偏多"), bearish: c("Put-heavy", "偏空"), mixed: c("Mixed", "分歧") };

  return (
    <section aria-labelledby="activity-summary" className="rounded-3xl border border-foreground/10 glass-card bg-card-glass p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="activity-summary" className="text-lg font-semibold">
          {c("Key points", "重点摘要")}
        </h2>
        {sentiment && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              sentiment === "bullish" && "bg-positive/10 text-positive",
              sentiment === "bearish" && "bg-negative/10 text-negative",
              sentiment === "mixed" && "bg-muted text-muted-foreground",
            )}
          >
            {sentimentLabel[sentiment]}
          </span>
        )}
      </div>
      {points.length > 0 && (
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[0.9375rem] leading-7">
          {points.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        {sessionLabel(run.session)} · {etTime(run.run_at)}
        {run.data_date && run.data_date !== run.trade_date && ` · ${c("Volumes from", "成交数据来自")} ${run.data_date}`}
        {" · "}
        {c(`${run.universe_size} symbols`, `${run.universe_size} 个标的`)}
        {run.failed_symbols.length > 0 && ` · ${c("Unavailable", "未取到")}: ${run.failed_symbols.join(", ")}`}
        {summary?.source === "template" && ` · ${c("Auto-generated without AI", "未使用 AI，按模板生成")}`}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {c(
          "Net premium = call premium traded − put premium traded. The free delayed data has no buy/sell side, so this shows where money traded, not whether it was bought or sold. Large puts are often hedges.",
          "净权利金 = Call 成交额 − Put 成交额。免费的延迟数据没有主动买卖方向，所以这里反映资金成交在哪里，而不是买入还是卖出。大额 Put 常常是对冲。",
        )}
      </p>
    </section>
  );
}

export function MarketOverview({ run }: { run: ActivityRun }) {
  const c = useCopy();
  const sessionLabel = useSessionLabel();
  const m = run.payload.market;
  const vsBaseline = m.pc_premium_ratio !== null && m.pc_baseline ? m.pc_premium_ratio / m.pc_baseline - 1 : null;
  const series = run.day_runs
    .filter((r) => r.market)
    .map((r) => ({ name: sessionLabel(r.session), call: r.market!.call_premium, put: r.market!.put_premium }));

  const figures: [string, string, string][] = [
    [c("Net premium", "净权利金"), formatPremium(m.net_premium, true), tone(m.net_premium)],
    [c("Call premium", "Call 成交额"), formatPremium(m.call_premium), ""],
    [c("Put premium", "Put 成交额"), formatPremium(m.put_premium), ""],
    [c("Put/Call (premium)", "Put/Call 成交额比"), fixed(m.pc_premium_ratio), ""],
  ];

  return (
    <section aria-labelledby="activity-market">
      <SectionHeader
        title={c("Market overview", "市场概览")}
        note={
          m.dynamic_scanned
            ? c(
                `Totals cover the ${m.tickers_scanned}-symbol core watchlist, so they compare with earlier runs. ${m.dynamic_scanned} more symbols tagged Mover, Volume or Buzz were added for this run and appear in the rankings below. Contracts within ±15% of price and 45 days.`,
                `总额只统计 ${m.tickers_scanned} 个核心标的，便于和往期对比。另有 ${m.dynamic_scanned} 个按异动、放量、热议临时加入的标的，只出现在下方排行中。合约范围：现价 ±15%、45 天内到期。`,
              )
            : c(`${m.tickers_scanned} symbols, contracts within ±15% of price and 45 days`, `${m.tickers_scanned} 个标的，现价 ±15%、45 天内到期的合约`)
        }
      />
      <div className="rounded-3xl border border-foreground/10 glass-card bg-card-glass p-4 sm:p-6">
        <dl className="grid grid-cols-2 gap-6 border-b border-border pb-6 lg:grid-cols-4">
          {figures.map(([label, value, className]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={cn("figure mt-2 text-lg font-semibold", className)}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {vsBaseline !== null && (
            <span className="rounded-full bg-muted px-2.5 py-1">
              {c("P/C vs baseline", "P/C 较基线")}{" "}
              <span className={cn("figure", vsBaseline > 0 ? "text-negative" : "text-positive")}>{pct(vsBaseline * 100, true)}</span>
              <span className="text-muted-foreground">
                {" "}
                ({c(`median of last ${m.baseline_runs} runs`, `前 ${m.baseline_runs} 次同时段中位数`)} {fixed(m.pc_baseline)})
              </span>
            </span>
          )}
          <span className="rounded-full bg-muted px-2.5 py-1">
            ETF <span className={cn("figure", tone(m.etf_net_premium))}>{formatPremium(m.etf_net_premium, true)}</span>
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1">
            {c("Stocks", "个股")} <span className={cn("figure", tone(m.stock_net_premium))}>{formatPremium(m.stock_net_premium, true)}</span>
          </span>
        </div>
        {series.length > 1 && (
          <div className="mt-6 h-56" role="img" aria-label={c("Call and put premium by run today", "今日各时点 Call 与 Put 成交额")}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => formatPremium(v)} tickLine={false} axisLine={false} fontSize={12} width={64} />
                <Tooltip formatter={(v: number) => formatPremium(v)} cursor={{ fill: "rgb(var(--positive) / 0.04)" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="call" name="Call" fill="rgb(var(--positive-fill))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="put" name="Put" fill="rgb(var(--negative-fill))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

function ContributorRow({ item, max }: { item: Contributor; max: number }) {
  const share = barShare(item.net_premium, max) * 50;
  const positive = item.net_premium > 0;
  return (
    <li className="grid grid-cols-[8rem_1fr_5.5rem] items-center gap-3 py-1.5">
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
        <Link href={optionsHref(item.symbol)} className="font-semibold hover:underline">
          {item.symbol}
        </Link>
        <SourceTags sources={item.sources} />
      </span>
      <div className="relative h-2.5 rounded-full bg-muted" aria-hidden>
        <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <span
          className={cn("absolute inset-y-0 rounded-full", positive ? "left-1/2 bg-positive-fill" : "right-1/2 bg-negative-fill")}
          style={{ width: `${share}%` }}
        />
      </div>
      <span className={cn("figure text-right text-sm font-medium", tone(item.net_premium))}>{formatPremium(item.net_premium, true)}</span>
    </li>
  );
}

export function ContributionBoard({ run }: { run: ActivityRun }) {
  const c = useCopy();
  const { positive, negative, positive_total, negative_total } = run.payload.contributors;
  const max = Math.max(0, ...positive.map((t) => Math.abs(t.net_premium)), ...negative.map((t) => Math.abs(t.net_premium)));
  if (!positive.length && !negative.length) return null;
  return (
    <section aria-labelledby="activity-board">
      <SectionHeader title={c("Net premium leaders", "净权利金贡献榜")} note={c("Net = call premium − put premium, per symbol", "每个标的的 Call 成交额 − Put 成交额")} />
      <div className="rounded-3xl border border-foreground/10 glass-card bg-card-glass p-4 md:p-5">
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-negative">◀ {c("Put-heavy", "负贡献")} {formatPremium(negative_total, true)}</span>
          <span className="text-positive">{c("Call-heavy", "正贡献")} {formatPremium(positive_total, true)} ▶</span>
        </div>
        <ul>
          {positive.map((item) => (
            <ContributorRow key={item.symbol} item={item} max={max} />
          ))}
        </ul>
        {positive.length > 0 && negative.length > 0 && <div className="my-2 border-t border-border" />}
        <ul>
          {[...negative].reverse().map((item) => (
            <ContributorRow key={item.symbol} item={item} max={max} />
          ))}
        </ul>
      </div>
    </section>
  );
}

export type Filter = "all" | "etf" | "stock" | "earnings";

/** Expiry as the reader's locale writes month/day, from the ISO date the API returns. */
function useExpiryLabel() {
  const { locale } = useTranslation();
  return (iso: string) =>
    new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
}

/** Volume and open interest are counts: group them the way the reader's locale does. */
function useCountLabel() {
  const { locale } = useTranslation();
  return (value: number) => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US").format(value);
}

/**
 * A ranked contract is a row, not a card: the eye compares premium down one column.
 * The contract's identity, size, price and the volume/open-interest signal each own a
 * column, and the expansion is an explicit button so nothing pretends to be a link.
 */
function ContractRow({
  item,
  max,
  index,
  sources,
}: {
  item: ActivityContract;
  max: number;
  index: number;
  sources?: SymbolSource[];
}) {
  const c = useCopy();
  const { locale } = useTranslation();
  const expiry = useExpiryLabel();
  const count = useCountLabel();
  const [open, setOpen] = useState(false);
  const call = item.type === "call";
  const detailsId = `activity-contract-${index}`;
  const heavyVolume = item.vol_oi !== null && item.vol_oi >= 3;

  const detail: [string, string][] = [
    [c("Volume", "成交量"), count(item.volume)],
    [c("Open interest", "持仓量"), count(item.open_interest)],
    ["IV", item.iv === null ? "—" : pct(item.iv * 100)],
    ["Delta", fixed(item.delta, 3)],
    [c("Out of the money", "价外幅度"), pct(item.otm_pct)],
    [c("Last trade", "最近成交"), item.last === null ? "—" : `$${fixed(item.last)}`],
    [c("Expiration", "到期日"), item.expiration],
    [c("Contract", "合约"), item.symbol],
  ];

  return (
    <>
      <tr className="border-t border-border align-middle transition-colors hover:bg-foreground/[0.03]">
        <th scope="row" className="py-2.5 pl-3 pr-2 text-left font-semibold">
          <Link
            href={optionsHref(item.underlying)}
            className="inline-flex items-center gap-2 rounded-full underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span aria-hidden="true"><CompanyLogo symbol={item.underlying} size="xs" /></span>
            <span className="figure text-[0.9375rem]">{item.underlying}</span>
          </Link>
        </th>
        <td className="px-2 py-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="figure text-[0.9375rem] font-medium">
              ${item.strike}{" "}
              <span className={call ? "text-positive" : "text-negative"}>{call ? "C" : "P"}</span>
            </span>
            <span className="figure text-xs text-muted-foreground">
              {expiry(item.expiration)} · {c(`${item.dte}d`, `${item.dte} 天`)}
            </span>
            {item.flags.new_positions && <span className={chip}>{c("New", "新开仓")}</span>}
            {item.flags.crosses_earnings && <span className={chip}>{c("Earnings", "跨财报")}</span>}
            <SourceTags sources={sources} />
          </div>
        </td>
        <td className="w-[5.5rem] px-2 py-2.5 text-right sm:w-[7.5rem]">
          <span className="figure text-[0.9375rem] font-semibold">{formatPremium(item.premium)}</span>
        </td>
        <td className="hidden w-[5rem] px-2 py-2.5 text-right text-sm text-muted-foreground sm:table-cell">
          <span className="figure">${fixed(item.price)}</span>
        </td>
        <td className="hidden w-[5.5rem] px-2 py-2.5 text-right text-sm text-muted-foreground md:table-cell">
          <span className="figure">{count(item.volume)}</span>
        </td>
        <td className="hidden w-[5.5rem] px-2 py-2.5 text-right text-sm text-muted-foreground lg:table-cell">
          <span className="figure">{count(item.open_interest)}</span>
        </td>
        <td className="hidden w-[4.5rem] px-2 py-2.5 text-right text-sm sm:table-cell">
          <span className={cn("figure", heavyVolume ? "font-medium text-foreground" : "text-muted-foreground")}>
            {item.vol_oi === null ? "—" : `${fixed(item.vol_oi, 1)}×`}
          </span>
        </td>
        <td className="w-10 py-2.5 pl-1 pr-2 text-right">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            aria-label={c(
              `${open ? "Hide" : "Show"} details for ${item.underlying} $${item.strike} ${call ? "call" : "put"}`,
              `${open ? "收起" : "展开"} ${item.underlying} $${item.strike} ${call ? "看涨" : "看跌"}详情`,
            )}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
          </button>
        </td>
      </tr>
      {open && (
        <tr id={detailsId} className="border-t border-border bg-foreground/[0.02]">
          <td colSpan={6} className="px-3 pb-4 pt-3">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              {detail.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="figure mt-0.5 break-all">{value}</dd>
                </div>
              ))}
            </dl>
            <Link
              href={optionsHref(item.underlying)}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {c(`Open ${item.underlying} options chain`, `查看 ${item.underlying} 期权链`)} →
            </Link>
          </td>
        </tr>
      )}
    </>
  );
}

const CONTRACTS_SHOWN = 20;

export function UnusualContracts({
  run,
  filter: controlled,
  onFilterChange,
}: {
  run: ActivityRun;
  /** Controlled by the page so the group can live in the URL. */
  filter?: Filter;
  onFilterChange?: (filter: Filter) => void;
}) {
  const c = useCopy();
  const [uncontrolled, setUncontrolled] = useState<Filter>("all");
  const filter = controlled ?? uncontrolled;
  const [expanded, setExpanded] = useState(false);
  const setFilter = (next: Filter) => {
    setUncontrolled(next);
    setExpanded(false);
    onFilterChange?.(next);
  };
  const sourcesOf = useSourcesBySymbol(run);
  const all = run.payload.contracts;
  const etf = all.filter((x) => x.is_etf).length;
  const beforeEarnings = (x: ActivityContract) => Boolean(sourcesOf.get(x.underlying)?.includes("earnings"));
  const earnings = all.filter(beforeEarnings).length;
  const matching = all.filter((x) =>
    filter === "all" ? true : filter === "earnings" ? beforeEarnings(x) : (filter === "etf") === x.is_etf,
  );
  const shown = expanded ? matching : matching.slice(0, CONTRACTS_SHOWN);
  const max = Math.max(0, ...all.map((x) => x.premium));

  return (
    <section aria-labelledby="activity-contracts">
      <SectionHeader
        title={c("Largest contracts", "异动合约")}
        note={c("Ranked by premium traded, largest first: the 20 largest overall plus the 3 largest of every scanned symbol. Volume/Open interest above 3× is bold: more contracts changed hands than were already open.", "按成交权利金从大到小排序：全部标的中最大的 20 个，加上每个扫描标的各自最大的 3 个。量/持仓 超过 3 倍加粗：当日成交量超过原有持仓量。")}
      />
      <SegmentedControl
        size="sm"
        className="mb-3"
        label={c("Contract type", "合约类型")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: `${c("All", "全部")} ${all.length}` },
          { value: "etf", label: `${c("ETFs", "ETF指数")} ${etf}` },
          { value: "stock", label: `${c("Stocks", "个股")} ${all.length - etf}` },
          ...(earnings || filter === "earnings" ? [{ value: "earnings" as const, label: `${c("Earnings ahead", "财报前")} ${earnings}` }] : []),
        ]}
      />
      <div className="overflow-x-auto rounded-3xl border border-foreground/10 glass-card bg-card-glass">
        <table className="w-full table-fixed text-sm sm:min-w-[560px]">
          <caption className="sr-only">
            {c(
              `${shown.length} largest ${filter === "stock" ? "stock" : filter === "etf" ? "ETF" : filter === "earnings" ? "pre-earnings" : ""} option contracts by premium traded`,
              `成交权利金最大的 ${shown.length} 个${filter === "stock" ? "个股" : filter === "etf" ? "ETF" : filter === "earnings" ? "财报前" : ""}期权合约`,
            )}
          </caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="w-[4.5rem] py-2.5 pl-3 pr-2 text-left font-medium sm:w-[5.5rem]">{c("Symbol", "标的")}</th>
              <th scope="col" className="px-2 py-2.5 text-left font-medium">{c("Contract", "合约")}</th>
              <th scope="col" className="w-[5.5rem] px-2 py-2.5 text-right font-medium sm:w-[7.5rem]">{c("Premium", "权利金")}</th>
              <th scope="col" className="hidden w-[5rem] px-2 py-2.5 text-right font-medium sm:table-cell">{c("Avg price", "均价")}</th>
              <th scope="col" className="hidden w-[5.5rem] px-2 py-2.5 text-right font-medium md:table-cell">{c("Volume", "成交量")}</th>
              <th scope="col" className="hidden w-[5.5rem] px-2 py-2.5 text-right font-medium lg:table-cell">{c("Open interest", "持仓量")}</th>
              <th scope="col" className="hidden w-[4.5rem] px-2 py-2.5 text-right font-medium sm:table-cell">Vol/OI</th>
              <th scope="col" className="w-10 py-2.5 pl-1 pr-2"><span className="sr-only">{c("Details", "详情")}</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {c("No contracts in this group for this run.", "这个分类本次没有合约。")}
                </td>
              </tr>
            ) : (
              shown.map((item, index) => <ContractRow key={item.symbol} item={item} max={max} index={index} sources={sourcesOf.get(item.underlying)} />)
            )}
          </tbody>
        </table>
      </div>
      {matching.length > CONTRACTS_SHOWN && (
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? c("Show fewer", "收起") : c(`Show all ${matching.length}`, `显示全部 ${matching.length} 个`)}
            <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </Button>
        </div>
      )}
    </section>
  );
}

function CandidateCard({ item, sources }: { item: ActivityCandidate; sources?: SymbolSource[] }) {
  const c = useCopy();
  const { locale } = useTranslation();
  const expiry = useExpiryLabel();
  const zh = locale === "zh";
  const call = item.type === "call";
  const confidence = { low: c("Low confidence", "低置信度"), medium: c("Medium confidence", "中置信度"), high: c("High confidence", "高置信度") };
  const reasons: [string, string][] = [
    [c("Why this direction", "方向理由"), zh ? item.thesis_zh : item.thesis_en],
    [c("Key risks", "关键风险"), zh ? item.risk_zh : item.risk_en],
    [c("No longer holds if", "失效条件"), zh ? item.invalidation_zh : item.invalidation_en],
  ];

  return (
    <li className="min-w-0 rounded-3xl border border-foreground/10 glass-card bg-card-glass p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Link
            href={optionsHref(item.underlying)}
            className="mr-0.5 inline-flex min-w-0 items-center gap-2 rounded-full underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span aria-hidden="true"><CompanyLogo symbol={item.underlying} size="sm" /></span>
            <span className="figure text-[0.9375rem] font-semibold">{item.underlying}</span>
          </Link>
          <SourceTags sources={sources} />
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{confidence[item.confidence]}</span>
      </div>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="figure text-lg font-semibold">${item.strike}</span>
        <span className={cn("text-sm font-medium", call ? "text-positive" : "text-negative")}>{call ? c("Call · upside", "Call · 看涨") : c("Put · downside", "Put · 看跌")}</span>
        <span className="figure text-xs text-muted-foreground">{expiry(item.expiration)} · {c(`${item.dte}d`, `${item.dte} 天`)}</span>
        {item.flags.crosses_earnings && <span className={chip}>{c("Earnings", "跨财报")}</span>}
      </p>
      <p className="figure mt-1 text-xs text-muted-foreground">
        {c("Traded", "成交额")} {formatPremium(item.premium)}
        {item.vol_oi !== null && ` · ${c("Vol/OI", "量/持仓")} ${fixed(item.vol_oi, 1)}×`}
        {item.price !== null && ` · ${c("Avg", "均价")} $${fixed(item.price)}`}
      </p>
      <dl className="mt-4 space-y-3 border-t border-border pt-4">
        {reasons.map(([label, text]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm leading-6">{text}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

export function ResearchCandidates({ candidates, run }: { candidates?: ActivityCandidates | null; run?: ActivityRun }) {
  const c = useCopy();
  const sourcesOf = useSourcesBySymbol(run);
  if (!candidates) return null;
  const title = c("AI research candidates", "AI 研究候选");
  return (
    <section aria-label={title}>
      <SectionHeader
        title={title}
        note={c(
          "Picked by AI from contracts in this run, with expirations at least 7 days out. The same for every reader and not based on your holdings: contracts to research, not orders to place. The delayed data has no buy/sell side, so premium traded is not a buy signal, and large puts are often hedges.",
          "由 AI 从本轮实际成交的合约中挑选，到期日至少在 7 天后。所有用户看到的内容相同，不基于你的持仓，是值得进一步研究的合约，而不是下单指令。延迟数据没有主动买卖方向，成交额不代表买入信号，大额 Put 常常是对冲。",
        )}
      />
      {candidates.status === "ok" && candidates.items.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {candidates.items.map((item) => <CandidateCard key={item.symbol} item={item} sources={sourcesOf.get(item.underlying)} />)}
        </ul>
      ) : (
        <p className="rounded-3xl border border-foreground/10 glass-card bg-card-glass p-4 text-sm text-muted-foreground md:p-5">
          {c("AI candidates are unavailable for this run.", "本轮 AI 研究候选暂不可用。")}
        </p>
      )}
    </section>
  );
}

export function TickerLevels({ run }: { run: ActivityRun }) {
  const c = useCopy();
  const tickers = run.payload.tickers.filter((t) => t.call_premium + t.put_premium > 0);
  if (!tickers.length) return null;
  return (
    <section aria-labelledby="activity-levels">
      <SectionHeader
        title={c("Implied ranges and key levels", "隐含区间与关键价位")}
        note={c(
          "Options-implied ranges are not forecasts. Gamma level = strike with the largest dealer gamma exposure; max pain uses the expiration with the most open interest.",
          "期权隐含区间不是走势预测。Gamma 价位是做市商 Gamma 暴露最大的行权价；Max Pain 取持仓量最大的到期日。",
        )}
      />
      <div className="overflow-x-auto rounded-3xl border border-foreground/10 glass-card bg-card-glass">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-foreground/[0.03] text-xs text-muted-foreground">
            <tr>
              {[c("Symbol", "标的"), c("Price", "现价"), c("Net premium", "净权利金"), c("P/C (baseline)", "P/C（基线）"), c("Implied range", "隐含区间"), "Max Pain", c("Gamma level", "Gamma 价位"), c("Earnings", "财报")].map(
                (label, index) => (
                  <th key={label} scope="col" className={cn("px-3 py-2 font-medium", index === 0 ? "text-left" : "text-right")}>
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {tickers.map((t) => (
              <tr key={t.symbol} className="border-t border-border transition-colors hover:bg-foreground/[0.03]">
                <th scope="row" className="px-3 py-2 text-left font-semibold">
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-normal">
                    <Link href={optionsHref(t.symbol)} className="font-semibold hover:underline">
                      {t.symbol}
                    </Link>
                    <SourceTags sources={t.sources} />
                  </span>
                </th>
                <td className="figure px-3 py-2 text-right">
                  ${fixed(t.spot)} <span className={tone(t.change_pct)}>{pct(t.change_pct, true)}</span>
                </td>
                <td className={cn("figure px-3 py-2 text-right", tone(t.net_premium))}>{formatPremium(t.net_premium, true)}</td>
                <td className="figure px-3 py-2 text-right">
                  {fixed(t.pc_premium_ratio)} <span className="text-muted-foreground">({fixed(t.pc_baseline)})</span>
                </td>
                <td className="figure px-3 py-2 text-right">
                  {t.implied_range ? (
                    <>
                      ${fixed(t.implied_range.low)}–${fixed(t.implied_range.high)}
                      <span className="block text-xs text-muted-foreground">
                        ±{fixed(t.implied_range.pct)}% · {t.implied_range.expiration.slice(5)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="figure px-3 py-2 text-right">{t.max_pain ? `$${t.max_pain.strike}` : "—"}</td>
                <td className="figure px-3 py-2 text-right">{t.gamma_level ? `$${t.gamma_level.strike}` : "—"}</td>
                <td className="figure px-3 py-2 text-right">{t.earnings_date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
