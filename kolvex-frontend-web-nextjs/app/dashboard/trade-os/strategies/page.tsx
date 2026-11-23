"use client";

import { useEffect, useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { StrategyVersion, fetchStrategies } from "@/lib/tradeOsApi";
import { FlaskConical, ShieldCheck, GitCommit, CheckCircle2, Lock } from "lucide-react";
import { BacktestRunner } from "@/components/trade-os/strategies/BacktestRunner";

export default function TradeOsStrategiesPage() {
  const c = useCopy();
  const [strategies, setStrategies] = useState<StrategyVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchStrategies();
        setStrategies(data);
      } catch (err) {
        console.error("Failed to load strategies", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-emerald-500" />
          {c("Strategy Lab & Version Registry", "策略实验室与版本注册表")}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {c(
            "Every strategy is explicitly versioned with a canonical cryptographic hash. Active strategies cannot be silently edited.",
            "每套交易策略均拥有不可变版本号与配置哈希指纹。已使用的策略规则禁止静默编辑，必须发布新版本。",
          )}
        </p>
      </div>

      {/* Strategies List */}
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-xs text-muted-foreground">
            {c("Loading strategy definitions...", "正在加载策略定义...")}
          </div>
        ) : strategies.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">
            {c("No strategies defined.", "未定义策略。")}
          </div>
        ) : (
          strategies.map((strat) => (
            <div
              key={strat.id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4"
            >
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-foreground">{strat.display_name}</h2>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      v{strat.version}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground uppercase">
                      {strat.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{strat.description}</p>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/50 px-2.5 py-1 rounded-md">
                  <Lock className="h-3 w-3 text-emerald-500" />
                  <span className="text-[0.6875rem]">
                    {strat.config_hash ? strat.config_hash.slice(0, 16) : "—"}...
                  </span>
                </div>
              </div>

              {/* Rules & Parameters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* Entry Rules */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {c("Entry Rules", "入场规则")}
                  </span>
                  <ul className="space-y-1 font-mono text-[0.6875rem] text-muted-foreground">
                    {Array.isArray(strat.entry_rules) && strat.entry_rules.length > 0 ? (
                      strat.entry_rules.map((r, i) => (
                        <li key={i} className="rounded bg-background p-1.5 border border-border">
                          {r.indicator} {r.operator} {r.value}
                        </li>
                      ))
                    ) : (
                      <li>{c("No explicit entry rules", "无显式入场规则")}</li>
                    )}
                  </ul>
                </div>

                {/* Exit Rules */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-red-500" />
                    {c("Exit Rules", "退出规则")}
                  </span>
                  <ul className="space-y-1 font-mono text-[0.6875rem] text-muted-foreground">
                    {Array.isArray(strat.exit_rules) && strat.exit_rules.length > 0 ? (
                      strat.exit_rules.map((r, i) => (
                        <li key={i} className="rounded bg-background p-1.5 border border-border">
                          {r.type}: {r.distance || r.target || `${r.max_holding_sessions} sessions`}
                        </li>
                      ))
                    ) : (
                      <li>{c("No explicit exit rules", "无显式退出规则")}</li>
                    )}
                  </ul>
                </div>

                {/* Parameters */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <GitCommit className="h-3.5 w-3.5 text-blue-500" />
                    {c("Parameters", "配置参数")}
                  </span>
                  <div className="space-y-1 font-mono text-[0.6875rem] text-muted-foreground">
                    {strat.parameters && typeof strat.parameters === "object" ? (
                      Object.entries(strat.parameters).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between rounded bg-background p-1.5 border border-border"
                        >
                          <span>{k}</span>
                          <span className="font-semibold text-foreground">{String(v)}</span>
                        </div>
                      ))
                    ) : (
                      <p>{c("No parameters", "无参数")}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Historical Backtester */}
      <div className="pt-4 border-t border-border/40">
        <BacktestRunner />
      </div>
    </div>
  );
}
