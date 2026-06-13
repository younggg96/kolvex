"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Settings2,
  ShieldCheck,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteQuantAssignment,
  listQuantAssignments,
  listQuantStrategies,
  upsertQuantAssignment,
  type QuantAssignment,
  type QuantStrategy,
} from "@/lib/quantStrategyApi";
import { formatCurrency } from "@/lib/snaptradeApi";
import type { SnapTradePosition } from "./types";

type RiskDraft = {
  strategy_id: string | null;
  stop_loss_pct: number | null;
  take_profit_pct: number | null;
  trailing_stop_pct: number | null;
};

const EMPTY_DRAFT: RiskDraft = {
  strategy_id: null,
  stop_loss_pct: null,
  take_profit_pct: null,
  trailing_stop_pct: null,
};

function numberOrNull(value: string) {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? parsed : null;
}

function getAveragePrice(position: SnapTradePosition) {
  return Number(position.average_purchase_price || 0);
}

function getCurrentPrice(position: SnapTradePosition) {
  return Number(position.price || 0);
}

function getUnits(position: SnapTradePosition) {
  return Math.abs(Number(position.units || 0));
}

function hasRiskPlan(assignment?: QuantAssignment) {
  return Boolean(
    assignment?.strategy_id ||
      assignment?.stop_loss_pct ||
      assignment?.take_profit_pct ||
      assignment?.trailing_stop_pct
  );
}

