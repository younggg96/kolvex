"use client";

import React, { useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { runBacktest, BacktestResult, BacktestTrade } from "@/lib/tradeOsApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListCard } from "@/components/ui/list-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, RefreshCw, BarChart2, AlertCircle } from "lucide-react";
import { withSign } from "@/lib/format";
import { cn } from "@/lib/utils";

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
      <Card className="p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            {t.title}
          </h3>
        </div>

        <form onSubmit={handleRun} className="flex flex-wrap items-end gap-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t.symbol}</label>
            <Input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="NVDA"
              className="h-9 w-28 rounded-xl font-mono text-xs font-semibold uppercase"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t.period}</label>
            <Select value={period} onValueChange={(val) => setPeriod(val)}>
              <SelectTrigger className="h-9 w-36 rounded-xl text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1y" className="text-xs">
                  1 Year (1 年)
                </SelectItem>
                <SelectItem value="2y" className="text-xs">
                  2 Years (2 年)
                </SelectItem>
                <SelectItem value="5y" className="text-xs">
                  5 Years (5 年)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={running || !symbol}
            size="sm"
            className="h-9 rounded-full px-4 text-xs font-semibold gap-1.5"
          >
            {running ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            {running ? t.running : t.run}
          </Button>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto self-center">
            <span>Quick:</span>
            {["NVDA", "AAPL", "MSFT", "AMZN", "TSLA"].map((sym) => (
              <Button
                key={sym}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSymbol(sym)}
                className="h-7 px-2 rounded-full text-xs text-muted-foreground hover:text-foreground"
              >
                {sym}
              </Button>
            ))}
          </div>
        </form>
      </Card>

      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {result && result.summary && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.winRate}</span>
              <div className="figure text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {result.summary.win_rate_pct.toFixed(1)}%
              </div>
              <span className="figure text-[11px] text-muted-foreground">
                {result.summary.winning_trades}W / {result.summary.losing_trades}L
              </span>
            </Card>

            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.profitFactor}</span>
              <div className="figure text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {result.summary.profit_factor.toFixed(2)}
              </div>
              <span className="text-[11px] text-muted-foreground">Gross Win/Loss</span>
            </Card>

            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.expectancy}</span>
              <div
                className={cn(
                  "figure text-xl font-semibold tracking-tight sm:text-2xl",
                  result.summary.expectancy_r >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {withSign(result.summary.expectancy_r, (m) => `${m.toFixed(2)}R`)}
              </div>
              <span className="text-[11px] text-muted-foreground">Per Trade Return</span>
            </Card>

            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.maxDd}</span>
              <div className="figure text-xl font-semibold tracking-tight text-negative sm:text-2xl">
                {result.summary.max_drawdown_pct.toFixed(2)}%
              </div>
              <span className="text-[11px] text-muted-foreground">From Peak Equity</span>
            </Card>

            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.netPnl}</span>
              <div
                className={cn(
                  "figure text-xl font-semibold tracking-tight sm:text-2xl",
                  parseFloat(result.summary.net_pnl) >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {withSign(parseFloat(result.summary.net_pnl), (m) => `$${m.toFixed(2)}`)}
              </div>
              <span className="figure text-[11px] text-muted-foreground">
                Return: {result.summary.total_return_pct.toFixed(1)}%
              </span>
            </Card>

            <Card className="p-4 sm:p-5 space-y-1">
              <span className="text-xs text-muted-foreground block">{t.totalTrades}</span>
              <div className="figure text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {result.summary.total_trades}
              </div>
              <span className="figure text-[11px] text-muted-foreground">
                Sharpe: {result.summary.sharpe_ratio}
              </span>
            </Card>
          </div>

          {/* Trade Logs Table inside ListCard */}
          <section className="space-y-3">
            <h4 className="text-base font-semibold text-foreground px-1">
              {t.trades} ({result.trades.length})
            </h4>

            <ListCard>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground border-b border-border/40">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Dates (Entry &rarr; Exit)</th>
                      <th className="px-3 py-2.5 font-medium">{t.entry}</th>
                      <th className="px-3 py-2.5 font-medium">{t.exit}</th>
                      <th className="px-3 py-2.5 font-medium">Shares</th>
                      <th className="px-3 py-2.5 font-medium">{t.pnl}</th>
                      <th className="px-3 py-2.5 font-medium">{t.rMult}</th>
                      <th className="px-3 py-2.5 font-medium">{t.reason}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 text-foreground font-mono">
                    {result.trades.map((tr: BacktestTrade, idx: number) => {
                      const pnlNum = parseFloat(tr.pnl);
                      return (
                        <tr key={idx} className="hover:bg-muted/20 transition">
                          <td className="px-3 py-3 text-muted-foreground">
                            {tr.entry_date} &rarr; {tr.exit_date}
                          </td>
                          <td className="px-3 py-3 font-medium figure">${tr.entry_price}</td>
                          <td className="px-3 py-3 font-medium figure">${tr.exit_price}</td>
                          <td className="px-3 py-3 figure">{tr.shares}</td>
                          <td
                            className={cn(
                              "px-3 py-3 font-semibold figure",
                              pnlNum >= 0 ? "text-positive" : "text-negative",
                            )}
                          >
                            {withSign(pnlNum, (m) => `$${m.toFixed(2)}`)}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-3 font-semibold figure",
                              tr.r_multiple >= 0 ? "text-positive" : "text-negative",
                            )}
                          >
                            {withSign(tr.r_multiple, (m) => `${m.toFixed(2)}R`)}
                          </td>
                          <td className="px-3 py-3 font-sans">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[11px] font-medium uppercase",
                                tr.exit_reason === "take_profit"
                                  ? "bg-emerald-500/10 text-positive"
                                  : tr.exit_reason === "stop_loss"
                                    ? "bg-negative/10 text-negative"
                                    : "bg-muted text-muted-foreground",
                              )}
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
            </ListCard>
          </section>
        </div>
      )}
    </div>
  );
}
