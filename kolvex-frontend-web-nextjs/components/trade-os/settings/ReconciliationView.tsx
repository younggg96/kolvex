"use client";

import { useCopy } from "@/components/decision/shared";
import { TradeGroup, ReconciliationIssue } from "@/lib/tradeOsApi";
import { withSign } from "@/lib/format";
import { Layers, AlertCircle, CheckCircle } from "lucide-react";

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
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {c("Reconciliation Exceptions & Unmatched Rows", "对账异常与未匹配项")} ({issues.length}
            )
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            {c(
              "Transactions where cost basis was missing, short selling occurred, or corporate action details require review.",
              "缺少开仓成本、存在超卖或需要人工复核的公司行动记录。",
            )}
          </p>

          <div className="divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
            {issues.map((issue) => (
              <div key={issue.id} className="p-3 text-xs flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {issue.symbol && (
                      <span className="font-mono font-semibold text-foreground px-1.5 py-0.5 rounded bg-muted">
                        {issue.symbol}
                      </span>
                    )}
                    <span className="font-medium text-amber-600 dark:text-amber-400 capitalize">
                      {issue.issue_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{issue.description}</p>
                </div>
                <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[0.625rem] text-muted-foreground uppercase">
                  {issue.resolution}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Groups Table */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-500" />
              {c("Reconciled Trade Groups (Round Trips)", "归集交易组（往返交易）")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {c(
                "Executions automatically aggregated into logical trades via FIFO matching.",
                "所有买卖成交已通过先进先出 (FIFO) 算法归集为完整的多头往返交易。",
              )}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {c("Total trades: ", "交易总计：")}
            <span className="font-mono font-medium text-foreground">{tradeGroups.length}</span>
          </span>
        </div>

        <div className="pt-4 overflow-x-auto">
          {loading ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              {c("Loading trades...", "正在加载交易记录...")}
            </p>
          ) : tradeGroups.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {c(
                "No trade groups available. Import or record trades above.",
                "暂无交易组。请在上方导入流水或录入交易。",
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">{c("Symbol", "标的")}</th>
                  <th className="pb-2 font-medium">{c("Status", "状态")}</th>
                  <th className="pb-2 font-medium">{c("Quantity", "成交量")}</th>
                  <th className="pb-2 font-medium">{c("Avg Entry", "平均买入价")}</th>
                  <th className="pb-2 font-medium">{c("Realized P&L", "已实现盈亏")}</th>
                  <th className="pb-2 font-medium">{c("Fees", "费用")}</th>
                  <th className="pb-2 font-medium">{c("Entry Date", "开仓日期")}</th>
                  <th className="pb-2 font-medium">{c("Close Date", "平仓日期")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {tradeGroups.map((tg) => {
                  const pnl = Number(tg.realized_pnl);
                  const isPositive = pnl > 0;
                  const isNegative = pnl < 0;
                  const entryDate = new Date(tg.first_entry_at).toLocaleDateString();
                  const closeDate = tg.closed_at
                    ? new Date(tg.closed_at).toLocaleDateString()
                    : "—";

                  return (
                    <tr key={tg.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 font-bold text-foreground">{tg.symbol}</td>
                      <td className="py-2.5 font-sans">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-medium ${
                            tg.status === "closed"
                              ? "bg-muted text-muted-foreground"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {tg.status === "closed"
                            ? c("Closed", "已闭合")
                            : c("Open/Partial", "持仓中")}
                        </span>
                      </td>
                      <td className="py-2.5 text-foreground">
                        {Number(tg.total_buy_quantity).toLocaleString()}{" "}
                        {tg.status !== "closed" && (
                          <span className="text-muted-foreground text-[0.625rem]">
                            ({Number(tg.open_quantity)} open)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-foreground">
                        ${Number(tg.average_entry_price).toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 font-semibold ${
                          isPositive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isNegative
                              ? "text-red-500 dark:text-red-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {withSign(pnl, (m) => `$${m.toFixed(2)}`)}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        ${Number(tg.total_fees).toFixed(2)}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{entryDate}</td>
                      <td className="py-2.5 text-muted-foreground">{closeDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