export function PositionRiskControls({
  positions,
}: {
  positions: SnapTradePosition[];
}) {
  const [strategies, setStrategies] = useState<QuantStrategy[]>([]);
  const [assignments, setAssignments] = useState<Record<string, QuantAssignment>>({});
  const [selectedPosition, setSelectedPosition] =
    useState<SnapTradePosition | null>(null);
  const [draft, setDraft] = useState<RiskDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

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
      .catch((error) => {
        if (error.message.includes("migration has not been applied")) {
          setSetupRequired(true);
        } else {
          toast.error(error.message);
        }
      });
  }, []);

  const equityPositions = useMemo(
    () =>
      positions
        .filter(
          (position) =>
            position.position_type !== "option" && getAveragePrice(position) > 0
        )
        .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [positions]
  );

  const configuredCount = equityPositions.filter((position) =>
    hasRiskPlan(assignments[position.symbol])
  ).length;

  const openEditor = (position: SnapTradePosition) => {
    const assignment = assignments[position.symbol];
    setSelectedPosition(position);
    setDraft({
      strategy_id: assignment?.strategy_id || null,
      stop_loss_pct: assignment?.stop_loss_pct || null,
      take_profit_pct: assignment?.take_profit_pct || null,
      trailing_stop_pct: assignment?.trailing_stop_pct || null,
    });
  };

  const save = async () => {
    if (!selectedPosition) return;
    if (!draft.stop_loss_pct && !draft.take_profit_pct && !draft.strategy_id) {
      toast.error("请至少设置止损、止盈或绑定一个策略");
      return;
    }
    setBusy(true);
    try {
      const saved = await upsertQuantAssignment(selectedPosition.symbol, draft);
      setAssignments((current) => ({
        ...current,
        [selectedPosition.symbol]: saved,
      }));
      setSelectedPosition(null);
      toast.success(`${selectedPosition.symbol} 风控计划已保存`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selectedPosition) return;
    setBusy(true);
    try {
      await deleteQuantAssignment(selectedPosition.symbol);
      setAssignments((current) => {
        const next = { ...current };
        delete next[selectedPosition.symbol];
        return next;
      });
      setSelectedPosition(null);
      toast.success(`${selectedPosition.symbol} 风控计划已移除`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移除失败");
    } finally {
      setBusy(false);
    }
  };

  if (!equityPositions.length) return null;

  const averagePrice = selectedPosition
    ? getAveragePrice(selectedPosition)
    : 0;
  const currentPrice = selectedPosition
    ? getCurrentPrice(selectedPosition)
    : 0;
  const units = selectedPosition ? getUnits(selectedPosition) : 0;
  const stopPrice =
    draft.stop_loss_pct && averagePrice
      ? averagePrice * (1 - draft.stop_loss_pct / 100)
      : null;
  const targetPrice =
    draft.take_profit_pct && averagePrice
      ? averagePrice * (1 + draft.take_profit_pct / 100)
      : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">持仓风控计划</h3>
            <Badge variant="outline" className="text-[10px]">
              {configuredCount}/{equityPositions.length} 已设置
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            设置目标价并记录交易纪律。当前不会向券商自动提交卖单。
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          仅提醒与记录，不自动交易
        </div>
      </div>

      {setupRequired && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          量化策略数据库尚未初始化，当前无法保存风控计划。
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[110px_120px_120px_1fr_1fr_96px] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <span>代码</span>
            <span>持仓均价</span>
            <span>当前价格</span>
            <span>止损计划</span>
            <span>止盈计划</span>
            <span />
          </div>
          {equityPositions.map((position) => {
            const assignment = assignments[position.symbol];
            const average = getAveragePrice(position);
            const current = getCurrentPrice(position);
            const stop =
              assignment?.stop_loss_pct &&
              average * (1 - assignment.stop_loss_pct / 100);
            const target =
              assignment?.take_profit_pct &&
              average * (1 + assignment.take_profit_pct / 100);
            const stopTriggered = Boolean(stop && current && current <= stop);
            const targetReached = Boolean(target && current && current >= target);

            return (
              <div
                key={position.id}
                className="grid grid-cols-[110px_120px_120px_1fr_1fr_96px] items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
              >
                <span className="font-semibold">{position.symbol}</span>
                <span className="tabular-nums">{formatCurrency(average)}</span>
                <span className="tabular-nums">{formatCurrency(current)}</span>
                <div>
                  {stop ? (
                    <div className={stopTriggered ? "text-red-500" : ""}>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(stop)}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        -{assignment.stop_loss_pct}%
                      </span>
                      {stopTriggered && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">
                          已触及
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">未设置</span>
                  )}
                </div>
                <div>
                  {target ? (
                    <div className={targetReached ? "text-green-500" : ""}>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(target)}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        +{assignment.take_profit_pct}%
                      </span>
                      {targetReached && (
                        <Badge className="ml-2 bg-green-600 text-[10px]">
                          已达到
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">未设置</span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={hasRiskPlan(assignment) ? "outline" : "default"}
                  onClick={() => openEditor(position)}
                  disabled={setupRequired}
                  className="gap-1.5"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  {hasRiskPlan(assignment) ? "修改" : "设置"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={Boolean(selectedPosition)}
        onOpenChange={(open) => !open && setSelectedPosition(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {selectedPosition?.symbol} 风控计划
            </DialogTitle>
            <DialogDescription>
              基于持仓均价计算目标价格。保存后用于页面提醒和交易复盘，不会自动卖出。
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">持仓均价</div>
              <div className="mt-1 font-semibold tabular-nums">
                {formatCurrency(averagePrice)}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">当前价格</div>
              <div className="mt-1 font-semibold tabular-nums">
                {formatCurrency(currentPrice)}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">持仓数量</div>
              <div className="mt-1 font-semibold tabular-nums">
                {units.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-md border border-red-500/25 p-3">
              <Label htmlFor="stop-loss" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-red-500" />
                最大可接受亏损
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="stop-loss"
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={draft.stop_loss_pct ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      stop_loss_pct: numberOrNull(event.target.value),
                    }))
                  }
                  placeholder="例如 8"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {stopPrice
                  ? `止损价 ${formatCurrency(stopPrice)}，预计最大亏损 ${formatCurrency(
                      (averagePrice - stopPrice) * units
                    )}`
                  : "输入后自动计算止损价格"}
              </div>
              <div className="flex gap-1">
                {[5, 8, 10].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        stop_loss_pct: value,
                      }))
                    }
                    className="h-7 px-2 text-xs"
                  >
                    {value}%
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-green-500/25 p-3">
              <Label htmlFor="take-profit" className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                目标收益
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="take-profit"
                  type="number"
                  min="0.1"
                  max="1000"
                  step="0.1"
                  value={draft.take_profit_pct ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      take_profit_pct: numberOrNull(event.target.value),
                    }))
                  }
                  placeholder="例如 20"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {targetPrice
                  ? `目标价 ${formatCurrency(targetPrice)}，预计收益 ${formatCurrency(
                      (targetPrice - averagePrice) * units
                    )}`
                  : "输入后自动计算止盈价格"}
              </div>
              <div className="flex gap-1">
                {[10, 20, 30].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        take_profit_pct: value,
                      }))
                    }
                    className="h-7 px-2 text-xs"
                  >
                    {value}%
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {strategies.length > 0 && (
            <div className="space-y-2">
              <Label>高级：绑定量化策略（可选）</Label>
              <Select
                value={draft.strategy_id || "none"}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    strategy_id: value === "none" ? null : value,
                  }))
                }
              >
                <SelectTrigger>
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
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={remove}
              disabled={busy || !hasRiskPlan(assignments[selectedPosition?.symbol || ""])}
              className="gap-2 text-red-500 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
              移除计划
            </Button>
            <Button onClick={save} disabled={busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              保存风控计划
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
