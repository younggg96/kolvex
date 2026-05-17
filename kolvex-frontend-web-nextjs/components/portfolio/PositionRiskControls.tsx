"use client";

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listQuantAssignments,
  listQuantStrategies,
  upsertQuantAssignment,
  type QuantAssignment,
  type QuantStrategy,
} from "@/lib/quantStrategyApi";
import type { SnapTradePosition } from "./types";

export function PositionRiskControls({
  positions,
}: {
  positions: SnapTradePosition[];
}) {
  const [strategies, setStrategies] = useState<QuantStrategy[]>([]);
  const [assignments, setAssignments] = useState<Record<string, QuantAssignment>>({});
  const [busySymbol, setBusySymbol] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listQuantStrategies(), listQuantAssignments()])
      .then(([strategyResult, assignmentResult]) => {
        setStrategies(strategyResult.strategies);
        setAssignments(
          Object.fromEntries(
            assignmentResult.assignments.map((assignment) => [
              assignment.symbol,
              assignment,
            ])
          )
        );
      })
      .catch((error) => toast.error(error.message));
  }, []);

  const equityPositions = useMemo(
    () => positions.filter((position) => position.position_type !== "option"),
    [positions]
  );

  const updateDraft = (
    symbol: string,
    patch: Partial<Omit<QuantAssignment, "id" | "symbol">>
  ) => {
    setAssignments((current) => ({
      ...current,
      [symbol]: {
        id: current[symbol]?.id || symbol,
        symbol,
        strategy_id: current[symbol]?.strategy_id || null,
        stop_loss_pct: current[symbol]?.stop_loss_pct || null,
        take_profit_pct: current[symbol]?.take_profit_pct || null,
        trailing_stop_pct: current[symbol]?.trailing_stop_pct || null,
        ...patch,
      },
    }));
  };

  const save = async (symbol: string) => {
    const draft = assignments[symbol];
    setBusySymbol(symbol);
    try {
      const saved = await upsertQuantAssignment(symbol, {
        strategy_id: draft?.strategy_id || null,
        stop_loss_pct: draft?.stop_loss_pct || null,
        take_profit_pct: draft?.take_profit_pct || null,
        trailing_stop_pct: draft?.trailing_stop_pct || null,
      });
      setAssignments((current) => ({ ...current, [symbol]: saved }));
      toast.success(`${symbol} 风控已保存`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusySymbol(null);
    }
  };

  if (!equityPositions.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">持仓止损止盈</h3>
        <p className="text-xs text-muted-foreground">
          百分比以持仓均价为基准，当前只做策略绑定和风控记录。
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[120px_1fr_120px_120px_120px_72px] gap-2 border-b border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span>代码</span>
            <span>策略</span>
            <span>止损 %</span>
            <span>止盈 %</span>
            <span>移动止损 %</span>
            <span />
          </div>
          {equityPositions.map((position) => {
            const draft = assignments[position.symbol];
            return (
              <div
                key={position.id}
                className="grid grid-cols-[120px_1fr_120px_120px_120px_72px] items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
              >
                <span className="font-medium">{position.symbol}</span>
                <Select
                  value={draft?.strategy_id || "none"}
                  onValueChange={(value) =>
                    updateDraft(position.symbol, {
                      strategy_id: value === "none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不绑定策略</SelectItem>
                    {strategies.map((strategy) => (
                      <SelectItem key={strategy.id} value={strategy.id}>
                        {strategy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  value={draft?.stop_loss_pct ?? ""}
                  onChange={(event) =>
                    updateDraft(position.symbol, {
                      stop_loss_pct: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
                <Input
                  type="number"
                  min="0"
                  value={draft?.take_profit_pct ?? ""}
                  onChange={(event) =>
                    updateDraft(position.symbol, {
                      take_profit_pct: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
                <Input
                  type="number"
                  min="0"
                  value={draft?.trailing_stop_pct ?? ""}
                  onChange={(event) =>
                    updateDraft(position.symbol, {
                      trailing_stop_pct: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => save(position.symbol)}
                  disabled={busySymbol === position.symbol}
                  title="保存"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
