"use client";

import { useCopy } from "@/components/decision/shared";
import { RiskAssessment } from "@/lib/tradeOsApi";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, X } from "lucide-react";

interface ApprovalModalProps {
  assessment: RiskAssessment | null;
  onClose: () => void;
}

export function ApprovalModal({ assessment, onClose }: ApprovalModalProps) {
  const c = useCopy();
  if (!assessment) return null;

  const isApproved = assessment.decision === "approved";
  const isBlocked = assessment.decision === "blocked";
  const isReview = assessment.decision === "needs_review";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-foreground/10 bg-card-glass glass-card p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full p-2.5 ${
                isApproved
                  ? "bg-emerald-500/10 text-positive"
                  : isBlocked
                    ? "bg-negative/10 text-negative"
                    : "bg-amber-500/10 text-amber-500"
              }`}
            >
              {isApproved && <CheckCircle2 className="h-6 w-6" />}
              {isBlocked && <XCircle className="h-6 w-6" />}
              {isReview && <AlertTriangle className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {isApproved && c("Trade Plan APPROVED", "交易计划已批准")}
                {isBlocked && c("Trade Plan BLOCKED by Risk Engine", "风控引擎已拒绝该交易计划")}
                {isReview && c("Review Required Before Execution", "交易计划需要人工复核")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c("Risk Rule Version: ", "风控规则版本：")}
                <span className="font-mono">{assessment.rule_version}</span>
                {" · "}
                {c("Audit Hash: ", "审计指纹：")}
                <span className="font-mono">{assessment.input_hash.slice(0, 10)}...</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content: Checks Breakdown */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Calculated Limits Card */}
          {(() => {
            const limits = assessment.calculated_limits || {
              max_allowed_quantity: 0,
              planned_quantity: 0,
              allowed_risk_budget: "0",
              planned_risk_amount: "0",
            };
            const isQtyOver = limits.planned_quantity > limits.max_allowed_quantity;
            const isRiskOver =
              parseFloat(limits.planned_risk_amount || "0") >
              parseFloat(limits.allowed_risk_budget || "0");

            return (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5 mb-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  {c("Limits & Sizing Resolution", "限额与仓位解析")}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                  <div className="rounded bg-background p-2 border border-border">
                    <p className="text-[0.625rem] text-muted-foreground">
                      {c("Allowed Qty", "允许股数")}
                    </p>
                    <p className="font-bold text-foreground">
                      {limits.max_allowed_quantity ?? 0} shs
                    </p>
                  </div>
                  <div className="rounded bg-background p-2 border border-border">
                    <p className="text-[0.625rem] text-muted-foreground">
                      {c("Planned Qty", "提交股数")}
                    </p>
                    <p className={`font-bold ${isQtyOver ? "text-red-500" : "text-foreground"}`}>
                      {limits.planned_quantity ?? 0} shs
                    </p>
                  </div>
                  <div className="rounded bg-background p-2 border border-border">
                    <p className="text-[0.625rem] text-muted-foreground">
                      {c("Risk Budget", "风险预算")}
                    </p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">
                      ${parseFloat(limits.allowed_risk_budget || "0").toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded bg-background p-2 border border-border">
                    <p className="text-[0.625rem] text-muted-foreground">
                      {c("Planned Risk", "计划风险")}
                    </p>
                    <p className={`font-bold ${isRiskOver ? "text-red-500" : "text-foreground"}`}>
                      ${parseFloat(limits.planned_risk_amount || "0").toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Rule Checks Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground">
              {c("Risk Constraints Evaluated", "风控规则校验详情")}
            </h4>
            <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
              {assessment.checks.map((chk, i) => (
                <div key={i} className="p-3 text-xs flex items-start gap-3">
                  {chk.passed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground capitalize">
                        {chk.rule.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono text-[0.6875rem] text-muted-foreground">
                        {chk.current_value} / {chk.threshold}
                      </span>
                    </div>
                    <p
                      className={`text-[0.6875rem] ${
                        chk.passed ? "text-muted-foreground" : "text-red-500 font-medium"
                      }`}
                    >
                      {chk.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border/50 flex justify-end gap-2">
          <Button size="sm" onClick={onClose} className="rounded-full px-5 text-xs font-semibold">
            {c("Close & Continue", "关闭并返回")}
          </Button>
        </div>
      </div>
    </div>
  );
}
