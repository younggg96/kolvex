"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCopy } from "@/components/decision/shared";
import {
  BacktestSummary,
  PortfolioBacktestJob,
  ResearchGates,
  fetchBacktestJob,
  fetchBacktestJobs,
  startPortfolioBacktest,
} from "@/lib/tradeOsApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { Check, X, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatR, reasonText } from "@/components/trade-os/shared";

const POLL_MS = 4000;

function isSummary(s: unknown): s is BacktestSummary {
  return !!s && typeof s === "object" && "total_trades" in (s as object);
}
function isGates(g: unknown): g is ResearchGates {
  return !!g && typeof g === "object" && "checks" in (g as object);
}

export function PortfolioBacktest() {
  const c = useCopy();
  const [startDate, setStartDate] = useState("2017-01-01");
  const [symbols, setSymbols] = useState("");
  const [marketFilter, setMarketFilter] = useState(true);
  const [job, setJob] = useState<PortfolioBacktestJob | null>(null);
  const [history, setHistory] = useState<PortfolioBacktestJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const segmentName: Record<string, string> = {
    development: c("Development (≤2023)", "开发集（≤2023）"),
    validation: c("Out-of-sample (2024–25)", "样本外（2024–25）"),
    holdout: c("Untouched (2026+)", "未使用数据（2026 起）"),
  };
  const gateName: Record<string, string> = {
    expectancy_r: c("Expectancy ≥ +0.15R", "每笔期望 ≥ +0.15R"),
    profit_factor: c("Profit factor ≥ 1.30", "盈亏比 ≥ 1.30"),
    max_drawdown_pct: c("Max drawdown ≤ 10%", "最大回撤 ≤ 10%"),
    min_trades: c("At least 100 trades", "至少 100 笔交易"),
  };

  const poll = useCallback(async (id: string) => {
    try {
      const next = await fetchBacktestJob(id);
      setJob(next);
      if (next.status === "queued" || next.status === "running") {
        timer.current = setTimeout(() => poll(id), POLL_MS);
      } else {
        fetchBacktestJobs()
          .then(setHistory)
          .catch(() => undefined);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load backtest");
    }
  }, []);

  useEffect(() => {
    fetchBacktestJobs()
      .then((rows) => {
        setHistory(rows);
        const latest = rows[0];
        if (latest) poll(latest.id);
      })
      .catch(() => undefined);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const list = symbols
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const res = await startPortfolioBacktest({
        start_date: startDate,
        use_market_filter: marketFilter,
        symbols: list.length ? list : undefined,
      });
      if (timer.current) clearTimeout(timer.current);
      poll(res.id);
    } catch (err: any) {
      setError(err?.message || c("Couldn't start the backtest", "回测启动失败"));
    } finally {
      setStarting(false);
    }
  };

  const busy = job?.status === "queued" || job?.status === "running";
  const summary = isSummary(job?.summary_metrics) ? job!.summary_metrics : null;
  const gates = isGates(job?.gates) ? job!.gates : null;

  const fmtPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
  const skippedByReason = (job?.skipped_signals ?? []).reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s.reason]: (acc[s.reason] ?? 0) + 1 }),
    {},
  );

  const row = (label: string, s: BacktestSummary, g?: ResearchGates) => (
    <tr key={label} className="border-t border-border/40">
      <td className="px-3 py-2.5 font-medium text-foreground">{label}</td>
      <td className="figure px-3 py-2.5">{s.total_trades}</td>
      <td className="figure px-3 py-2.5">{s.win_rate_pct.toFixed(1)}%</td>
      <td
        className={cn(
          "figure px-3 py-2.5 font-semibold",
          s.expectancy_r >= 0 ? "text-positive" : "text-negative",
        )}
      >
        {formatR(s.expectancy_r)}
      </td>
      <td className="figure px-3 py-2.5">
        {s.profit_factor == null ? "—" : s.profit_factor.toFixed(2)}
      </td>
      <td className="figure px-3 py-2.5 text-negative">−{s.max_drawdown_pct.toFixed(1)}%</td>
      <td className="figure px-3 py-2.5">{fmtPct(s.total_return_pct)}</td>
      <td className="px-3 py-2.5">
        {g &&
          (g.passed ? (
            <span className="font-semibold text-positive">{c("Pass", "达标")}</span>
          ) : (
            <span className="font-semibold text-negative">{c("Fail", "未达标")}</span>
          ))}
      </td>
    </tr>
  );

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold text-foreground">
            {c("Does Swing V3.0 have an edge?", "Swing V3.0 到底有没有优势？")}
          </h2>
          <InfoTip label={c("How this backtest works", "回测怎么算")}>
            <p>
              {c(
                "Replays the live scanner's exact rules on every stock in the list, on one shared $100k account: market state per day, same-day signals ranked by RS20, 10% max per stock, open-risk caps, slippage 5 bps each side. Results are split into development, out-of-sample and untouched periods and checked against the PRD research thresholds. Not modelled: earnings exits, dividends, delisted stocks (today's list is used for the past, which flatters results).",
                "用实时扫描的同一套规则，在一个 10 万美元的共用账户上回放清单里所有股票：每天按当时的市场状态限额，同一天多个信号按 RS20 排序，单股不超过 10%，合计风险有上限，双边滑点各 5 个基点。结果分成开发集、样本外、未使用数据三段，并对照 PRD 的研究门槛。未模拟：财报前退出、分红、已退市股票（用今天的股票名单回测过去，结果会偏乐观）。",
              )}
            </p>
          </InfoTip>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5 text-xs text-muted-foreground">
            <span className="block">{c("Start date", "开始日期")}</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-40 rounded-xl text-xs"
            />
          </label>
          <label className="min-w-[200px] flex-1 space-y-1.5 text-xs text-muted-foreground">
            <span className="block">
              {c("Stocks (blank = scanner's 25)", "股票（留空 = 扫描的 25 只）")}
            </span>
            <Input
              value={symbols}
              onChange={(e) => setSymbols(e.target.value.toUpperCase())}
              placeholder="NVDA, AAPL, MSFT"
              className="h-9 rounded-xl font-mono text-xs"
            />
          </label>
          <label className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={marketFilter}
              onChange={(e) => setMarketFilter(e.target.checked)}
              className="h-4 w-4"
            />
            {c("Market filter", "市场过滤")}
          </label>
          <Button
            onClick={start}
            disabled={starting || busy}
            size="sm"
            className="h-9 gap-1.5 rounded-full px-4 text-xs font-semibold"
          >
            {busy ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {busy ? c("Running...", "回测中...") : c("Run backtest", "开始回测")}
          </Button>
        </div>
      </Card>

      {error && (
        <div className="rounded-2xl border border-negative/30 bg-negative/10 p-4 text-sm text-negative">
          {error}
        </div>
      )}

      {busy && (
        <Card className="p-5 text-sm text-muted-foreground">
          {c(
            "Fetching years of daily bars and replaying — usually 1–3 minutes. You can leave this page.",
            "正在拉取多年日线并回放，通常 1–3 分钟，可以先离开这个页面。",
          )}
        </Card>
      )}

      {job?.status === "failed" && (
        <Card className="p-5 text-sm text-negative">
          {c("Backtest failed: ", "回测失败：")}
          {job.error}
        </Card>
      )}

      {job?.status === "completed" && summary && gates && (
        <>
          <Card className="space-y-4 p-5 sm:p-6">
            <p
              className={cn(
                "text-xl font-semibold tracking-tight",
                gates.passed ? "text-positive" : "text-negative",
              )}
            >
              {gates.passed
                ? c("Meets the PRD research thresholds", "达到 PRD 研究门槛")
                : c("Does not meet the PRD research thresholds", "未达到 PRD 研究门槛")}
            </p>
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {Object.entries(gates.checks).map(([key, ok]) => (
                <li key={key} className="flex items-center gap-2">
                  {ok ? (
                    <Check className="h-4 w-4 text-positive" aria-label={c("Met", "满足")} />
                  ) : (
                    <X className="h-4 w-4 text-negative" aria-label={c("Not met", "不满足")} />
                  )}
                  <span className={ok ? "text-foreground" : "text-muted-foreground"}>
                    {gateName[key] ?? key}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {job.start_date} → {job.end_date} · {job.parameters.symbols.length}{" "}
              {c("stocks", "只股票")} ·{" "}
              {job.parameters.use_market_filter
                ? c("market filter on", "市场过滤开")
                : c("market filter off", "市场过滤关")}
              {job.benchmark &&
                ` · SPY ${c("buy & hold", "买入持有")} ${fmtPct(job.benchmark.total_return_pct)}`}
            </p>
          </Card>

          <div className="overflow-x-auto rounded-3xl border border-foreground/10">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-medium">{c("Period", "区间")}</th>
                  <th className="px-3 py-2.5 font-medium">{c("Trades", "笔数")}</th>
                  <th className="px-3 py-2.5 font-medium">{c("Win rate", "胜率")}</th>
                  <th className="px-3 py-2.5 font-medium">{c("Expectancy", "每笔期望")}</th>
                  <th className="px-3 py-2.5 font-medium">PF</th>
                  <th className="px-3 py-2.5 font-medium">{c("Max DD", "最大回撤")}</th>
                  <th className="px-3 py-2.5 font-medium">{c("Return", "收益")}</th>
                  <th className="px-3 py-2.5 font-medium">{c("Gates", "门槛")}</th>
                </tr>
              </thead>
              <tbody>
                {row(c("All", "全部"), summary, gates)}
                {(job.segments ?? []).map((seg) =>
                  row(segmentName[seg.name] ?? seg.name, seg.summary, seg.gates),
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            {c("Max losing streak", "最长连亏")} {summary.max_consecutive_losses} ·{" "}
            {c("avg hold", "平均持有")} {summary.avg_holding_days} {c("days", "天")} ·{" "}
            {c("gap stops", "跳空止损")} {summary.gap_loss_count} ·{" "}
            {c("time in market", "持仓时间占比")} {summary.market_exposure_pct}%
            {Object.keys(skippedByReason).length > 0 && (
              <>
                {" · "}
                {c("signals not taken", "未成交信号")}:{" "}
                {Object.entries(skippedByReason)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([reason, n]) => `${reasonText(reason, c) ?? reason} ×${n}`)
                  .join("；")}
              </>
            )}
            {job.excluded_symbols && job.excluded_symbols.length > 0 && (
              <>
                {" · "}
                {c("no data", "无数据")}: {job.excluded_symbols.join(", ")}
              </>
            )}
          </p>
        </>
      )}

      {history.length > 1 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{c("Earlier runs", "历史回测")}</h3>
          <ul className="space-y-1 text-xs">
            {history.slice(0, 8).map((h) => {
              const s = isSummary(h.summary_metrics) ? h.summary_metrics : null;
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => poll(h.id)}
                    className={cn(
                      "w-full rounded-xl px-3 py-2 text-left hover:bg-muted/40",
                      job?.id === h.id && "bg-muted/40",
                    )}
                  >
                    <span className="text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString()} · {h.start_date} → {h.end_date}{" "}
                      ·{" "}
                    </span>
                    {s ? (
                      <span className="figure text-foreground">
                        {s.total_trades} {c("trades", "笔")} · {formatR(s.expectancy_r)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{h.status}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
