"use client";

import { InfoTip } from "@/components/ui/info-tip";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCopy } from "@/components/decision/shared";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTranslation } from "@/lib/i18n";
import { barShare, formatPremium, type ActivityContract, type ActivityRun, type ActivitySession, type Contributor } from "@/lib/optionsActivity";
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
      <SectionHeader title={c("Market overview", "市场概览")} note={c(`${m.tickers_scanned} symbols, contracts within ±15% of price and 45 days`, `${m.tickers_scanned} 个标的，现价 ±15%、45 天内到期的合约`)} />
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
    <li className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-3 py-1.5">
      <Link href={optionsHref(item.symbol)} className="font-semibold hover:underline">
        {item.symbol}
      </Link>
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

type Filter = "all" | "etf" | "stock";

function ContractRow({ item, max }: { item: ActivityContract; max: number }) {
  const c = useCopy();
  const [open, setOpen] = useState(false);
  const call = item.type === "call";
  const expiry = item.expiration.slice(5).replace("-", "/");
  return (
    <li className="overflow-hidden rounded-2xl border border-foreground/10 glass-card bg-card-glass transition-[border-color] duration-150 hover:border-foreground/20">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 border-l-4 px-4 py-3 text-left hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        style={{ borderLeftColor: call ? "rgb(var(--positive-fill))" : "rgb(var(--negative-fill))" }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{item.underlying}</span>
            <span className={cn("figure rounded px-1.5 py-0.5 text-xs font-medium", call ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative")}>
              ${item.strike} {call ? "C" : "P"}
            </span>
            <span className="figure text-sm text-muted-foreground">{expiry}</span>
            <span className="figure rounded bg-muted px-1.5 py-0.5 text-xs">{item.dte}d</span>
            {item.flags.new_positions && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{c("New positions", "新开仓")}</span>}
            {item.flags.crosses_earnings && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{c("Spans earnings", "跨财报")}</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {c("Avg price", "成交均价")} <span className="figure">${fixed(item.price)}</span>
          </p>
        </div>
        <div className="w-28 shrink-0 text-right">
          <p className="figure font-semibold">{formatPremium(item.premium)}</p>
          <div className="mt-1.5 h-1 rounded-full bg-muted" aria-hidden>
            <div className={cn("h-full rounded-full", call ? "bg-positive-fill" : "bg-negative-fill")} style={{ width: `${barShare(item.premium, max) * 100}%` }} />
          </div>
          <p className="figure mt-1 text-xs text-muted-foreground">Vol/OI {item.vol_oi === null ? "—" : `${fixed(item.vol_oi, 1)}×`}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border bg-foreground/[0.02] px-4 py-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            {([
              [c("Volume", "成交量"), item.volume.toLocaleString()],
              [c("Open interest", "持仓量"), item.open_interest.toLocaleString()],
              ["IV", item.iv === null ? "—" : pct(item.iv * 100)],
              ["Delta", fixed(item.delta, 3)],
              [c("Out of the money", "价外幅度"), pct(item.otm_pct)],
              [c("Last trade", "最近成交"), item.last === null ? "—" : `$${fixed(item.last)}`],
              [c("Expiration", "到期日"), item.expiration],
              [c("Contract", "合约"), item.symbol],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="figure mt-0.5 break-all">{value}</dd>
              </div>
            ))}
          </dl>
          <Link href={optionsHref(item.underlying)} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            {c(`Open ${item.underlying} options chain`, `查看 ${item.underlying} 期权链`)} →
          </Link>
        </div>
      )}
    </li>
  );
}

export function UnusualContracts({ run }: { run: ActivityRun }) {
  const c = useCopy();
  const [filter, setFilter] = useState<Filter>("all");
  const all = run.payload.contracts;
  const etf = all.filter((x) => x.is_etf).length;
  const shown = all.filter((x) => filter === "all" || (filter === "etf") === x.is_etf);
  const max = Math.max(0, ...all.map((x) => x.premium));
  return (
    <section aria-labelledby="activity-contracts">
      <SectionHeader title={c("Largest contracts", "异动合约")} />
      <SegmentedControl
        size="sm"
        className="mb-4"
        label={c("Contract type", "合约类型")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: `${c("All", "全部")} ${all.length}` },
          { value: "etf", label: `${c("ETFs", "ETF指数")} ${etf}` },
          { value: "stock", label: `${c("Stocks", "个股")} ${all.length - etf}` },
        ]}
      />
      <ul className="space-y-2">
        {shown.map((item) => (
          <ContractRow key={item.symbol} item={item} max={max} />
        ))}
      </ul>
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
                  <Link href={optionsHref(t.symbol)} className="hover:underline">
                    {t.symbol}
                  </Link>
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
