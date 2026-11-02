"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { validTicker } from "@/lib/decision";
import {
  MAX_PEERS,
  mixesCurrencies,
  parsePeers,
  rebasedReturns,
} from "@/lib/freeResearch";
import { getStockHistory, type StockOverview } from "@/lib/stockApi";
import { finite, getStockOverview } from "@/lib/stockFundamentals";
import { marketStockHref } from "@/lib/stockLinks";
import { cn } from "@/lib/utils";
import { SourceNote } from "./SecData";
import { useFinancialFormat } from "./StockFinancialData";
import { useCopy } from "./shared";

const BENCHMARK = "^GSPC";
const RANGES = {
  "6M": { period: "6mo", interval: "1d" },
  "1Y": { period: "1y", interval: "1d" },
  "5Y": { period: "5y", interval: "1wk" },
} as const;
type Range = keyof typeof RANGES;
// Validated with the dataviz palette checker on Kolvex's light and dark card surfaces.
const SERIES_VARS =
  "[--peer-0:#2a78d6] [--peer-1:#eb6834] [--peer-2:#1baf7a] [--peer-3:#eda100] [--peer-4:#e87ba4] dark:[--peer-0:#3987e5] dark:[--peer-1:#d95926] dark:[--peer-2:#199e70] dark:[--peer-3:#c98500] dark:[--peer-4:#d55181]";

type Loaded = { status: "loading" | "ready" | "error"; overview?: StockOverview };

