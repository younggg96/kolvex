"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useCopy } from "@/components/decision/shared";
import {
  fetchLatestScannerRun,
  runOpportunityScanner,
  ScannerCandidate,
  ScannerRunResponse,
} from "@/lib/tradeOsApi";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Play,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScannerLogicPicker, useLogicSummary, useScannerLogics } from "./ScannerLogicManager";
import CompanyLogo from "@/components/ui/company-logo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RegimeBadge, StatusBadge, reasonShort, reasonText } from "@/components/trade-os/shared";

type Filter = "signals" | "watch" | "all";
type Source = "all" | "youtube" | "reddit" | "etf" | "stocks";
type SortKey = "rs" | "symbol" | "status" | "pullback";
type Sort = { key: SortKey; dir: "asc" | "desc" };

/** Default: strongest vs SPY first, the order the scan ranks by. */
const DEFAULT_SORT: Sort = { key: "rs", dir: "desc" };
/** Most actionable first when sorting by status. */
const STATUS_RANK: Record<string, number> = {
  SIGNAL_CONFIRMED: 0,
  ENTRY_PENDING: 1,
  TRIGGERED: 2,
  PULLBACK_ACTIVE: 3,
  TREND_VALID: 4,
  BLOCKED: 5,
};
const number = (value?: string | null) => {
  const parsed = value == null ? NaN : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// stock | status | vs SPY | pullback | entry·stop·target or reason | action
const GRID = "md:grid-cols-[minmax(6rem,1fr)_8.5rem_5.5rem_6.5rem_minmax(0,2.4fr)_7.5rem]";

const SIGNALS = new Set(["SIGNAL_CONFIRMED", "ENTRY_PENDING"]);
const WATCH = new Set([
  "SIGNAL_CONFIRMED",
  "ENTRY_PENDING",
  "BLOCKED",
  "PULLBACK_ACTIVE",
  "TREND_VALID",
  "TRIGGERED",
]);

export function ScannerView({ embedded = false }: { embedded?: boolean } = {}) {
  const c = useCopy();
  const [data, setData] = useState<ScannerRunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(embedded ? "signals" : "watch");
  const [source, setSource] = useState<Source>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);

  const sourceName: Record<string, string> = {
    youtube: c("YouTube hot", "YouTube 热议"),
    reddit: c("Reddit trending", "Reddit 热榜"),
    etf: "ETF",
    core: c("Core", "核心"),
    sector: c("Sector", "行业"),
    manual: c("Manual", "手动"),
  };

  const logicState = useScannerLogics();
  const logicKey = logicState.selectedKey;
  const logicSummary = useLogicSummary(logicState.selected);

  // Each logic keeps its own latest result; a late answer for a previous choice is dropped.
  useEffect(() => {
    let current = true;
    setLoading(true);
    setData(null);
    setError(null);
    (async () => {
      try {
        const latest = await fetchLatestScannerRun(logicKey);
        if (current) setData(latest);
      } catch (err: any) {
        if (current)
          setError(err?.message || c("Failed to load the last scan", "上次扫描结果加载失败"));
      } finally {
        if (current) setLoading(false);
      }
    })();
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logicKey]);

  const handleRunScan = async () => {
    try {
      setRunning(true);
      setError(null);
      setData(await runOpportunityScanner(logicKey));
    } catch (err: any) {
      setError(err?.message || c("Scan failed", "扫描失败"));
    } finally {
      setRunning(false);
    }
  };

  /** Candidates from the chosen source; the status filter and its counts both read this. */
  const sourced = useMemo(() => {
    const all = data?.candidates ?? [];
    if (source === "youtube" || source === "reddit" || source === "etf")
      return all.filter((r) => r.sources?.includes(source));
    if (source === "stocks") return all.filter((r) => !r.sources?.includes("etf"));
    return all;
  }, [data, source]);
  const counts = useMemo(
    () => ({
      signals: sourced.filter((r) => SIGNALS.has(r.status)).length,
      watch: sourced.filter((r) => WATCH.has(r.status)).length,
      all: sourced.length,
    }),
    [sourced],
  );
  const rows = useMemo(() => {
    const term = query.trim().toUpperCase();
    const filtered = sourced.filter(
      (r) =>
        (filter === "signals"
          ? SIGNALS.has(r.status)
          : filter === "watch"
            ? WATCH.has(r.status)
            : true) &&
        (!term || r.symbol.toUpperCase().includes(term)),
    );
    const sign = sort.dir === "asc" ? 1 : -1;
    const value = (r: ScannerCandidate): number | string | null =>
      sort.key === "symbol"
        ? r.symbol
        : sort.key === "status"
          ? (STATUS_RANK[r.status] ?? 9)
          : sort.key === "rs"
            ? number(r.rs20_pct)
            : number(r.pullback_depth_pct);
    return [...filtered].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      // Missing values always sink, whichever way the column is sorted.
      if (left === null || right === null) return left === null ? (right === null ? 0 : 1) : -1;
      if (typeof left === "string" || typeof right === "string")
        return String(left).localeCompare(String(right)) * sign;
      return (left - right) * sign;
    });
  }, [sourced, filter, query, sort]);
  /** Header click: a new column starts in its natural direction, a second click flips it. */
  const sortBy = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "symbol" || key === "status" ? "asc" : "desc" },
    );
  const sortLabels: Record<SortKey, string> = {
    rs: c("vs SPY", "相对 SPY"),
    symbol: c("Stock", "股票"),
    status: c("Status", "状态"),
    pullback: c("Pullback", "回调"),
  };

  const money = (v?: string | null) => (v ? `$${parseFloat(v).toFixed(2)}` : "—");
  const pct = (v?: string | null) => {
    if (v == null) return "—";
    const n = parseFloat(v);
    return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}%`;
  };

  const planHref = (r: ScannerCandidate) =>
    `/dashboard/trade-os/trades?symbol=${r.symbol}&entry=${r.suggested_entry}&stop=${r.suggested_stop}&target=${r.suggested_target}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold text-foreground">
            {embedded
              ? c("Today's signals", "今日信号")
              : c("Swing V3.1 pullback scan", "Swing V3.1 回调扫描")}
          </h2>
          <InfoTip label={c("Scan rules", "扫描规则")}>
            <p>
              {logicSummary ??
                c(
                  "1) Price ≥ $10 and ≥ $20M daily dollar volume. 2) EMA20 > SMA50 > SMA200, close > SMA50. 3) Stronger than SPY over 20 days (sorted by this). 4) No earnings in 5 trading days. Then a new 20-day high, a 3–10 day / 3–10% pullback that touches the EMA20, and a strong close above the prior day's high. Entry = signal high + $0.01, stop = pullback low − 0.75×ATR, target = 3R. Valid for 2 trading days. Exit on day 60 or the session before earnings if neither is hit.",
                  "1）股价 ≥ $10，日均成交额 ≥ 2000 万美元。2）EMA20 > SMA50 > SMA200，收盘 > SMA50。3）近 20 日强于 SPY（按此排序）。4）未来 5 个交易日无财报。然后：创 20 日新高后回调 3–10 天、幅度 3–10%、触及 EMA20 附近，并出现收盘高于前一日最高价的阳线。入场 = 信号日最高价 + $0.01，止损 = 回调低点 − 0.75×ATR，目标 = 3R，信号有效 2 个交易日。止损和目标都没碰到时，持有满 60 天或财报前最后一个交易日离场。",
                )}
            </p>
          </InfoTip>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <ScannerLogicPicker state={logicState} disabled={running} />
          <Button
            onClick={handleRunScan}
            disabled={running}
            size="sm"
            className="rounded-full px-4 text-xs font-semibold"
          >
            {running ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {running ? c("Scanning...", "扫描中...") : c("Run scan", "运行扫描")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-negative/30 bg-negative/10 p-4 text-sm text-negative">
          {error}
        </div>
      )}

      {data && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {!embedded && <RegimeBadge regime={data.market_regime} />}
          {logicState.selected && (
            <span>
              {c("Logic", "逻辑")}{" "}
              <b className="text-foreground">
                {logicState.selected.builtin
                  ? `${c("Default", "默认")} · ${logicState.selected.name}`
                  : logicState.selected.name}
              </b>
              {!logicState.selected.builtin &&
                ` · ${c(`v${data.strategy_version ?? logicState.selected.version}`, `第 ${data.strategy_version ?? logicState.selected.version} 版`)}`}
            </span>
          )}
          {data.universe && (
            <span>
              {c("Scanned", "已扫描")}{" "}
              <b className="figure text-foreground">
                {data.universe.counts.total ?? data.total_scanned}
              </b>
              {" · "}
              {(["core", "sector", "etf", "youtube", "reddit"] as const)
                .filter((k) => data.universe!.counts[k] != null)
                .map((k) => `${sourceName[k]} ${data.universe!.counts[k]}`)
                .join(" · ")}
            </span>
          )}
          <span>
            {c("Signals", "有效信号")}{" "}
            <b className="figure text-foreground">{data.candidates_count}</b> / {data.total_scanned}
          </span>
          <span>
            {data.trading_date
              ? `${c("Close of", "收盘日")} ${data.trading_date}`
              : `${c("Manual run", "手动扫描")} ${new Date(data.run_at).toLocaleString()}`}
          </span>
          {data.failed_symbols && data.failed_symbols.length > 0 && (
            <span className="text-negative">
              {c("Failed to load", "加载失败")}: {data.failed_symbols.join(", ")}
            </span>
          )}
        </div>
      )}

      {data?.universe &&
        Object.keys(data.universe.errors).map((name) => (
          <p key={name} className="text-xs text-warning">
            {sourceName[name] ?? name}
            {c(
              " couldn't be fetched, so this scan doesn't include it.",
              " 获取失败，本次扫描没有包含它。",
            )}
          </p>
        ))}

      {data && (
        // One filter bar: status (what to act on) leads, source narrows it. Each control keeps
        // its own track; the gap and wrapping keep them from running into each other.
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <SegmentedControl
            label={c("Status", "状态")}
            value={filter}
            onChange={setFilter}
            size="sm"
            options={(
              [
                ["signals", c("Signals", "可下计划")],
                ["watch", c("Watchlist", "观察中")],
                ["all", c("All", "全部")],
              ] as const
            ).map(([value, name]) => ({
              value,
              ariaLabel: `${name} ${counts[value]}`,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {name}
                  <span className="figure text-[0.6875rem] text-muted-foreground">
                    {counts[value]}
                  </span>
                </span>
              ),
            }))}
          />
          <SegmentedControl
            label={c("Source", "来源")}
            value={source}
            onChange={setSource}
            size="sm"
            className="max-w-full"
            options={[
              { value: "all", label: c("All sources", "全部来源") },
              { value: "youtube", label: "YouTube" },
              { value: "reddit", label: "Reddit" },
              { value: "etf", label: "ETF" },
              { value: "stocks", label: c("Stocks", "个股") },
            ]}
          />
        </div>
      )}

      {data && (
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={c("Search symbol", "搜索代码")}
              aria-label={c("Search symbol", "搜索代码")}
              autoCapitalize="characters"
              spellCheck={false}
              className="h-11 rounded-full pl-8 pr-9 text-sm uppercase placeholder:normal-case sm:h-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={c("Clear search", "清除搜索")}
                className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          {/* Phones have no column headers, so sorting is a menu here. */}
          <Select
            value={`${sort.key}:${sort.dir}`}
            onValueChange={(next) => {
              const [key, dir] = next.split(":") as [SortKey, Sort["dir"]];
              setSort({ key, dir });
            }}
          >
            {/* A 44px icon button beside the search; the chosen order is read out, not shown. */}
            <SelectTrigger
              // SelectTrigger's own w-full / h-10 / px-3.5 sit in the same class list; force the icon size.
              className="!h-[44px] !w-[44px] shrink-0 !justify-center rounded-full !px-0 md:hidden [&>svg:last-child]:hidden"
              aria-label={c(`Sort: ${sortLabels[sort.key]}`, `排序：${sortLabels[sort.key]}`)}
              title={c("Sort", "排序")}
            >
              <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="rs:desc">{c("vs SPY: strongest", "相对 SPY：最强")}</SelectItem>
              <SelectItem value="rs:asc">{c("vs SPY: weakest", "相对 SPY：最弱")}</SelectItem>
              <SelectItem value="status:asc">
                {c("Status: actionable first", "状态：可操作优先")}
              </SelectItem>
              <SelectItem value="pullback:asc">
                {c("Pullback: shallowest", "回调：最浅")}
              </SelectItem>
              <SelectItem value="pullback:desc">{c("Pullback: deepest", "回调：最深")}</SelectItem>
              <SelectItem value="symbol:asc">{c("Symbol: A–Z", "代码：A–Z")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <ListCard>
        {loading ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            {c("Loading...", "加载中...")}
          </div>
        ) : !data ? (
          <ListEmptyState
            title={c("No scan yet.", "还没有扫描结果。")}
            action={
              <Button size="sm" className="rounded-full" onClick={handleRunScan} disabled={running}>
                {c("Run scan", "运行扫描")}
              </Button>
            }
          />
        ) : rows.length === 0 && query.trim() ? (
          <ListEmptyState
            title={c(`No stock matches “${query.trim()}”.`, `没有匹配「${query.trim()}」的股票。`)}
            action={
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setQuery("")}
              >
                {c("Clear search", "清除搜索")}
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <ListEmptyState
            title={
              filter === "signals"
                ? c("No confirmed signals today.", "今天没有确认信号。")
                : c("Nothing to show.", "没有可显示的股票。")
            }
          />
        ) : (
          <>
            {/* Column headings (desktop) sort the list. Rows share the same grid so columns line up. */}
            <div
              className={cn(
                "hidden gap-x-3 border-b border-border px-4 pb-2 pt-3 text-xs text-muted-foreground md:grid",
                GRID,
              )}
            >
              {(
                [
                  ["symbol", sortLabels.symbol],
                  ["status", sortLabels.status],
                  ["rs", sortLabels.rs],
                  ["pullback", sortLabels.pullback],
                ] as const
              ).map(([key, label]) => {
                const active = sort.key === key;
                const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <span key={key}>
                    <button
                      type="button"
                      onClick={() => sortBy(key)}
                      aria-pressed={active}
                      aria-label={
                        active
                          ? c(
                              `Sorted by ${label}, ${sort.dir === "asc" ? "ascending" : "descending"}. Reverse`,
                              `已按${label}${sort.dir === "asc" ? "升序" : "降序"}排序，点按反转`,
                            )
                          : c(`Sort by ${label}`, `按${label}排序`)
                      }
                      title={c(`Sort by ${label}`, `按${label}排序`)}
                      className={cn(
                        "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active && "text-foreground",
                      )}
                    >
                      {label}
                      {active ? (
                        <Arrow className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />
                      )}
                    </button>
                  </span>
                );
              })}
              <span>{c("Entry · Stop · Target", "入场 · 止损 · 目标")}</span>
              <span />
            </div>
            <ul className="min-w-0">
              {rows.map((r) => {
                const actionable = SIGNALS.has(r.status);
                const full = reasonText(r.status_reason, c);
                const short = reasonShort(r.status_reason, c);
                const pullback = r.pullback_depth_pct
                  ? `${parseFloat(r.pullback_depth_pct).toFixed(1)}%${r.pullback_days ? ` · ${r.pullback_days}${c("d", "天")}` : ""}`
                  : "—";
                const rsNum = r.rs20_pct == null ? null : parseFloat(r.rs20_pct);
                return (
                  <li
                    key={r.symbol}
                    className="list-reveal border-t border-border/40 px-3 py-3 first:border-t-0 hover:bg-foreground/[0.04] sm:px-4"
                  >
                    <div
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5",
                        GRID,
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-0.5 shrink-0" aria-hidden="true">
                          <CompanyLogo symbol={r.symbol} size="sm" shape="circle" />
                        </span>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold tracking-tight text-foreground">
                            {r.symbol}
                          </span>
                          <span className="figure block text-xs text-muted-foreground">
                            {money(r.current_price)}
                          </span>
                          {r.sources && r.sources.length > 0 && (
                            <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">
                              {r.sources.map((k) => sourceName[k] ?? k).join(" · ")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="justify-self-end md:justify-self-start">
                        <StatusBadge status={r.status} />
                      </div>

                      {/* Mobile: one summary line. Desktop: separate aligned columns. */}
                      <p className="figure col-span-2 text-xs text-muted-foreground md:hidden">
                        {c("vs SPY", "相对 SPY")}{" "}
                        <span className="font-medium text-foreground">{pct(r.rs20_pct)}</span>
                        {" · "}
                        {c("Pullback", "回调")}{" "}
                        <span className="font-medium text-foreground">{pullback}</span>
                      </p>
                      <span
                        className={cn(
                          "figure hidden text-sm font-medium md:block",
                          rsNum == null
                            ? "text-muted-foreground"
                            : rsNum > 0
                              ? "text-positive"
                              : "text-negative",
                        )}
                      >
                        {pct(r.rs20_pct)}
                      </span>
                      <span className="figure hidden text-sm text-foreground md:block">
                        {pullback}
                      </span>

                      <div className="col-span-2 min-w-0 text-xs md:col-span-1">
                        {r.suggested_entry ? (
                          <p className="figure flex flex-wrap gap-x-3 gap-y-0.5">
                            <span className="text-foreground">{money(r.suggested_entry)}</span>
                            <span className="text-negative">
                              {money(r.suggested_stop)}
                              {r.stop_distance_pct
                                ? ` (−${parseFloat(r.stop_distance_pct).toFixed(1)}%)`
                                : ""}
                            </span>
                            <span className="text-positive">{money(r.suggested_target)}</span>
                          </p>
                        ) : (
                          <p className="truncate text-muted-foreground" title={full ?? undefined}>
                            {short ?? "—"}
                          </p>
                        )}
                        {r.earnings_status &&
                          r.earnings_status !== "not_applicable" &&
                          r.suggested_entry && (
                            <p
                              className={cn(
                                "mt-0.5",
                                r.earnings_status === "clear"
                                  ? "text-muted-foreground"
                                  : "text-warning",
                              )}
                            >
                              {c("Next earnings", "下次财报")}:{" "}
                              {r.earnings_date ?? c("unknown", "未知")}
                            </p>
                          )}
                      </div>

                      <div className="col-span-2 md:col-span-1 md:justify-self-end">
                        {actionable && (
                          <Button size="sm" asChild className="h-8 rounded-full px-3 text-xs">
                            <Link href={planHref(r)}>
                              {c("Create plan", "生成计划")}
                              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </ListCard>
    </div>
  );
}
