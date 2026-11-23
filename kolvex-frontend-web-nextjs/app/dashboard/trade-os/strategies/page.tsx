"use client";

import { useEffect, useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { StrategyVersion, fetchStrategies } from "@/lib/tradeOsApi";
import { Card } from "@/components/ui/card";
import { FlaskConical, ShieldCheck, GitCommit, CheckCircle2, Lock } from "lucide-react";
import { BacktestRunner } from "@/components/trade-os/strategies/BacktestRunner";
import { PortfolioBacktest } from "@/components/trade-os/strategies/PortfolioBacktest";

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
      {/* Portfolio backtest first: it answers whether the strategy has an edge */}
      <PortfolioBacktest />

      <details className="group rounded-3xl border border-foreground/10 p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          {c("Single-stock backtest", "单只股票回测")}
        </summary>
        <div className="pt-4">
          <BacktestRunner />
        </div>
      </details>

      {/* Strategies Registry Section */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            {c("Strategy Lab & Version Registry", "策略版本注册表")}
          </h2>
        </div>

        <div className="space-y-4">
          {loading ? (
            <Card className="p-12 text-center text-xs text-muted-foreground">
              {c("Loading strategy definitions...", "正在加载策略定义...")}
            </Card>
          ) : strategies.length === 0 ? (
            <Card className="p-8 text-center text-xs text-muted-foreground">
              {c("No strategies defined.", "未定义策略。")}
            </Card>
          ) : (
            strategies.map((strat) => (
              <Card key={strat.id} className="p-5 sm:p-6 space-y-4">
                {/* Strategy Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {strat.display_name}
                      </h3>
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-mono font-semibold text-positive">
                        v{strat.version}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground uppercase">
                        {strat.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{strat.description}</p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/40 px-2.5 py-1 rounded-full">
                    <Lock className="h-3 w-3 text-primary" />
                    <span className="text-[0.6875rem]">
                      {strat.config_hash ? strat.config_hash.slice(0, 16) : "—"}...
                    </span>
                  </div>
                </div>

                {/* Rules & Parameters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Entry Rules */}
                  <div className="rounded-2xl border border-foreground/5 bg-muted/20 p-3.5 space-y-2">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-positive" />
                      {c("Entry Rules", "入场规则")}
                    </span>
                    <ul className="space-y-1 font-mono text-[0.6875rem] text-muted-foreground">
                      {Array.isArray(strat.entry_rules) && strat.entry_rules.length > 0 ? (
                        strat.entry_rules.map((r, i) => (
                          <li
                            key={i}
                            className="rounded-xl bg-background/80 p-2 border border-foreground/5"
                          >
                            {r.indicator} {r.operator} {r.value}
                          </li>
                        ))
                      ) : (
                        <li>{c("No explicit entry rules", "无显式入场规则")}</li>
                      )}
                    </ul>
                  </div>

                  {/* Exit Rules */}
                  <div className="rounded-2xl border border-foreground/5 bg-muted/20 p-3.5 space-y-2">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-negative" />
                      {c("Exit Rules", "退出规则")}
                    </span>
                    <ul className="space-y-1 font-mono text-[0.6875rem] text-muted-foreground">
                      {Array.isArray(strat.exit_rules) && strat.exit_rules.length > 0 ? (
                        strat.exit_rules.map((r, i) => (
                          <li
                            key={i}
                            className="rounded-xl bg-background/80 p-2 border border-foreground/5"
                          >
                            {r.type}:{" "}
                            {r.distance || r.target || `${r.max_holding_sessions} sessions`}
                          </li>
                        ))
                      ) : (
                        <li>{c("No explicit exit rules", "无显式退出规则")}</li>
                      )}
                    </ul>
                  </div>

                  {/* Parameters */}
                  <div className="rounded-2xl border border-foreground/5 bg-muted/20 p-3.5 space-y-2">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <GitCommit className="h-3.5 w-3.5 text-primary" />
                      {c("Parameters", "配置参数")}
                    </span>
                    <div className="space-y-1 font-mono text-[0.6875rem] text-muted-foreground">
                      {strat.parameters && typeof strat.parameters === "object" ? (
                        Object.entries(strat.parameters).map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-center justify-between rounded-xl bg-background/80 p-2 border border-foreground/5"
                          >
                            <span>{k}</span>
                            <span className="figure font-semibold text-foreground">
                              {String(v)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p>{c("No parameters", "无参数")}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