export default function StockPeers({ symbol }: { symbol: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [peers, setPeers] = useState(() =>
    parsePeers(searchParams.get("peers"), symbol),
  );
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("1Y");
  const [attempt, setAttempt] = useState(0);
  const [overviews, setOverviews] = useState<Record<string, Loaded>>({});
  const [history, setHistory] = useState<
    Record<string, { date: string; value: number }[]>
  >({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const symbols = useMemo(() => [symbol, ...peers], [symbol, peers]);
  const symbolsKey = symbols.join(",");

  // Color follows the company: removing one never repaints the others.
  const slots = useRef(new Map<string, number>([[symbol, 0]]));
  for (const peer of symbols) {
    if (!slots.current.has(peer)) {
      const used = new Set(
        symbols.map((item) => slots.current.get(item)).filter((slot) => slot !== undefined),
      );
      let slot = 0;
      while (used.has(slot)) slot += 1;
      slots.current.set(peer, slot);
    }
  }
  const color = (item: string) => `var(--peer-${slots.current.get(item) ?? 0})`;

  const update = (next: string[]) => {
    setPeers(next);
    const params = new URLSearchParams(window.location.search);
    if (next.length) params.set("peers", next.join(","));
    else params.delete("peers");
    window.history.replaceState(null, "", `${pathname}?${params}`);
  };
  const add = (event: FormEvent) => {
    event.preventDefault();
    const peer = draft.trim().toUpperCase();
    if (!peer) return;
    if (!validTicker(peer))
      return setInputError(c("Enter a valid ticker", "请输入有效的股票代码"));
    if (peer === symbol || peers.includes(peer))
      return setInputError(c("Already in the comparison", "已在比较列表中"));
    setInputError(null);
    setDraft("");
    update([...peers, peer]);
  };

  useEffect(() => {
    const controller = new AbortController();
    const list = symbolsKey.split(",");
    setOverviews((previous) => {
      const next: Record<string, Loaded> = {};
      for (const item of list)
        next[item] = previous[item]?.status === "ready" ? previous[item] : { status: "loading" };
      return next;
    });
    for (const item of list) {
      getStockOverview(item, controller.signal)
        .then((overview) => {
          if (controller.signal.aborted) return;
          const priced = finite(overview.quote.current_price) && overview.quote.current_price > 0;
          setOverviews((previous) => ({
            ...previous,
            [item]: priced ? { status: "ready", overview } : { status: "error" },
          }));
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setOverviews((previous) => ({ ...previous, [item]: { status: "error" } }));
        });
    }
    return () => controller.abort();
  }, [symbolsKey, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    const list = [...symbolsKey.split(","), BENCHMARK];
    setHistoryLoading(true);
    Promise.allSettled(
      list.map((item) => getStockHistory(item, RANGES[range], controller.signal)),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const next: Record<string, { date: string; value: number }[]> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled")
          next[list[index]] = result.value.map((bar) => ({ date: bar.date, value: bar.close }));
      });
      setHistory(next);
      setHistoryLoading(false);
    });
    return () => controller.abort();
  }, [symbolsKey, range, attempt]);

  const chart = useMemo(() => rebasedReturns(history), [history]);
  const signed = (value: unknown) =>
    finite(value) ? `${value > 0 ? "+" : ""}${f.percent(value)}` : "—";
  const name = (item: string) =>
    item === BENCHMARK ? c("S&P 500", "标普 500") : item;
  const lines = [...symbols.filter((item) => chart.totals[item] !== undefined), ...(chart.totals[BENCHMARK] !== undefined ? [BENCHMARK] : [])];
  const missingHistory = symbols.filter(
    (item) => !historyLoading && chart.totals[item] === undefined,
  );

  type Row = { label: string; read: (o: StockOverview) => string };
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: c("Size & valuation", "规模与估值"),
      rows: [
        { label: c("Market cap", "市值"), read: (o) => f.number(o.quote.market_cap) },
        { label: c("Trailing P/E", "滚动市盈率"), read: (o) => f.number(o.financials.pe_ratio, false) },
        { label: c("Forward P/E", "预期市盈率"), read: (o) => f.number(o.financials.forward_pe, false) },
        { label: c("Price / sales", "市销率"), read: (o) => (mixesCurrencies(o.quote.currency, o.financials.financial_currency) ? "—" : f.number(o.financials.price_to_sales, false)) },
        { label: "EV / EBITDA", read: (o) => (mixesCurrencies(o.quote.currency, o.financials.financial_currency) ? "—" : f.number(o.financials.ev_to_ebitda, false)) },
      ],
    },
    {
      title: c("Growth", "增长"),
      rows: [
        { label: c("Revenue", "营业收入"), read: (o) => `${f.number(o.financials.total_revenue)}${o.financials.financial_currency ? ` ${o.financials.financial_currency}` : ""}` },
        { label: c("Revenue growth", "营收增长"), read: (o) => signed(o.financials.revenue_growth) },
        { label: c("Earnings growth", "盈利增长"), read: (o) => signed(o.financials.earnings_growth) },
        { label: c("Trailing EPS", "滚动每股收益"), read: (o) => f.number(o.financials.eps_trailing, false) },
      ],
    },
    {
      title: c("Profitability", "盈利能力"),
      rows: [
        { label: c("Gross margin", "毛利率"), read: (o) => f.percent(o.financials.gross_margins) },
        { label: c("Operating margin", "营业利润率"), read: (o) => f.percent(o.financials.operating_margins) },
        { label: c("Net margin", "净利率"), read: (o) => f.percent(o.financials.profit_margins) },
        { label: c("Return on equity", "净资产收益率"), read: (o) => f.percent(o.financials.return_on_equity) },
      ],
    },
  ];
  const unavailable = peers.filter((peer) => overviews[peer]?.status === "error");
  return (
    <div className={cn("space-y-6", SERIES_VARS)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{c("Peer comparison", "同行比较")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {c(
              `You choose the peers, up to ${MAX_PEERS}. The link keeps your selection.`,
              `同行由你选择，最多 ${MAX_PEERS} 家，链接会保留所选公司。`,
            )}
          </p>
        </div>
        <form onSubmit={add} className="flex w-full flex-wrap items-start gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-48 sm:flex-none">
            <Input
              className="px-4 text-sm uppercase placeholder:normal-case"
              value={draft}
              maxLength={12}
              disabled={peers.length >= MAX_PEERS}
              onChange={(event) => {
                setDraft(event.target.value);
                setInputError(null);
              }}
              placeholder={c("Add a ticker", "添加股票代码")}
              aria-label={c("Add a peer ticker", "添加同行股票代码")}
              aria-invalid={inputError ? true : undefined}
              aria-describedby={inputError ? "peer-input-error" : undefined}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            {inputError && (
              <p id="peer-input-error" role="alert" className="mt-1 text-xs text-negative">
                {inputError}
              </p>
            )}
          </div>
          <Button type="submit" variant="outline" disabled={peers.length >= MAX_PEERS}>
            {c("Add", "添加")}
          </Button>
        </form>
      </div>

      {!peers.length && (
        <p className="rounded-3xl border border-border px-6 py-8 text-center text-sm text-muted-foreground">
          {c(
            "Add a company to compare valuation, growth, margins and returns.",
            "添加一家公司，比较估值、增长、利润率和收益走势。",
          )}
        </p>
      )}
      {!!unavailable.length && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {c(
            `No data for ${unavailable.join(", ")}. Check the ticker or try again.`,
            `没有 ${unavailable.join("、")} 的数据，请检查代码或重试。`,
          )}
          <Button size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
            {c("Retry", "重试")}
          </Button>
        </div>
      )}

      <section aria-labelledby="peer-returns-title" className="rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="peer-returns-title" className="text-sm font-medium text-muted-foreground">
            {c("Price return", "价格收益")}
          </h3>
          <SegmentedControl
            label={c("Return range", "收益区间")}
            value={range}
            onChange={setRange}
            options={(Object.keys(RANGES) as Range[]).map((value) => ({
              value,
              label: value === "6M" ? c("6M", "6月") : value === "1Y" ? c("1Y", "1年") : c("5Y", "5年"),
            }))}
          />
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2" aria-label={c("Return over the range", "区间收益")}>
          {lines.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={cn("h-0.5 w-4 rounded-full", item === BENCHMARK && "opacity-70")}
                style={{ background: item === BENCHMARK ? "rgb(var(--muted-foreground))" : color(item) }}
              />
              <span className="text-muted-foreground">{name(item)}</span>
              <span className="figure font-semibold">{signed(chart.totals[item])}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 h-72">
          {historyLoading && !chart.rows.length ? (
            <Skeleton className="h-full w-full" />
          ) : chart.rows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
                <XAxis
                  dataKey="date"
                  minTickGap={48}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: string) => value.slice(0, 7)}
                  tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
                />
                <YAxis
                  width={52}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                  tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
                />
                <ReferenceLine y={0} stroke="rgb(var(--muted-foreground))" strokeOpacity={0.5} />
                <Tooltip
                  cursor={{ stroke: "rgb(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="min-w-40 rounded-3xl border border-border bg-card p-3 text-xs text-foreground">
                        <p className="mb-2 font-semibold">{f.date(String(label))}</p>
                        <dl className="space-y-1">
                          {payload.map((entry) => (
                            <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
                              <dt className="flex items-center gap-2 text-muted-foreground">
                                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                                {name(String(entry.dataKey))}
                              </dt>
                              <dd className="figure">{signed(entry.value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : null
                  }
                />
                {lines.map((item) => (
                  <Line
                    key={item}
                    type="linear"
                    dataKey={item}
                    stroke={item === BENCHMARK ? "rgb(var(--muted-foreground))" : color(item)}
                    strokeWidth={item === symbol ? 2.5 : 2}
                    strokeDasharray={item === BENCHMARK ? "4 4" : undefined}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {c("Price history is unavailable.", "暂无价格历史。")}
            </div>
          )}
        </div>
        {!!chart.start && (
          <p className="mt-3 text-xs text-muted-foreground">
            {c(
              `All lines start at 0% on ${f.date(chart.start)}, the first date every company has data.`,
              `所有曲线从 ${f.date(chart.start)} 的 0% 起算，这是所有公司都有数据的最早日期。`,
            )}
            {!!missingHistory.length &&
              c(
                ` No price history for ${missingHistory.join(", ")}.`,
                ` ${missingHistory.join("、")} 暂无价格历史。`,
              )}
          </p>
        )}
      </section>

      <div
        role="region"
        tabIndex={0}
        aria-label={c("Peer metrics, horizontally scrollable", "同行指标表，可横向滚动")}
        className="overflow-auto rounded-3xl border border-border focus-visible:outline-none"
      >
        <table className="w-full border-separate border-spacing-0 whitespace-nowrap text-sm">
          <caption className="sr-only">{c("Peer comparison", "同行比较")}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-36 border-b border-r border-border bg-muted px-4 py-4 text-left font-medium text-muted-foreground"
              >
                {c("Metric", "指标")}
              </th>
              {symbols.map((item) => (
                <th key={item} scope="col" className="min-w-32 border-b border-border bg-muted px-4 py-3 text-right font-medium">
                  <span className="inline-flex items-center justify-end gap-1">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color(item) }} />
                    <Link href={marketStockHref(item)} className="transition-colors hover:text-muted-foreground">
                      {item}
                    </Link>
                    {item !== symbol && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-mr-2 h-7 w-7 p-0"
                        aria-label={c(`Remove ${item}`, `移除 ${item}`)}
                        onClick={() => update(peers.filter((peer) => peer !== item))}
                      >
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </span>
                  <span className="block max-w-40 truncate text-xs font-normal text-muted-foreground" title={overviews[item]?.overview?.company.name}>
                    {overviews[item]?.overview?.company.name ?? ""}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.title}>
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={symbols.length + 1}
                  className="border-b border-border bg-muted/60 p-0 text-left"
                >
                  <span className="sticky left-0 inline-block px-4 py-2 text-xs font-semibold">{group.title}</span>
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label} className="transition-colors hover:bg-foreground/[0.06]">
                  <th scope="row" className="sticky left-0 z-10 border-b border-r border-border bg-card px-4 py-3 text-left font-normal">
                    {row.label}
                  </th>
                  {symbols.map((item) => {
                    const loaded = overviews[item];
                    return (
                      <td key={item} className="figure border-b border-border px-4 py-3 text-right">
                        {!loaded || loaded.status === "loading" ? (
                          <Skeleton className="ml-auto h-4 w-14" />
                        ) : loaded.overview ? (
                          row.read(loaded.overview)
                        ) : (
                          "—"
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <SourceNote>
        {c(
          "Source: Yahoo Finance, the same provider and definitions for every company. Values follow each company's reporting currency and fiscal calendar. P/S and EV/EBITDA are hidden when the listing and reporting currencies differ, because the source's ratio mixes them. Returns use closing prices and exclude dividends. Missing values are shown as —.",
          "来源：Yahoo Finance，所有公司使用同一数据源和同一口径。数值按各公司的申报货币和财年。上市货币与申报货币不同时不显示市销率和 EV/EBITDA，因为数据源的比率混用了两种货币。收益按收盘价计算，不含股息。缺失值以 — 显示。",
        )}
      </SourceNote>
    </div>
  );
}
