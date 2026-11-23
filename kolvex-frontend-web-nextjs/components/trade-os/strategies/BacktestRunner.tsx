"use client";

import React, { useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { runBacktest, BacktestResult, BacktestTrade } from "@/lib/tradeOsApi";
import {
  Play,
  RefreshCw,
  BarChart2,
  Shield,
  TrendingUp,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { withSign } from "@/lib/format";

export function BacktestRunner() {
  const c = useCopy();
  const [symbol, setSymbol] = useState("NVDA");
  const [period, setPeriod] = useState("2y");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = {
    title: c("Strategy Backtester (Trend Breakout 20D)", "策略回测引擎（20日趋势突破）"),
    subtitle: c(
      "Simulate historical performance with strict position sizing and ATR stop brackets.",
      "基于历史日线全真模拟，执行严格的头寸缩放与 ATR 止损止盈几何结构。",
    ),
    symbol: c("Symbol", "测试标的"),
    period: c("Time Horizon", "回测周期"),
    run: c("Run Backtest", "开始回测"),
    running: c("Simulating...", "模拟回测中..."),
    metrics: c("Performance Summary", "回测统计摘要"),
    trades: c("Trade Logs", "交易明细清单"),
    winRate: c("Win Rate", "胜率"),
    profitFactor: c("Profit Factor", "盈亏比 (PF)"),
    expectancy: c("Expectancy R", "每笔期望 R"),
    maxDd: c("Max Drawdown", "最大回撤"),
    netPnl: c("Net PnL", "净盈亏"),
    totalTrades: c("Total Trades", "总交易次数"),
    entry: c("Entry", "入场"),
    exit: c("Exit", "出场"),
    reason: c("Exit Reason", "出场原因"),
    pnl: c("PnL", "盈亏"),
    rMult: c("R-Multiple", "R 盈亏比"),
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol) return;
    setRunning(true);
    setError(null);
    try {
      const res = await runBacktest({
        symbol: symbol.trim().toUpperCase(),
        period,
      });
      if (res.error) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res);
      }
    } catch (err: any) {
      setError(err?.message || "Backtest execution failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            {t.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t.subtitle}</p>
        </div>

        <form onSubmit={handleRun} className="flex flex-wrap items-end gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t.symbol}</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. NVDA"
              className="w-28 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase text-foreground focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t.period}</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none"
            >
              <option value="1y">1 Year (1 年)</option>
              <option value="2y">2 Years (2 年)</option>
              <option value="5y">5 Years (5 年)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={running || !symbol}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:opacity-90 transition shadow disabled:opacity-50"
          >
            {running ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            {running ? t.running : t.run}
          </button>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto self-center">
            <span>Quick:</span>
            {["NVDA", "AAPL", "MSFT", "AMZN", "TSLA"].map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => setSymbol(sym)}
                className="px-2 py-0.5 rounded bg-muted/60 hover:bg-muted text-foreground text-[11px]"
              >
                {sym}
              </button>
            ))}
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {result && result.summary && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.winRate}</span>
              <div className="text-lg font-bold text-foreground">
                {result.summary.win_rate_pct.toFixed(1)}%
              </div>
              <span className="text-[11px] text-muted-foreground">
                {result.summary.winning_trades}W / {result.summary.losing_trades}L
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.profitFactor}</span>
              <div className="text-lg font-bold text-foreground">
                {result.summary.profit_factor.toFixed(2)}
              </div>
              <span className="text-[11px] text-muted-foreground">Gross Win/Loss</span>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.expectancy}</span>
              <div
                className={`text-lg font-bold ${
                  result.summary.expectancy_r >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {withSign(result.summary.expectancy_r, (m) => `${m.toFixed(2)}R`)}
              </div>
              <span className="text-[11px] text-muted-foreground">Per Trade Return</span>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.maxDd}</span>
              <div className="text-lg font-bold text-rose-500">
                {result.summary.max_drawdown_pct.toFixed(2)}%
              </div>
              <span className="text-[11px] text-muted-foreground">From Peak Equity</span>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.netPnl}</span>
              <div
                className={`text-lg font-bold ${
                  parseFloat(result.summary.net_pnl) >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {withSign(parseFloat(result.summary.net_pnl), (m) => `$${m.toFixed(2)}`)}
              </div>
              <span className="text-[11px] text-muted-foreground">
                Return: {result.summary.total_return_pct.toFixed(1)}%
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.totalTrades}</span>
              <div className="text-lg font-bold text-foreground">{result.summary.total_trades}</div>
              <span className="text-[11px] text-muted-foreground">
                Sharpe: {result.summary.sharpe_ratio}
              </span>
            </div>
          </div>

          {/* Trade Logs Table */}
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {t.trades} ({result.trades.length})
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/30">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Dates (Entry &rarr; Exit)</th>
                    <th className="px-4 py-2.5 font-medium">{t.entry}</th>
                    <th className="px-4 py-2.5 font-medium">{t.exit}</th>
                    <th className="px-4 py-2.5 font-medium">Shares</th>
                    <th className="px-4 py-2.5 font-medium">{t.pnl}</th>
                    <th className="px-4 py-2.5 font-medium">{t.rMult}</th>
                    <th className="px-4 py-2.5 font-medium">{t.reason}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 text-foreground">
                  {result.trades.map((tr: BacktestTrade, idx: number) => {
                    const pnlNum = parseFloat(tr.pnl);
                    return (
                      <tr key={idx} className="hover:bg-muted/20 transition">
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">
                          {tr.entry_date} &rarr; {tr.exit_date}
                        </td>
                        <td className="px-4 py-2.5 font-medium">${tr.entry_price}</td>
                        <td className="px-4 py-2.5 font-medium">${tr.exit_price}</td>
                        <td className="px-4 py-2.5">{tr.shares}</td>
                        <td
                          className={`px-4 py-2.5 font-semibold ${
                            pnlNum >= 0 ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {withSign(pnlNum, (m) => `$${m.toFixed(2)}`)}
                        </td>
                        <td
                          className={`px-4 py-2.5 font-semibold ${
                            tr.r_multiple >= 0 ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {withSign(tr.r_multiple, (m) => `${m.toFixed(2)}R`)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase ${
                              tr.exit_reason === "take_profit"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : tr.exit_reason === "stop_loss"
                                  ? "bg-rose-500/10 text-rose-500"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {tr.exit_reason}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
