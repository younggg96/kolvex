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
import { ListCard, ListEmptyState, ListRow, ListRows } from "@/components/ui/list-card";
import { Play, RefreshCw, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegimeBadge, StatusBadge, reasonText } from "@/components/trade-os/shared";

type Filter = "signals" | "watch" | "all";

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
    const all = data?.candidates ?? [];
    if (filter === "signals") return all.filter((r) => SIGNALS.has(r.status));
    if (filter === "watch") return all.filter((r) => WATCH.has(r.status));
    return all;
  }, [data, filter]);

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
              : c("Swing V3.0 pullback scan", "Swing V3.0 回调扫描")}
          </h2>
          <InfoTip label={c("Scan rules", "扫描规则")}>
            <p>
              {c(
                "1) Price ≥ $10 and ≥ $20M daily dollar volume. 2) EMA20 > SMA50 > SMA200, close > SMA50. 3) Stronger than SPY over 20 days (sorted by this). 4) No earnings in 5 trading days. Then a new 20-day high, a 3–10 day / 3–10% pullback that touches the EMA20, and a strong close above the prior day's high. Entry = signal high + $0.01, stop = pullback low − 0.25×ATR, target = 2R. Valid for 2 trading days.",
                "1）股价 ≥ $10，日均成交额 ≥ 2000 万美元。2）EMA20 > SMA50 > SMA200，收盘 > SMA50。3）近 20 日强于 SPY（按此排序）。4）未来 5 个交易日无财报。然后：创 20 日新高后回调 3–10 天、幅度 3–10%、触及 EMA20 附近，并出现收盘高于前一日最高价的阳线。入场 = 信号日最高价 + $0.01，止损 = 回调低点 − 0.25×ATR，目标 = 2R，信号有效 2 个交易日。",
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
          <ListRows>
            {rows.map((r) => {
              const actionable = SIGNALS.has(r.status);
              const reason = reasonText(r.status_reason, c);
              return (
                <ListRow key={r.symbol} className="space-y-2 px-3 py-3 sm:px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tracking-tight text-foreground">
                        {r.symbol}
                      </span>
                      <StatusBadge status={r.status} />
                      <span className="figure text-xs text-muted-foreground">
                        {money(r.current_price)}
                      </span>
                    </div>
                    {actionable && (
                      <Button size="sm" asChild className="h-8 rounded-full px-3 text-xs">
                        <Link href={planHref(r)}>
                          {c("Create plan", "生成计划")}
                          <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>

                  {reason && <p className="text-xs text-muted-foreground">{reason}</p>}

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
                    <div>
                      <dt className="text-muted-foreground">{c("RS20 vs SPY", "相对 SPY 强度")}</dt>
                      <dd className="figure font-medium text-foreground">{pct(r.rs20_pct)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{c("Pullback", "回调")}</dt>
                      <dd className="figure font-medium text-foreground">
                        {r.pullback_depth_pct
                          ? `${parseFloat(r.pullback_depth_pct).toFixed(1)}%`
                          : "—"}
                        {r.pullback_days ? ` · ${r.pullback_days}${c("d", "天")}` : ""}
                      </dd>
                    </div>
                    {r.suggested_entry && (
                      <>
                        <div>
                          <dt className="text-muted-foreground">{c("Entry", "入场")}</dt>
                          <dd className="figure font-medium text-foreground">
                            {money(r.suggested_entry)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{c("Stop", "止损")}</dt>
                          <dd className="figure font-medium text-negative">
                            {money(r.suggested_stop)}
                            {r.stop_distance_pct
                              ? ` (−${parseFloat(r.stop_distance_pct).toFixed(1)}%)`
                              : ""}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{c("Target 2R", "目标 2R")}</dt>
                          <dd className="figure font-medium text-positive">
                            {money(r.suggested_target)}
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>

                  {r.earnings_status && r.earnings_status !== "not_applicable" && (
                    <p
                      className={cn(
                        "text-xs",
                        r.earnings_status === "clear" ? "text-muted-foreground" : "text-warning",
                      )}
                    >
                      {c("Next earnings", "下次财报")}: {r.earnings_date ?? c("unknown", "未知")}
                    </p>
                  )}
                </ListRow>
              );
            })}
          </ListRows>
        )}
      </ListCard>
    </div>
  );
}
