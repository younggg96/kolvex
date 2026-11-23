"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCopy } from "@/components/decision/shared";
import {
  TradingAccount,
  StrategyVersion,
  createTradePlan,
  approveTradePlan,
  calculateSizing,
  RiskAssessment,
} from "@/lib/tradeOsApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, AlertCircle, RefreshCw, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

interface TradePlanBuilderProps {
  accounts: TradingAccount[];
  selectedAccountId: string | null;
  strategies: StrategyVersion[];
  onPlanCreated: (assessment?: RiskAssessment) => void;
}

export function TradePlanBuilder({
  accounts,
  selectedAccountId,
  strategies,
  onPlanCreated,
}: TradePlanBuilderProps) {
  const c = useCopy();
  const searchParams = useSearchParams();
  const qSymbol = searchParams?.get("symbol");
  const qEntry = searchParams?.get("entry");
  const qStop = searchParams?.get("stop");
  const qTarget = searchParams?.get("target");

  const [symbol, setSymbol] = useState(qSymbol || "NVDA");
  const [strategyId, setStrategyId] = useState<string>("");
  const [entryPrice, setEntryPrice] = useState(qEntry || "130.00");
  const [stopPrice, setStopPrice] = useState(qStop || "123.50");
  const [targetPrice, setTargetPrice] = useState(qTarget || "143.00");
  const [quantity, setQuantity] = useState("16");
  const [setupReason, setSetupReason] = useState("20-day high breakout with 1.5x volume expansion");
  const [invalidationReason, setInvalidationReason] = useState(
    "Daily close breaks below SMA50 or stop price",
  );

  useEffect(() => {
    if (qSymbol) setSymbol(qSymbol);
    if (qEntry) setEntryPrice(qEntry);
    if (qStop) setStopPrice(qStop);
    if (qTarget) setTargetPrice(qTarget);
  }, [qSymbol, qEntry, qStop, qTarget]);

  const [sizingResult, setSizingResult] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const accountEquity = selectedAccount?.initial_equity || 30000;

  useEffect(() => {
    if (strategies.length > 0 && !strategyId) {
      setStrategyId(strategies[0].id);
    }
  }, [strategies, strategyId]);

  // Recalculate sizing preview whenever entry/stop/equity changes
  useEffect(() => {
    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopPrice);
    if (
      !isNaN(entry) &&
      !isNaN(stop) &&
      entry > 0 &&
      stop > 0 &&
      stop < entry &&
      accountEquity > 0
    ) {
      calculateSizing({
        account_equity: accountEquity,
        entry_price: entry,
        stop_price: stop,
      })
        .then((res) => {
          setSizingResult(res);
          if (res.max_allowed_quantity && parseInt(res.max_allowed_quantity, 10) > 0) {
            // Auto fill quantity if empty or 0
            setQuantity((prev) => (!prev || prev === "0" ? res.max_allowed_quantity : prev));
          }
        })
        .catch(() => setSizingResult(null));
    } else {
      setSizingResult(null);
    }
  }, [entryPrice, stopPrice, accountEquity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) return;
    setSubmitting(true);
    setError(null);

    try {
      const entry = parseFloat(entryPrice);
      const stop = parseFloat(stopPrice);
      const target = parseFloat(targetPrice);
      const qty = parseInt(quantity, 10);

      if (stop >= entry) {
        throw new Error(
          c("Stop price must be strictly lower than entry price.", "止损价必须严格低于入场价。"),
        );
      }

      // 1. Create draft plan
      const plan = await createTradePlan({
        account_id: selectedAccountId,
        symbol: symbol.toUpperCase(),
        side: "long",
        planned_entry: entry,
        planned_stop: stop,
        planned_target: target,
        planned_quantity: qty,
        setup_reason: setupReason,
        invalidation_reason: invalidationReason,
        strategy_version_id: strategyId || null,
      });

      // 2. Submit for server-side risk assessment
      const approval = await approveTradePlan(plan.id, "risk_on");
      onPlanCreated(approval.assessment);
    } catch (err: any) {
      setError(
        err?.message || c("Failed to create and assess trade plan.", "创建并审批计划失败。"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          {c("Trade Plan Builder", "创建交易计划")}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Symbol & Strategy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {c("Stock Symbol", "股票代码")}
            </label>
            <Input
              type="text"
              required
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="h-10 rounded-xl font-mono font-bold"
              placeholder="AAPL, NVDA, TSLA..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {c("Strategy Version", "绑定策略版本")}
            </label>
            <Select value={strategyId} onValueChange={(val) => setStrategyId(val)}>
              <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                <SelectValue placeholder={c("Select strategy", "选择策略")} />
              </SelectTrigger>
              <SelectContent>
                {strategies.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs font-medium">
                    {s.display_name} (v{s.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Price Brackets */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {c("Entry Price ($)", "计划入场价 ($)")}
            </label>
            <Input
              type="number"
              step="0.01"
              required
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="h-10 rounded-xl font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-negative mb-1.5">
              {c("Stop Loss ($)", "止损价格 ($)")}
            </label>
            <Input
              type="number"
              step="0.01"
              required
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              className="h-10 rounded-xl font-mono text-xs border-negative/40 focus-visible:ring-negative/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-positive mb-1.5">
              {c("Profit Target ($)", "目标止盈价 ($)")}
            </label>
            <Input
              type="number"
              step="0.01"
              required
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="h-10 rounded-xl font-mono text-xs border-positive/40 focus-visible:ring-positive/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {c("Quantity (Shares)", "计划股数")}
            </label>
            <Input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-10 rounded-xl font-mono font-bold text-xs"
            />
          </div>
        </div>

        {/* Live Risk Sizing Preview Panel */}
        {sizingResult && (
          <div className="rounded-2xl border border-foreground/10 bg-muted/30 p-3.5 text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5 mb-2.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {c("Risk Sizing Calibration", "风控头寸校准")}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono">
              <div className="rounded-xl bg-background/80 p-2.5 border border-foreground/5">
                <p className="text-[0.6875rem] text-muted-foreground">
                  {c("Risk / Share", "每股风险")}
                </p>
                <p className="figure mt-1 font-semibold text-foreground">
                  ${parseFloat(sizingResult.risk_per_share).toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-background/80 p-2.5 border border-foreground/5">
                <p className="text-[0.6875rem] text-muted-foreground">
                  {c("Risk Budget", "单笔风险预算")}
                </p>
                <p className="figure mt-1 font-semibold text-positive">
                  ${parseFloat(sizingResult.risk_budget).toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-background/80 p-2.5 border border-foreground/5">
                <p className="text-[0.6875rem] text-muted-foreground">
                  {c("Max Allowed Qty", "最大允许股数")}
                </p>
                <p className="figure mt-1 font-semibold text-foreground">
                  {sizingResult.max_allowed_quantity}
                </p>
              </div>
              <div className="rounded-xl bg-background/80 p-2.5 border border-foreground/5">
                <p className="text-[0.6875rem] text-muted-foreground">
                  {c("Planned Notional", "计划本金敞口")}
                </p>
                <p className="figure mt-1 font-semibold text-foreground">
                  ${(parseFloat(entryPrice) * (parseInt(quantity) || 0)).toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-background/80 p-2.5 border border-foreground/5">
                <p className="text-[0.6875rem] text-muted-foreground">
                  {c("Estimated Risk", "计划止损损失")}
                </p>
                <p
                  className={cn(
                    "figure mt-1 font-semibold",
                    parseFloat(sizingResult.risk_per_share) * (parseInt(quantity) || 0) >
                      parseFloat(sizingResult.risk_budget)
                      ? "text-negative"
                      : "text-foreground",
                  )}
                >
                  $
                  {(parseFloat(sizingResult.risk_per_share) * (parseInt(quantity) || 0)).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Row 3: Setup Reason & Invalidation Reason */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {c("Setup Reason (Why enter now?)", "入场理由（为什么现在买？）")}
            </label>
            <textarea
              required
              rows={2}
              value={setupReason}
              onChange={(e) => setSetupReason(e.target.value)}
              className="w-full rounded-2xl border border-input bg-background/50 px-3.5 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Breakout of 20-day resistance on heavy volume..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {c(
                "Invalidation Thesis (When is this trade wrong?)",
                "交易失败条件（什么情况说明判断错误？）",
              )}
            </label>
            <textarea
              required
              rows={2}
              value={invalidationReason}
              onChange={(e) => setInvalidationReason(e.target.value)}
              className="w-full rounded-2xl border border-input bg-background/50 px-3.5 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Failure to hold support on closing basis..."
            />
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={submitting || !selectedAccountId}
            size="sm"
            className="rounded-full px-5 text-xs font-semibold"
          >
            {submitting ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {c("Assessing Risk Constraints...", "正在风控评估...")}
              </>
            ) : (
              <>
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                {c("Submit Plan for Approval", "提交计划并审批风控")}
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
