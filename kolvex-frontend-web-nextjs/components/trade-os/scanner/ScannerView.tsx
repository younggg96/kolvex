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
import {
  Search,
  Play,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
  Layers,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";

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
        Loading Scanner...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            {t.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t.subtitle}</p>
        </div>

        <button
          onClick={handleRunScan}
          disabled={running}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition shadow disabled:opacity-50"
        >
          {running ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          {running ? t.running : t.runScan}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm">
          {error}
        </div>
      )}

      {/* Strategy & Universe Context */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{t.strategy}</span>
          </div>
          <div className="text-sm font-semibold text-foreground">Trend Breakout 20D</div>
          <div className="text-xs text-muted-foreground">Price &gt; SMA50 &gt; SMA200</div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="w-3.5 h-3.5" />
            <span>{t.universe}</span>
          </div>
          <div className="text-sm font-semibold text-foreground">Liquid Growth Top 25</div>
          <div className="text-xs text-muted-foreground">Min 500K Daily Vol</div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
          <span className="text-xs text-muted-foreground">{t.scanned}</span>
          <div className="text-xl font-bold text-foreground">{data?.total_scanned || 0}</div>
          <div className="text-xs text-muted-foreground">
            {data?.run_at ? new Date(data.run_at).toLocaleTimeString() : "Pending"}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
          <span className="text-xs text-muted-foreground">{t.candidatesFound}</span>
          <div className="text-xl font-bold text-emerald-500">{data?.candidates_count || 0}</div>
          <div className="text-xs text-muted-foreground">Ready for Trade Plan</div>
        </div>
      </div>

      {/* Candidate List */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Strategy Candidates
          </h3>
          <span className="text-xs text-muted-foreground">
            {data?.candidates_count || 0} matches
          </span>
        </div>

        {!data?.candidates || data.candidates.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
              <Search className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto text-sm text-muted-foreground leading-relaxed">
              {t.emptyCandidates}
            </div>
            <button
              onClick={handleRunScan}
              disabled={running}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              Run scan now &rarr;
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {data.candidates.map((cand: ScannerCandidate) => (
              <div
                key={cand.symbol}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-muted/20 transition"
              >
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-foreground tracking-tight">
                      {cand.symbol}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Score: {cand.rank_score.toFixed(0)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Vol Surge:{" "}
                      <strong className="text-foreground">
                        {parseFloat(cand.volume_surge_ratio).toFixed(2)}x
                      </strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Price:{" "}
                      <strong className="text-foreground">
                        ${parseFloat(cand.current_price).toFixed(2)}
                      </strong>
                    </span>
                    <span>
                      20D High:{" "}
                      <strong className="text-foreground">
                        ${parseFloat(cand.breakout_level).toFixed(2)}
                      </strong>
                    </span>
                    <span>
                      ATR(14):{" "}
                      <strong className="text-foreground">
                        ${parseFloat(cand.atr14).toFixed(2)}
                      </strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {cand.matched_criteria.map((c, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:self-center">
                  <div className="bg-muted/40 p-3 rounded-lg border border-border/40 text-xs space-y-1 sm:text-right min-w-[190px]">
                    <div className="text-muted-foreground">
                      Stop:{" "}
                      <span className="text-rose-500 font-semibold">
                        ${parseFloat(cand.suggested_stop).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Target (2R):{" "}
                      <span className="text-emerald-500 font-semibold">
                        ${parseFloat(cand.suggested_target_2r).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Risk / Share:{" "}
                      <span className="text-foreground font-semibold">
                        ${parseFloat(cand.risk_per_share).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/trade-os/plans?symbol=${cand.symbol}&entry=${cand.suggested_entry}&stop=${cand.suggested_stop}&target=${cand.suggested_target_2r}`}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:opacity-90 transition shadow"
                  >
                    {t.createPlan}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
