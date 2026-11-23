"use client";

import { useCopy } from "@/components/decision/shared";
import { TradeGroup, ReconciliationIssue } from "@/lib/tradeOsApi";
import { Card } from "@/components/ui/card";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import { withSign } from "@/lib/format";
import { Layers, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReconciliationViewProps {
  tradeGroups: TradeGroup[];
  issues: ReconciliationIssue[];
  loading: boolean;
}

export function ReconciliationView({ tradeGroups, issues, loading }: ReconciliationViewProps) {
  const c = useCopy();

  return (
    <div className="space-y-6">
      {/* Issues Section */}
      {issues.length > 0 && (
        <Card className="p-5 sm:p-6 border-amber-500/30 bg-amber-500/5 space-y-3">
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {c("Reconciliation Exceptions & Unmatched Rows", "对账异常与未匹配项")} ({issues.length}
            )
          </h3>

          <div className="divide-y divide-border/40 rounded-2xl border border-foreground/5 bg-background/50 overflow-hidden">
            {issues.map((issue) => (
              <div key={issue.id} className="p-3.5 text-xs flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {issue.symbol && (
                      <span className="font-mono font-semibold text-foreground px-2 py-0.5 rounded-full bg-muted">
                        {issue.symbol}
                      </span>
                    )}
                    <span className="font-semibold text-amber-600 dark:text-amber-400 capitalize">
                      {issue.issue_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{issue.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[0.6875rem] text-muted-foreground uppercase font-medium">
                  {issue.resolution}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Trade Groups Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            {c("Reconciled Trade Groups (Round Trips)", "归集交易组（往返交易）")}
          </h2>
          <span className="text-xs text-muted-foreground">
            {c("Total trades: ", "交易总计：")}
            <span className="figure font-semibold text-foreground">{tradeGroups.length}</span>
          </span>
        </div>

        <ListCard>
          {loading ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              {c("Loading trades...", "正在加载交易记录...")}
            </p>
          ) : tradeGroups.length === 0 ? (
            <ListEmptyState
              title={c("No trade groups available", "暂无交易组")}
              description={c(
                "Upload a broker CSV above to automatically form FIFO trade groups.",
                "在上方上传券商成交流水 CSV，系统将自动归集生成往返交易。",
              )}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground font-medium">
                    <th className="px-3 py-3">{c("Symbol", "标的")}</th>
                    <th className="px-3 py-3">{c("Status", "状态")}</th>
                    <th className="px-3 py-3">{c("Quantity", "成交量")}</th>
                    <th className="px-3 py-3">{c("Avg Entry", "平均买入价")}</th>
                    <th className="px-3 py-3">{c("Realized P&L", "已实现盈亏")}</th>
                    <th className="px-3 py-3">{c("Fees", "费用")}</th>
                    <th className="px-3 py-3">{c("Entry Date", "开仓日期")}</th>
                    <th className="px-3 py-3">{c("Close Date", "平仓日期")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 font-mono">
                  {tradeGroups.map((tg) => {
                    const pnl = Number(tg.realized_pnl);
                    const isPositive = pnl > 0;
                    const isNegative = pnl < 0;
                    const entryDate = new Date(tg.first_entry_at).toLocaleDateString();
                    const closeDate = tg.closed_at
                      ? new Date(tg.closed_at).toLocaleDateString()
                      : "—";

                    return (
                      <tr key={tg.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-3 font-semibold text-foreground tracking-tight">
                          {tg.symbol}
                        </td>
                        <td className="px-3 py-3 font-sans">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
                              tg.status === "closed"
                                ? "bg-muted text-muted-foreground"
                                : "bg-emerald-500/10 text-positive",
                            )}
                          >
                            {tg.status === "closed" ? c("Closed", "已闭合") : c("Open", "持仓中")}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-foreground figure">
                          {Number(tg.total_buy_quantity).toLocaleString()}{" "}
                          {tg.status !== "closed" && (
                            <span className="text-muted-foreground text-[0.625rem] font-sans">
                              ({Number(tg.open_quantity)} open)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-foreground figure">
                          ${Number(tg.average_entry_price).toFixed(2)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3 font-semibold figure",
                            isPositive
                              ? "text-positive"
                              : isNegative
                                ? "text-negative"
                                : "text-muted-foreground",
                          )}
                        >
                          {withSign(pnl, (m) => `$${m.toFixed(2)}`)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground figure">
                          ${Number(tg.total_fees).toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground font-sans text-xs">
                          {entryDate}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground font-sans text-xs">
                          {closeDate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ListCard>
      </section>
    </div>
  );
}
