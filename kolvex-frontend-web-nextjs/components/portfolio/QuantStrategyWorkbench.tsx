"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, FlaskConical, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createQuantStrategy,
  deleteQuantStrategy,
  listQuantStrategies,
  previewQuantStrategy,
  runQuantBacktest,
  updateQuantStrategy,
  type QuantBacktest,
  type QuantPreview,
  type QuantStrategy,
} from "@/lib/quantStrategyApi";
import type { SnapTradePosition } from "./types";

const DEFAULT_DSL = `# First matching rule wins
WHEN price <= entry_price * 0.92 THEN stop_loss
WHEN price >= entry_price * 1.15 THEN take_profit
WHEN rsi14 < 35 AND price > ema20 THEN buy
WHEN rsi14 > 70 AND price < ema20 THEN reduce`;

export function QuantStrategyWorkbench({
  positions,
}: {
  positions: SnapTradePosition[];
}) {
  const [strategies, setStrategies] = useState<QuantStrategy[]>([]);
  const [selectedId, setSelectedId] = useState<string>("new");
  const [name, setName] = useState("波动止盈止损");
  const [description, setDescription] = useState("");
  const [dsl, setDsl] = useState(DEFAULT_DSL);
  const [symbol, setSymbol] = useState(positions[0]?.symbol || "AAPL");
  const [period, setPeriod] = useState<"6mo" | "1y" | "2y" | "5y">("1y");
  const [preview, setPreview] = useState<QuantPreview | null>(null);
  const [backtest, setBacktest] = useState<QuantBacktest | null>(null);
  const [busy, setBusy] = useState(false);

  const entryPrice = useMemo(
    () =>
      positions.find((position) => position.symbol === symbol)
        ?.average_purchase_price || 100,
    [positions, symbol]
  );

  useEffect(() => {
    listQuantStrategies()
      .then(({ strategies }) => setStrategies(strategies))
      .catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    if (!symbol && positions[0]?.symbol) setSymbol(positions[0].symbol);
  }, [positions, symbol]);

  const chooseStrategy = (value: string) => {
    setSelectedId(value);
    if (value === "new") {
      setName("波动止盈止损");
      setDescription("");
      setDsl(DEFAULT_DSL);
      return;
    }
    const strategy = strategies.find((item) => item.id === value);
    if (!strategy) return;
    setName(strategy.name);
    setDescription(strategy.description || "");
    setDsl(strategy.dsl);
  };

  const save = async () => {
    setBusy(true);
    try {
      if (selectedId === "new") {
        const created = await createQuantStrategy({ name, description, dsl });
        setStrategies((items) => [created, ...items]);
        setSelectedId(created.id);
      } else {
        const updated = await updateQuantStrategy(selectedId, {
          name,
          description,
          dsl,
        });
        setStrategies((items) =>
          items.map((item) => (item.id === updated.id ? updated : item))
        );
      }
      toast.success("策略已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (selectedId === "new") return;
    setBusy(true);
    try {
      await deleteQuantStrategy(selectedId);
      setStrategies((items) => items.filter((item) => item.id !== selectedId));
      chooseStrategy("new");
      toast.success("策略已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy(false);
    }
  };

  const previewSignal = async () => {
    setBusy(true);
    try {
      setPreview(await previewQuantStrategy({ dsl, symbol, entry_price: entryPrice }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "预览失败");
    } finally {
      setBusy(false);
    }
  };

  const backtestStrategy = async () => {
    setBusy(true);
    try {
      setBacktest(
        await runQuantBacktest({
          strategy_id: selectedId === "new" ? undefined : selectedId,
          dsl,
          symbol,
          period,
          initial_capital: 10000,
        })
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "回测失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <Select value={selectedId} onValueChange={chooseStrategy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">新建策略</SelectItem>
              {strategies.map((strategy) => (
                <SelectItem key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="策略备注"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={save} disabled={busy}>
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
            <Button variant="outline" onClick={remove} disabled={busy || selectedId === "new"}>
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </Button>
          </div>
        </div>
        <Textarea
          value={dsl}
          onChange={(event) => setDsl(event.target.value)}
          className="min-h-[220px] font-mono text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {positions.map((position) => (
              <SelectItem key={position.id} value={position.symbol}>
                {position.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(value) => setPeriod(value as typeof period)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6mo">6 个月</SelectItem>
            <SelectItem value="1y">1 年</SelectItem>
            <SelectItem value="2y">2 年</SelectItem>
            <SelectItem value="5y">5 年</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={previewSignal} disabled={busy}>
          <Activity className="mr-2 h-4 w-4" />
          预览当前信号
        </Button>
        <Button onClick={backtestStrategy} disabled={busy}>
          <FlaskConical className="mr-2 h-4 w-4" />
          运行回测
        </Button>
      </div>

      {preview && (
        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="font-semibold">{preview.symbol}</span>
            <span className="rounded-md bg-muted px-2 py-1 uppercase">{preview.signal}</span>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(preview.indicators).map(([key, value]) => (
              <div key={key}>
                <div className="text-muted-foreground">{key}</div>
                <div className="tabular-nums">{value ?? "-"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {backtest && (
        <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">总回报</div>
            <div className="text-lg font-semibold">{backtest.total_return_pct}%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">最大回撤</div>
            <div className="text-lg font-semibold">{backtest.max_drawdown_pct}%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">交易次数</div>
            <div className="text-lg font-semibold">{backtest.trades_count}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">胜率</div>
            <div className="text-lg font-semibold">{backtest.win_rate_pct}%</div>
          </div>
        </div>
      )}
    </div>
  );
}
