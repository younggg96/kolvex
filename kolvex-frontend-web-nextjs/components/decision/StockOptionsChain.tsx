"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCachedResource } from "@/hooks/useCachedResource";
import { useTranslation } from "@/lib/i18n";
import {
  bidAskSpread,
  inTheMoney,
  nearStrikes,
  optionsChainKey,
  strikeRows,
  type OptionContract,
  type OptionSide,
  type OptionsChain,
} from "@/lib/optionsChain";
import { cn } from "@/lib/utils";
import { FactList, SourceNote } from "./SecData";
import { useCopy } from "./shared";

type Columns = "quote" | "greeks" | "trading" | "all";
type Layout = "both" | OptionSide;
type Range = "near" | "all";
type ColumnKey =
  | "bid" | "ask" | "mid" | "last" | "change" | "change_pct" | "volume" | "open_interest" | "iv"
  | "delta" | "gamma" | "theta" | "vega" | "rho"
  | "open" | "high" | "low" | "vwap" | "trade_count" | "prev_close" | "bid_size" | "ask_size" | "spread";

const COLUMN_SETS: Record<Exclude<Columns, "all">, ColumnKey[]> = {
  quote: ["bid", "ask", "mid", "last", "change_pct", "volume", "open_interest", "iv"],
  greeks: ["iv", "delta", "gamma", "theta", "vega", "rho"],
  trading: ["open", "high", "low", "vwap", "trade_count", "prev_close", "bid_size", "ask_size", "spread"],
};
const ALL_COLUMNS: ColumnKey[] = [
  "bid", "ask", "mid", "spread", "bid_size", "ask_size", "last", "change", "change_pct", "volume", "open_interest",
  "iv", "delta", "gamma", "theta", "vega", "rho", "open", "high", "low", "vwap", "trade_count", "prev_close",
];
const NEAR = 12;

