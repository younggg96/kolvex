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
import {
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  RefreshCw,
  Calculator,
  ArrowRight,
} from "lucide-react";

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
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4 text-emerald-500" />
            {c("Trade Plan Builder", "创建交易计划")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c(
              "Standardize entry, exit, invalidation thesis, and calibrate risk before placing broker orders.",
              "在向券商下单前，标准化入场理由、止损止盈与失效假设，并经服务端风控引擎审批。",
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="pt-4 space-y-4">
        {/* Row 1: Symbol & Strategy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {c("Stock Symbol", "股票代码")}
            </label>
            <input
              type="text"
              required
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="AAPL, NVDA, TSLA..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {c("Strategy Version", "绑定策略版本")}
            </label>
            <select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name} (v{s.version})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Price Brackets */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {c("Entry Price ($)", "计划入场价 ($)")}
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 text-red-500">
              {c("Stop Loss ($)", "止损价格 ($)")}
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 text-emerald-600 dark:text-emerald-400">
              {c("Profit Target ($)", "目标止盈价 ($)")}
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {c("Quantity (Shares)", "计划股数")}
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Live Risk Sizing Preview Panel */}
        {sizingResult && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5 mb-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              {c("Risk Sizing Calibration", "风控头寸校准")}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono">
              <div className="rounded bg-background p-2 border border-border">
                <p className="text-[0.625rem] text-muted-foreground">
                  {c("Risk / Share", "每股风险")}
                </p>
                <p className="font-bold text-foreground">
                  ${parseFloat(sizingResult.risk_per_share).toFixed(2)}
                </p>
              </div>
              <div className="rounded bg-background p-2 border border-border">
                <p className="text-[0.625rem] text-muted-foreground">
                  {c("Max Risk Budget", "单笔风险预算")}
                </p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                  ${parseFloat(sizingResult.risk_budget).toFixed(2)}
                </p>
              </div>
              <div className="rounded bg-background p-2 border border-border">
                <p className="text-[0.625rem] text-muted-foreground">
                  {c("Max Allowed Qty", "最大允许股数")}
                </p>
                <p className="font-bold text-foreground">{sizingResult.max_allowed_quantity}</p>
              </div>
              <div className="rounded bg-background p-2 border border-border">
                <p className="text-[0.625rem] text-muted-foreground">
                  {c("Planned Notional", "计划本金敞口")}
                </p>
                <p className="font-bold text-foreground">
                  ${(parseFloat(entryPrice) * (parseInt(quantity) || 0)).toFixed(2)}
                </p>
              </div>
              <div className="rounded bg-background p-2 border border-border">
                <p className="text-[0.625rem] text-muted-foreground">
                  {c("Estimated Risk", "计划止损损失")}
                </p>
                <p
                  className={`font-bold ${
                    parseFloat(sizingResult.risk_per_share) * (parseInt(quantity) || 0) >
                    parseFloat(sizingResult.risk_budget)
                      ? "text-red-500"
                      : "text-foreground"
                  }`}
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
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {c("Setup Reason (Why enter now?)", "入场理由（为什么现在买？）")}
            </label>
            <textarea
              required
              rows={2}
              value={setupReason}
              onChange={(e) => setSetupReason(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Breakout of 20-day resistance on heavy volume following positive earnings guidance..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
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
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Failure to hold $123.50 support on closing basis or sector rotation out of semis..."
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting || !selectedAccountId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                {c("Assessing Risk Constraints...", "正在风控评估...")}
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                {c("Submit Plan for Risk Approval", "提交计划并审批风控")}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
