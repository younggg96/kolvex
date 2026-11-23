"use client";

import { useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { TradePlan, approveTradePlan, cancelTradePlan, RiskAssessment } from "@/lib/tradeOsApi";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const filterOptions = [
    { value: "all", label: c("All", "全部") },
    { value: "approved", label: c("Approved", "已批准") },
    { value: "blocked", label: c("Blocked", "已拦截") },
    { value: "draft", label: c("Draft", "草稿") },
    { value: "executed", label: c("Executed", "已执行") },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          {c("Managed Trade Plans", "已记录交易计划")}
        </h3>

        {/* Filter pills via SegmentedControl */}
        <div className="w-full sm:w-auto">
          <SegmentedControl
            size="sm"
            label={c("Plan Status Filter", "交易计划状态筛选")}
            value={activeTab}
            onChange={(val) => setActiveTab(val)}
            options={filterOptions}
          />
        </div>
      </div>

      <ListCard>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              {c("Loading trade plans...", "正在加载交易计划...")}
            </p>
          ) : filteredPlans.length === 0 ? (
            <ListEmptyState
              title={c("No trade plans found", "未找到交易计划")}
              description={c(
                "Submit a plan using the builder above to run pre-trade risk evaluation.",
                "使用上方的表单提交交易计划，风控引擎将自动执行仓位上限与开仓校验。",
              )}
            />
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground font-medium">
                  <th className="pb-3 px-3">{c("Symbol", "标的")}</th>
                  <th className="pb-3 px-3">{c("Status", "状态")}</th>
                  <th className="pb-3 px-3">{c("Entry / Stop / Target", "入场 / 止损 / 目标")}</th>
                  <th className="pb-3 px-3">{c("Qty", "股数")}</th>
                  <th className="pb-3 px-3">{c("Planned Risk", "计划风险")}</th>
                  <th className="pb-3 px-3">{c("R:R Ratio", "盈亏比")}</th>
                  <th className="pb-3 px-3">{c("Created", "创建时间")}</th>
                  <th className="pb-3 px-3 text-right">{c("Actions", "操作")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {filteredPlans.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3 font-semibold text-foreground text-sm tracking-tight">
                      {p.symbol}
                    </td>
                    <td className="py-3 px-3 font-sans">{getStatusBadge(p.status)}</td>
                    <td className="py-3 px-3 text-foreground figure">
                      ${Number(p.planned_entry).toFixed(2)} /{" "}
                      <span className="text-negative">${Number(p.planned_stop).toFixed(2)}</span> /{" "}
                      <span className="text-positive">${Number(p.planned_target).toFixed(2)}</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-foreground figure">
                      {p.planned_quantity} shs
                    </td>
                    <td className="py-3 px-3 text-negative font-medium figure">
                      ${Number(p.planned_risk_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-foreground font-medium figure">
                      {p.reward_risk_ratio != null
                        ? `${Number(p.reward_risk_ratio).toFixed(1)}R`
                        : "—"}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground font-sans text-xs">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.status === "draft" && (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(p.id)}
                            disabled={actionLoading === p.id}
                            className="h-7 rounded-full px-2.5 text-[0.6875rem] font-medium"
                          >
                            {actionLoading === p.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              c("Approve", "审批")
                            )}
                          </Button>
                        )}
                        {(p.status === "draft" || p.status === "approved") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancel(p.id)}
                            disabled={actionLoading === p.id}
                            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                            title={c("Cancel Plan", "取消计划")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ListCard>
    </section>
  );
}
