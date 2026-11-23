"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useCopy } from "@/components/decision/shared";
import {
  fetchLatestScannerRun,
  runOpportunityScanner,
  ScannerCandidate,
  ScannerRunResponse,
} from "@/lib/tradeOsApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import {
  Search,
  Play,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ScannerView() {
  const c = useCopy();
  const [data, setData] = useState<ScannerRunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = {
    title: c("Opportunity Scanner", "机会扫描引擎"),
    subtitle: c(
      "Identifies high-momentum setups meeting deterministic strategy rules (Trend Breakout 20D).",
      "根据确定性策略规则（20日趋势突破）自动筛选具备高动量结构的候选标的。",
    ),
    runScan: c("Run Opportunity Scan", "运行机会扫描"),
    running: c("Scanning Universe...", "全市场扫描中..."),
    strategy: c("Active Strategy", "执行策略"),
    universe: c("Focus Universe", "股票池"),
    scanned: c("Total Scanned", "已扫描标的"),
    candidatesFound: c("Qualified Setups", "符合条件标的"),
    symbol: c("Symbol", "代码"),
    price: c("Current Price", "最新价"),
    breakoutLevel: c("Breakout Level", "突破关口"),
    brackets: c("Suggested Brackets (Entry / Stop / Target)", "建议价格区间 (入场/止损/止盈)"),
    volumeSurge: c("Volume Surge", "量比"),
    action: c("Action", "操作"),
    createPlan: c("Create Plan", "生成计划"),
    emptyCandidates: c(
      "No stocks currently qualify for the Trend Breakout 20D setup in this universe. Risk discipline starts with waiting for high-probability setups.",
      "当前股票池中暂无完全符合 20日突破条件的标的。遵守交易纪律始于耐心等待高胜率形态出现。",
    ),
  };

  const loadLatest = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchLatestScannerRun();
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load scanner run");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatest();
  }, []);

  const handleRunScan = async () => {
    try {
      setRunning(true);
      setError(null);
      const res = await runOpportunityScanner();
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Scanner execution failed");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        {c("Loading Scanner...", "正在加载扫描器...")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          {t.title}
        </h2>

        <Button
          onClick={handleRunScan}
          disabled={running}
          size="sm"
          className="rounded-full px-4 text-xs font-semibold"
        >
          {running ? (
            <RefreshCw className="mr-1.5 w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="mr-1.5 w-3.5 h-3.5 fill-current" />
          )}
          {running ? t.running : t.runScan}
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Strategy & Universe Context Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="p-4 sm:p-5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            <span>{t.strategy}</span>
          </div>
          <div className="text-sm font-semibold text-foreground tracking-tight">
            Trend Breakout 20D
          </div>
          <div className="text-xs text-muted-foreground">Price &gt; SMA50 &gt; SMA200</div>
        </Card>

        <Card className="p-4 sm:p-5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>{t.universe}</span>
          </div>
          <div className="text-sm font-semibold text-foreground tracking-tight">
            Liquid Growth Top 25
          </div>
          <div className="text-xs text-muted-foreground">Min 500K Daily Vol</div>
        </Card>

        <Card className="p-4 sm:p-5 space-y-1">
          <span className="text-xs text-muted-foreground">{t.scanned}</span>
          <div className="figure text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {data?.total_scanned || 0}
          </div>
          <div className="text-xs text-muted-foreground">
            {data?.run_at ? new Date(data.run_at).toLocaleTimeString() : "Pending"}
          </div>
        </Card>

        <Card className="p-4 sm:p-5 space-y-1">
          <span className="text-xs text-muted-foreground">{t.candidatesFound}</span>
          <div className="figure text-2xl font-semibold tracking-tight text-positive sm:text-3xl">
            {data?.candidates_count || 0}
          </div>
          <div className="text-xs text-muted-foreground">Ready for Trade Plan</div>
        </Card>
      </div>

      {/* Candidate List Card */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {c("Strategy Candidates", "策略候选标的")}
          </h3>
          <span className="figure text-xs text-muted-foreground">
            {data?.candidates_count || 0} {c("matches", "只匹配")}
          </span>
        </div>

        <ListCard>
          {!data?.candidates || data.candidates.length === 0 ? (
            <ListEmptyState
              title={c("No stocks currently qualify", "当前暂无符合条件的标的")}
              description={t.emptyCandidates}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunScan}
                  disabled={running}
                  className="rounded-full"
                >
                  {c("Run scan now", "立即重新扫描")}
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border/40">
              {data.candidates.map((cand: ScannerCandidate) => (
                <div
                  key={cand.symbol}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-muted/20 transition rounded-2xl"
                >
                  <div className="space-y-2 max-w-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-foreground tracking-tight">
                        {cand.symbol}
                      </span>
                      <span className="figure text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-positive border border-emerald-500/20">
                        Score: {cand.rank_score.toFixed(0)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Vol Surge:{" "}
                        <strong className="figure text-foreground font-semibold">
                          {parseFloat(cand.volume_surge_ratio).toFixed(2)}x
                        </strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Price:{" "}
                        <strong className="figure text-foreground">
                          ${parseFloat(cand.current_price).toFixed(2)}
                        </strong>
                      </span>
                      <span>
                        20D High:{" "}
                        <strong className="figure text-foreground">
                          ${parseFloat(cand.breakout_level).toFixed(2)}
                        </strong>
                      </span>
                      <span>
                        ATR(14):{" "}
                        <strong className="figure text-foreground">
                          ${parseFloat(cand.atr14).toFixed(2)}
                        </strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {cand.matched_criteria.map((cr, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                        >
                          {cr}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 lg:self-center">
                    <div className="bg-muted/30 p-3 rounded-2xl border border-foreground/5 text-xs space-y-1 sm:text-right min-w-[190px]">
                      <div className="text-muted-foreground">
                        Stop:{" "}
                        <span className="figure text-negative font-semibold">
                          ${parseFloat(cand.suggested_stop).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        Target (2R):{" "}
                        <span className="figure text-positive font-semibold">
                          ${parseFloat(cand.suggested_target_2r).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        Risk / Share:{" "}
                        <span className="figure text-foreground font-semibold">
                          ${parseFloat(cand.risk_per_share).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      asChild
                      className="rounded-full px-4 text-xs font-semibold gap-1.5"
                    >
                      <Link
                        href={`/dashboard/trade-os/plans?symbol=${cand.symbol}&entry=${cand.suggested_entry}&stop=${cand.suggested_stop}&target=${cand.suggested_target_2r}`}
                      >
                        {t.createPlan}
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListCard>
      </section>
    </div>
  );
}
