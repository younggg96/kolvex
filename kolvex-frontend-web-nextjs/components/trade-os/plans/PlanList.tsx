"use client";

import { useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { TradePlan, approveTradePlan, cancelTradePlan, RiskAssessment } from "@/lib/tradeOsApi";
import {
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  X,
} from "lucide-react";

interface PlanListProps {
  plans: TradePlan[];
  loading: boolean;
  onPlanUpdated: (assessment?: RiskAssessment) => void;
}

export function PlanList({ plans, loading, onPlanUpdated }: PlanListProps) {
  const c = useCopy();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filteredPlans = activeTab === "all" ? plans : plans.filter((p) => p.status === activeTab);

  const handleApprove = async (planId: string) => {
    setActionLoading(planId);
    try {
      const res = await approveTradePlan(planId);
      onPlanUpdated(res.assessment);
    } catch (err: any) {
      alert(err?.message || "Failed to assess plan");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (planId: string) => {
    if (!confirm(c("Are you sure you want to cancel this plan?", "确认取消该交易计划？"))) return;
    setActionLoading(planId);
    try {
      await cancelTradePlan(planId);
      onPlanUpdated();
    } catch (err: any) {
      alert(err?.message || "Failed to cancel plan");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.625rem] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            {c("Approved", "已批准")}
          </span>
        );
      case "blocked":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[0.625rem] font-medium text-red-500">
            <XCircle className="h-3 w-3" />
            {c("Blocked", "风控拒绝")}
          </span>
        );
      case "review_required":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.625rem] font-medium text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            {c("Needs Review", "待复核")}
          </span>
        );
      case "executed":
      case "open":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[0.625rem] font-medium text-blue-500">
            <Clock className="h-3 w-3" />
            {c("Executed", "已成交")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            {c("Managed Trade Plans", "已记录交易计划")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c(
              "Every trade plan permanently preserves rule version, input snapshot, and risk decision.",
              "每笔交易计划永久保留规则版本、输入快照与风控审批记录。",
            )}
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex items-center space-x-1 overflow-x-auto">
          {["all", "approved", "blocked", "draft", "executed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab === "all" ? c("All", "全部") : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Plans Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <p className="text-xs text-muted-foreground py-8 text-center">
            {c("Loading trade plans...", "正在加载交易计划...")}
          </p>
        ) : filteredPlans.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {c("No trade plans found matching this filter.", "未找到符合条件的交易计划。")}
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-medium">
                <th className="pb-2">{c("Symbol", "标的")}</th>
                <th className="pb-2">{c("Status", "状态")}</th>
                <th className="pb-2">{c("Entry / Stop / Target", "入场 / 止损 / 目标")}</th>
                <th className="pb-2">{c("Qty", "股数")}</th>
                <th className="pb-2">{c("Planned Risk", "计划风险")}</th>
                <th className="pb-2">{c("R:R Ratio", "盈亏比")}</th>
                <th className="pb-2">{c("Created", "创建时间")}</th>
                <th className="pb-2 text-right">{c("Actions", "操作")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {filteredPlans.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 font-bold text-foreground text-sm">{p.symbol}</td>
                  <td className="py-3 font-sans">{getStatusBadge(p.status)}</td>
                  <td className="py-3 text-foreground">
                    ${Number(p.planned_entry).toFixed(2)} /{" "}
                    <span className="text-red-500">${Number(p.planned_stop).toFixed(2)}</span> /{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ${Number(p.planned_target).toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 font-semibold text-foreground">{p.planned_quantity} shs</td>
                  <td className="py-3 text-red-500 font-semibold">
                    ${Number(p.planned_risk_amount).toFixed(2)}
                  </td>
                  <td className="py-3 text-foreground font-semibold">
                    {p.reward_risk_ratio != null
                      ? `${Number(p.reward_risk_ratio).toFixed(1)}R`
                      : "—"}
                  </td>
                  <td className="py-3 text-muted-foreground font-sans">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right font-sans">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.status === "draft" && (
                        <button
                          onClick={() => handleApprove(p.id)}
                          disabled={actionLoading === p.id}
                          className="rounded bg-emerald-600 px-2 py-1 text-[0.6875rem] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {actionLoading === p.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            c("Approve", "审批")
                          )}
                        </button>
                      )}
                      {(p.status === "draft" || p.status === "approved") && (
                        <button
                          onClick={() => handleCancel(p.id)}
                          disabled={actionLoading === p.id}
                          className="rounded border border-border p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={c("Cancel Plan", "取消计划")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