class OptionsError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function loadChain(key: string, signal: AbortSignal): Promise<OptionsChain> {
  const response = await fetch(key, { signal, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new OptionsError(typeof body?.error === "string" ? body.error : "unavailable", response.status);
  return body;
}

function useFormat() {
  const { locale } = useTranslation();
  const intl = locale === "zh" ? "zh-CN" : "en-US";
  const fixed = (digits: number) => (value: number | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(value)
      ? "—"
      : new Intl.NumberFormat(intl, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const money = fixed(2);
  return {
    money,
    greek: fixed(4),
    price: (value: number | null | undefined) => (money(value) === "—" ? "—" : `$${money(value)}`),
    int: (value: number | null | undefined) =>
      value === null || value === undefined || !Number.isFinite(value) ? "—" : new Intl.NumberFormat(intl).format(value),
    compact: (value: number | null | undefined) =>
      value === null || value === undefined || !Number.isFinite(value)
        ? "—"
        : new Intl.NumberFormat(intl, { notation: "compact", maximumFractionDigits: 2 }).format(value),
    percent: (value: number | null | undefined, signed = false) =>
      value === null || value === undefined || !Number.isFinite(value)
        ? "—"
        : new Intl.NumberFormat(intl, {
            style: "percent",
            maximumFractionDigits: 2,
            signDisplay: signed ? "exceptZero" : "auto",
          }).format(value),
    signed: (value: number | null | undefined) =>
      value === null || value === undefined || !Number.isFinite(value)
        ? "—"
        : `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(Math.abs(value))}`,
    date: (value: string) =>
      Number.isFinite(Date.parse(value))
        ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString(intl, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })
        : "—",
    time: (value: string | null | undefined) =>
      value && Number.isFinite(Date.parse(value))
        ? new Date(value).toLocaleString(intl, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "—",
  };
}

export default function StockOptionsChain({ symbol }: { symbol: string }) {
  const c = useCopy();
  const f = useFormat();
  const [expiration, setExpiration] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout>("both");
  const [columns, setColumns] = useState<Columns>("quote");
  const [range, setRange] = useState<Range>("near");
  const [selected, setSelected] = useState<OptionContract | null>(null);
  const key = optionsChainKey(symbol, expiration);
  const { data, loading, refreshing, error, refresh } = useCachedResource(key, (signal) => loadChain(key, signal), {
    ttl: 60_000,
    timeout: 50_000,
  });
  const chain = data?.symbol === symbol.toUpperCase() ? data : undefined;
  const spot = chain?.underlying_price ?? null;
  const allRows = chain ? strikeRows(chain.contracts) : [];
  const rows = range === "near" ? nearStrikes(allRows, spot, NEAR) : allRows;
  const keys = columns === "all" ? ALL_COLUMNS : COLUMN_SETS[columns];
  const sides: OptionSide[] = layout === "both" ? ["call", "put"] : [layout];

  const label: Record<ColumnKey, string> = {
    bid: c("Bid", "买价"),
    ask: c("Ask", "卖价"),
    mid: c("Mid", "中间价"),
    spread: c("Spread", "价差"),
    bid_size: c("Bid size", "买量"),
    ask_size: c("Ask size", "卖量"),
    last: c("Last", "最新价"),
    change: c("Chg", "涨跌"),
    change_pct: c("Chg %", "涨跌幅"),
    volume: c("Volume", "成交量"),
    open_interest: c("Open int.", "持仓量"),
    iv: "IV",
    delta: "Delta",
    gamma: "Gamma",
    theta: "Theta",
    vega: "Vega",
    rho: "Rho",
    open: c("Open", "开盘"),
    high: c("High", "最高"),
    low: c("Low", "最低"),
    vwap: "VWAP",
    trade_count: c("Trades", "成交笔数"),
    prev_close: c("Prev close", "昨收"),
  };
  const value = (contract: OptionContract | undefined, column: ColumnKey): ReactNode => {
    if (!contract) return "—";
    switch (column) {
      case "bid": case "ask": case "mid": case "last": case "open": case "high": case "low": case "vwap": case "prev_close":
        return f.money(contract[column]);
      case "spread":
        return f.money(bidAskSpread(contract));
      case "change":
        return <span className={tone(contract.change)}>{f.signed(contract.change)}</span>;
      case "change_pct":
        return <span className={tone(contract.change_pct)}>{f.percent(contract.change_pct, true)}</span>;
      case "volume": case "open_interest": case "trade_count": case "bid_size": case "ask_size":
        return f.int(contract[column]);
      case "iv":
        return f.percent(contract.iv);
      default:
        return f.greek(contract[column]);
    }
  };

  const failure = error instanceof OptionsError ? error.code : error ? "unavailable" : null;
  const errorText: Record<string, string> = {
    not_configured: c(
      "The options data source isn't set up yet. Add Alpaca API keys to the backend to enable it.",
      "期权数据源尚未配置。需要在后端设置 Alpaca API Key 后才能显示。",
    ),
    no_options: c(`${symbol} has no listed options.`, `${symbol} 没有上市期权。`),
    rate_limited: c("The options data source is busy. Try again in a minute.", "期权数据源请求过于频繁，请稍后再试。"),
    unauthorized: c("Sign in to view options data.", "登录后可查看期权数据。"),
    unavailable: c("Options data could not be loaded. Try again.", "期权数据加载失败，请重试。"),
  };

  const strikeCell = (strike: number) => (
    <th
      scope="row"
      className="figure sticky left-0 z-[1] bg-muted px-4 py-2.5 text-center font-semibold md:static md:bg-transparent"
    >
      {f.money(strike)}
    </th>
  );
  const sideCells = (side: OptionSide, contract: OptionContract | undefined, strike: number) => {
    const ordered = side === "call" && layout === "both" ? [...keys].reverse() : keys;
    const itm = inTheMoney(side, strike, spot);
    const edge = side === "call" && layout === "both" ? ordered.length - 1 : 0;
    const name = c(
      `${f.money(strike)} ${side} details`,
      `查看 ${f.money(strike)} ${side === "call" ? "看涨" : "看跌"}合约详情`,
    );
    return ordered.map((column, index) => (
      <td
        key={`${side}-${column}`}
        className={cn(
          "figure px-3 py-2.5 text-right",
          itm && "bg-foreground/[0.05]",
          contract && "cursor-pointer group-hover:bg-foreground/[0.08]",
        )}
        onClick={contract ? () => setSelected(contract) : undefined}
      >
        {contract && index === edge ? (
          <button
            type="button"
            aria-label={name}
            className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              event.stopPropagation();
              setSelected(contract);
            }}
          >
            {value(contract, column)}
          </button>
        ) : (
          value(contract, column)
        )}
      </td>
    ));
  };
  const spotIndex = spot === null ? -1 : rows.findIndex((row) => row.strike >= spot);
  const width = sides.length * keys.length + 1;

  return (
    <section aria-labelledby="options-title" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="options-title" className="text-xl font-semibold">
            {c("Options chain", "期权链")}
          </h2>
          {chain && (
            <p className="mt-1 text-sm text-muted-foreground">
              {c("Underlying", "标的价")} <span className="figure text-foreground">{f.price(spot)}</span>
              {" · "}
              {c("As of", "数据时间")} {f.time(chain.as_of)}
              {chain.source.delayed && ` · ${c("Delayed", "延迟")} (${chain.source.feed})`}
            </p>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Select
              value={chain?.expiration ?? ""}
              onValueChange={(next) => setExpiration(next)}
              disabled={!chain}
            >
              <SelectTrigger aria-label={c("Expiration", "到期日")}>
                <SelectValue placeholder={c("Expiration", "到期日")} />
              </SelectTrigger>
              <SelectContent>
                {(chain?.expirations ?? []).map((date) => (
                  <SelectItem key={date} value={date}>
                    {f.date(date)} · {c(`${daysUntil(date)}d`, `${daysUntil(date)} 天`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={refresh}
            disabled={loading || refreshing}
            aria-label={c("Refresh options", "刷新期权数据")}
            title={c("Refresh options", "刷新期权数据")}
          >
            {loading || refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {loading && !chain ? (
        <div role="status">
          <span className="sr-only">{c("Loading options…", "正在加载期权…")}</span>
          <div aria-hidden="true" className="space-y-6">
            {[0, 1].map((group) => <div key={group} className="grid grid-cols-2 gap-6 border-b border-border pb-6 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <div key={i}><Skeleton className="h-3 w-24 rounded-md" /><Skeleton className="mt-2 h-6 w-20 rounded-md" /></div>)}
            </div>)}
            <div className="flex flex-wrap items-center gap-2"><Skeleton className="h-9 w-48 rounded-full" /><Skeleton className="h-9 w-40 rounded-full" /></div>
            <div className="overflow-hidden rounded-3xl border border-foreground/10">
              <div className="flex justify-around bg-muted px-3 py-3"><Skeleton className="h-4 w-16 rounded-md" /><Skeleton className="h-4 w-12 rounded-md" /><Skeleton className="h-4 w-16 rounded-md" /></div>
              {Array.from({ length: 10 }, (_, i) => <div key={i} className="grid grid-cols-[1fr_1fr_1fr_5rem_1fr_1fr_1fr] items-center gap-3 border-t border-border px-3 py-3">
                {[0, 1, 2].map((j) => <Skeleton key={j} className="ml-auto h-4 w-12 rounded-md" />)}
                <Skeleton className="mx-auto h-4 w-14 rounded-md" />
                {[0, 1, 2].map((j) => <Skeleton key={j} className="ml-auto h-4 w-12 rounded-md" />)}
              </div>)}
            </div>
          </div>
        </div>
      ) : failure && !chain ? (
        <div
          role={failure === "no_options" ? "status" : "alert"}
          className="glass-card rounded-3xl border border-foreground/10 bg-card-glass px-6 py-12 text-center"
        >
          <p className="text-sm text-muted-foreground">{errorText[failure] ?? errorText.unavailable}</p>
          {failure !== "no_options" && failure !== "not_configured" && (
            <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
              {c("Retry", "重试")}
            </Button>
          )}
        </div>
      ) : chain ? (
        <>
          <ChainMetrics chain={chain} />

          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              size="sm"
              label={c("Contracts shown", "显示合约")}
              value={layout}
              onChange={setLayout}
              options={[
                { value: "both", label: c("Calls & puts", "看涨 + 看跌") },
                { value: "call", label: c("Calls", "看涨") },
                { value: "put", label: c("Puts", "看跌") },
              ]}
            />
            <SegmentedControl
              size="sm"
              label={c("Columns", "数据列")}
              value={columns}
              onChange={setColumns}
              options={[
                { value: "quote", label: c("Quotes", "报价") },
                { value: "greeks", label: c("Greeks", "希腊值") },
                { value: "trading", label: c("Session", "当日成交") },
                { value: "all", label: c("All", "全部") },
              ]}
            />
            <SegmentedControl
              size="sm"
              label={c("Strikes", "行权价范围")}
              value={range}
              onChange={setRange}
              options={[
                { value: "near", label: c(`Near price (${NEAR * 2})`, `近价 ${NEAR * 2} 档`) },
                { value: "all", label: c(`All (${allRows.length})`, `全部 ${allRows.length} 档`) },
              ]}
            />
          </div>

          <div
            role="region"
            tabIndex={0}
            aria-label={c("Options chain table, horizontally scrollable", "期权链表格，可横向滚动")}
            className="glass-card max-h-[72vh] overflow-auto rounded-3xl border border-foreground/10 bg-card-glass focus-visible:outline-none"
          >
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="sticky top-0 z-[2] bg-muted text-muted-foreground">
                {layout === "both" && (
                  <tr className="text-xs">
                    <th colSpan={keys.length} scope="colgroup" className="px-3 pt-3 text-center font-semibold text-foreground">
                      {c("Calls", "看涨 Call")}
                    </th>
                    <th className="sticky left-0 bg-muted md:static" />
                    <th colSpan={keys.length} scope="colgroup" className="px-3 pt-3 text-center font-semibold text-foreground">
                      {c("Puts", "看跌 Put")}
                    </th>
                  </tr>
                )}
                <tr>
                  {layout === "both" &&
                    [...keys].reverse().map((column) => (
                      <th key={`call-${column}`} scope="col" className="px-3 py-3 text-right font-medium">
                        {label[column]}
                      </th>
                    ))}
                  <th scope="col" className="sticky left-0 bg-muted px-4 py-3 text-center font-medium md:static">
                    {c("Strike", "行权价")}
                  </th>
                  {(layout === "both" ? ["put" as const] : sides).flatMap((side) =>
                    keys.map((column) => (
                      <th key={`${side}-${column}`} scope="col" className="px-3 py-3 text-right font-medium">
                        {label[column]}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <Fragment key={row.strike}>
                    {index === spotIndex && (
                      <tr aria-hidden="true">
                        <td colSpan={width} className="border-y border-primary/60 bg-primary/[0.08] px-4 py-1 text-center text-xs font-medium">
                          {c("Underlying", "标的价")} {f.price(spot)}
                        </td>
                      </tr>
                    )}
                    <tr className="group border-t border-border">
                      {layout === "both" ? (
                        <>
                          {sideCells("call", row.call, row.strike)}
                          {strikeCell(row.strike)}
                          {sideCells("put", row.put, row.strike)}
                        </>
                      ) : (
                        <>
                          {strikeCell(row.strike)}
                          {sideCells(layout, row[layout], row.strike)}
                        </>
                      )}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                {c("No contracts for this expiration.", "该到期日没有合约。")}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {c(
              "Shaded cells are in the money. Select any contract for every field the source provides.",
              "灰底为价内合约。点击任一合约可查看数据源提供的全部字段。",
            )}
          </p>
        </>
      ) : null}

      <SourceNote>
        {c(
          "Source: Alpaca options market data (indicative feed, delayed and not the consolidated OPRA tape). Open interest and the contract close update once a day. Greeks and IV come from the source. Max pain, expected move and put/call ratios are derived from this expiration only. For personal reference, not investment advice.",
          "来源：Alpaca 期权行情（indicative 数据源，有延迟，并非 OPRA 全市场汇总报价）。持仓量和合约收盘价每日更新一次。希腊值和隐含波动率由数据源提供。最大痛点、预期波动和看跌/看涨比率仅基于当前到期日计算。仅供个人参考，不构成投资建议。",
        )}
      </SourceNote>

      <ContractDialog contract={selected} spot={spot} onClose={() => setSelected(null)} />
    </section>
  );
}

const tone = (value: number | null) =>
  value === null || value === 0 ? "" : value > 0 ? "text-positive" : "text-negative";

function daysUntil(date: string) {
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((Date.parse(`${date}T00:00:00Z`) - start) / 86_400_000));
}

function ChainMetrics({ chain }: { chain: OptionsChain }) {
  const c = useCopy();
  const f = useFormat();
  const m = chain.metrics;
  const move = m.expected_move;
  return (
    <div className="space-y-6">
      <FactList
        items={[
          [c("Days to expiration", "距到期"), c(`${m.days_to_expiration} days`, `${m.days_to_expiration} 天`)],
          [c("ATM implied volatility", "平值隐含波动率"), f.percent(m.atm_iv)],
          [
            c("Expected move", "预期波动"),
            move ? (
              <span title={move.method === "atm_straddle" ? c(`ATM straddle at $${move.strike}`, `$${move.strike} 平值跨式价格`) : c("From ATM IV", "由平值 IV 推算")}>
                ±{f.price(move.value)}{" "}
                <span className="text-sm font-normal text-muted-foreground">±{f.money(move.pct)}%</span>
              </span>
            ) : (
              "—"
            ),
          ],
          [
            c("Max pain", "最大痛点"),
            m.max_pain ? (
              <span>
                {f.price(m.max_pain.strike)}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {m.max_pain_vs_spot_pct === null ? "" : `${m.max_pain_vs_spot_pct > 0 ? "+" : ""}${f.money(m.max_pain_vs_spot_pct)}%`}
                </span>
              </span>
            ) : (
              "—"
            ),
          ],
        ]}
      />
      <FactList
        items={[
          [c("Put/call ratio · volume", "看跌/看涨 · 成交量"), f.money(m.volume_put_call_ratio)],
          [c("Put/call ratio · open interest", "看跌/看涨 · 持仓量"), f.money(m.oi_put_call_ratio)],
          [
            c("Volume · calls / puts", "成交量 · 看涨 / 看跌"),
            <span key="v">
              {f.compact(m.call_volume)} / {f.compact(m.put_volume)}
              <span className="block text-xs font-normal text-muted-foreground">
                {c("Total", "合计")} {f.int(m.total_volume)}
              </span>
            </span>,
          ],
          [
            c("Open interest · calls / puts", "持仓量 · 看涨 / 看跌"),
            <span key="oi">
              {f.compact(m.call_oi)} / {f.compact(m.put_oi)}
              <span className="block text-xs font-normal text-muted-foreground">
                {c("Total", "合计")} {f.int(m.total_oi)}
              </span>
            </span>,
          ],
        ]}
      />
      {m.max_pain && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {c(
            `At max pain, option holders' total intrinsic value at expiry would be $${f.compact(m.max_pain.holder_value)}.`,
            `在最大痛点到期时，期权持有人的内在价值合计为 $${f.compact(m.max_pain.holder_value)}。`,
          )}
        </p>
      )}
    </div>
  );
}

function ContractDialog({
  contract,
  spot,
  onClose,
}: {
  contract: OptionContract | null;
  spot: number | null;
  onClose: () => void;
}) {
  const c = useCopy();
  const f = useFormat();
  const x = contract;
  const text = (value: string | null | undefined) => value || "—";
  const yesNo = (value: boolean | null) => (value === null ? "—" : value ? c("Yes", "是") : c("No", "否"));
  const at = (price: string, size: number | null, exchange: string | null) =>
    `${price}${size !== null ? ` × ${f.int(size)}` : ""}${exchange ? ` @ ${exchange}` : ""}`;
  const groups: [string, [string, ReactNode][]][] = x
    ? [
        [
          c("Quote", "报价"),
          [
            [c("Bid", "买价"), at(f.money(x.bid), x.bid_size, x.bid_exchange)],
            [c("Ask", "卖价"), at(f.money(x.ask), x.ask_size, x.ask_exchange)],
            [c("Mid", "中间价"), f.money(x.mid)],
            [c("Spread", "价差"), f.money(bidAskSpread(x))],
            [c("Quote condition", "报价条件"), text(x.quote_condition)],
            [c("Quote time", "报价时间"), f.time(x.quote_time)],
          ],
        ],
        [
          c("Last trade", "最新成交"),
          [
            [c("Price", "价格"), at(f.money(x.last), x.last_size, x.last_exchange)],
            [c("Change", "涨跌"), <span key="chg" className={tone(x.change)}>{f.signed(x.change)} ({f.percent(x.change_pct, true)})</span>],
            [c("Trade condition", "成交条件"), text(x.trade_condition)],
            [c("Trade time", "成交时间"), f.time(x.trade_time)],
          ],
        ],
        [
          c("Session", "当日"),
          [
            [c("Open", "开盘"), f.money(x.open)],
            [c("High", "最高"), f.money(x.high)],
            [c("Low", "最低"), f.money(x.low)],
            [c("Close", "收盘"), f.money(x.close)],
            ["VWAP", f.money(x.vwap)],
            [c("Volume", "成交量"), f.int(x.volume)],
            [c("Trades", "成交笔数"), f.int(x.trade_count)],
            [c("Bar time", "K 线时间"), f.time(x.bar_time)],
          ],
        ],
        [
          c("Latest minute", "最近一分钟"),
          [
            [c("Close", "收盘"), f.money(x.minute_close)],
            [c("Volume", "成交量"), f.int(x.minute_volume)],
            [c("Time", "时间"), f.time(x.minute_time)],
          ],
        ],
        [
          c("Previous session", "上一交易日"),
          [
            [c("Close", "收盘"), f.money(x.prev_close)],
            [c("Volume", "成交量"), f.int(x.prev_volume)],
            [c("Contract close", "合约收盘价"), f.money(x.close_price)],
            [c("Close date", "收盘价日期"), x.close_price_date ? f.date(x.close_price_date) : "—"],
          ],
        ],
        [
          c("Volatility & Greeks", "波动率与希腊值"),
          [
            [c("Implied volatility", "隐含波动率"), f.percent(x.iv)],
            ["Delta", f.greek(x.delta)],
            ["Gamma", f.greek(x.gamma)],
            ["Theta", f.greek(x.theta)],
            ["Vega", f.greek(x.vega)],
            ["Rho", f.greek(x.rho)],
          ],
        ],
        [
          c("Contract", "合约"),
          [
            [c("Open interest", "持仓量"), f.int(x.open_interest)],
            [c("Open interest date", "持仓量日期"), x.open_interest_date ? f.date(x.open_interest_date) : "—"],
            [c("Moneyness", "价内/价外"), spot === null ? "—" : inTheMoney(x.type, x.strike, spot) ? c("In the money", "价内") : c("Out of the money", "价外")],
            [c("Style", "行权方式"), x.style === "american" ? c("American", "美式") : x.style === "european" ? c("European", "欧式") : text(x.style)],
            [c("Multiplier", "合约乘数"), f.int(x.multiplier)],
            [c("Underlying", "标的"), text(x.root)],
            [c("Tradable", "可交易"), yesNo(x.tradable)],
            [c("Expiration", "到期日"), f.date(x.expiration)],
          ],
        ],
      ]
    : [];
  return (
    <Dialog open={Boolean(x)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {x && (
          <>
            <DialogHeader>
              <DialogTitle>
                {x.root ?? ""} {f.price(x.strike)} {x.type === "call" ? c("Call", "看涨") : c("Put", "看跌")} · {f.date(x.expiration)}
              </DialogTitle>
              <DialogDescription className="figure break-all">
                {x.symbol}
                {x.name && ` · ${x.name}`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 sm:grid-cols-2">
              {groups.map(([title, items]) => (
                <section key={title} className="min-w-0">
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h3>
                  <dl className="divide-y divide-border text-sm">
                    {items.map(([name, content]) => (
                      <div key={name} className="flex items-baseline justify-between gap-4 py-1.5">
                        <dt className="text-muted-foreground">{name}</dt>
                        <dd className="figure text-right">{content}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
