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
import { Play, RefreshCw, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegimeBadge, StatusBadge, reasonShort, reasonText } from "@/components/trade-os/shared";

type Filter = "signals" | "watch" | "all";
type Source = "all" | "youtube" | "reddit" | "etf" | "stocks";

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

  const sourceName: Record<string, string> = {
    youtube: c("YouTube hot", "YouTube 热议"),
    reddit: c("Reddit trending", "Reddit 热榜"),
    etf: "ETF",
    core: c("Core", "核心"),
    sector: c("Sector", "行业"),
    manual: c("Manual", "手动"),
  };

  useEffect(() => {
    (async () => {
      try {
        setData(await fetchLatestScannerRun());
      } catch (err: any) {
        setError(err?.message || c("Failed to load the last scan", "上次扫描结果加载失败"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunScan = async () => {
    try {
      setRunning(true);
      setError(null);
      setData(await runOpportunityScanner());
    } catch (err: any) {
      setError(err?.message || c("Scan failed", "扫描失败"));
    } finally {
      setRunning(false);
    }
  };

  const rows = useMemo(() => {
    let all = data?.candidates ?? [];
    if (source === "youtube" || source === "reddit" || source === "etf") {
      all = all.filter((r) => r.sources?.includes(source));
    } else if (source === "stocks") {
      all = all.filter((r) => !r.sources?.includes("etf"));
    }
    if (filter === "signals") return all.filter((r) => SIGNALS.has(r.status));
    if (filter === "watch") return all.filter((r) => WATCH.has(r.status));
    return all;
  }, [data, filter, source]);

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
              {c(
                "1) Price ≥ $10 and ≥ $20M daily dollar volume. 2) EMA20 > SMA50 > SMA200, close > SMA50. 3) Stronger than SPY over 20 days (sorted by this). 4) No earnings in 5 trading days. Then a new 20-day high, a 3–10 day / 3–10% pullback that touches the EMA20, and a strong close above the prior day's high. Entry = signal high + $0.01, stop = pullback low − 0.75×ATR, target = 3R. Valid for 2 trading days. Exit on day 60 or the session before earnings if neither is hit.",
                "1）股价 ≥ $10，日均成交额 ≥ 2000 万美元。2）EMA20 > SMA50 > SMA200，收盘 > SMA50。3）近 20 日强于 SPY（按此排序）。4）未来 5 个交易日无财报。然后：创 20 日新高后回调 3–10 天、幅度 3–10%、触及 EMA20 附近，并出现收盘高于前一日最高价的阳线。入场 = 信号日最高价 + $0.01，止损 = 回调低点 − 0.75×ATR，目标 = 3R，信号有效 2 个交易日。止损和目标都没碰到时，持有满 60 天或财报前最后一个交易日离场。",
              )}
            </p>
          </InfoTip>
        </div>
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

      {error && (
        <div className="rounded-2xl border border-negative/30 bg-negative/10 p-4 text-sm text-negative">
          {error}
        </div>
      )}

      {data && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {!embedded && <RegimeBadge regime={data.market_regime} />}
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
        <SegmentedControl
          label={c("Source", "来源")}
          value={source}
          onChange={setSource}
          size="sm"
          options={[
            { value: "all", label: c("All sources", "全部来源") },
            { value: "youtube", label: "YouTube" },
            { value: "reddit", label: "Reddit" },
            { value: "etf", label: "ETF" },
            { value: "stocks", label: c("Stocks", "个股") },
          ]}
        />
      )}

      {data && (
        <SegmentedControl
          label={c("Filter", "筛选")}
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: "signals", label: c("Signals", "可下计划") },
            { value: "watch", label: c("Watchlist", "观察中") },
            { value: "all", label: c("All", "全部") },
          ]}
        />
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
            {/* Column headings (desktop). Rows share the same grid so columns line up. */}
            <div
              aria-hidden="true"
              className={cn(
                "hidden gap-x-3 border-b border-border px-4 pb-2 pt-3 text-xs text-muted-foreground md:grid",
                GRID,
              )}
            >
              <span>{c("Stock", "股票")}</span>
              <span>{c("Status", "状态")}</span>
              <span>{c("vs SPY", "相对 SPY")}</span>
              <span>{c("Pullback", "回调")}</span>
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
