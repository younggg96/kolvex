"use client";

import { DataTableSkeleton } from "@/components/decision/StockTabSkeletons";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { freeResearchKey, insiderSummary, type SecInsiders } from "@/lib/freeResearch";
import { cn } from "@/lib/utils";
import {
  FactList,
  SecLink,
  SecState,
  SourceNote,
  useFreeResearch,
} from "./SecData";
import { useFinancialFormat } from "./StockFinancialData";
import { useCopy } from "./shared";

const head = "px-4 py-4 font-medium";
const cell = "figure px-4 py-3 text-right";

export default function StockOwnership({ symbol }: { symbol: string }) {
  const c = useCopy();
  return (
    <div className="space-y-6">
      <Insiders symbol={symbol} />
      <Link
        href="/dashboard/superinvestors"
        className="inline-flex min-h-10 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
      >
        {c("Institutional 13F holdings are now in Superinvestors", "投资机构 13F 持仓已移至「超级投资者」")}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function Insiders({ symbol }: { symbol: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const resource = useFreeResearch<SecInsiders>(
    freeResearchKey(symbol, "insiders"),
  );
  const data = resource.data;
  const rows = data?.transactions ?? [];
  const summary = insiderSummary(rows);
  const total = (side: typeof summary.buys) =>
    side.count
      ? `$${f.number(side.value)}${side.incomplete ? "+" : ""}`
      : c("None", "无");
  const codeLabel = (code: string | null) =>
    (code &&
      {
        P: c("Open-market buy", "公开市场买入"),
        S: c("Open-market sale", "公开市场卖出"),
        A: c("Grant or award", "授予"),
        M: c("Option exercise", "期权行权"),
        F: c("Tax withholding", "代扣税"),
        G: c("Gift", "赠与"),
        D: c("Sold to issuer", "售回公司"),
        C: c("Conversion", "转换"),
        J: c("Other", "其他"),
      }[code]) ||
    code ||
    "—";
  return (
    <section aria-labelledby="insiders-title" className="space-y-6">
      <h2 id="insiders-title" className="sr-only">
        {c("Insider trades", "内部人交易")}
      </h2>
      <SecState
        skeleton={<div className="space-y-6"><div className="grid grid-cols-2 gap-6 border-b border-border pb-6 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i}><Skeleton className="h-3 w-24 rounded-md" /><Skeleton className="mt-2 h-6 w-20 rounded-md" /></div>)}</div><DataTableSkeleton columns={8} rows={8} /></div>}
        loading={resource.loading}
        error={resource.error}
        empty={!resource.loading && !rows.length}
        retry={resource.refresh}
        emptyText={c(
          "No Form 4 transactions in the latest filings. Foreign private issuers generally don't file Form 4.",
          "最近的申报中没有 Form 4 交易。外国私人发行人通常不提交 Form 4。",
        )}
        errorText={c(
          "Insider filings could not be loaded. Try again.",
          "内部人申报加载失败，请重试。",
        )}
      />
      {!!rows.length && (
        <>
          <FactList
            items={[
              [c("Open-market buys", "公开市场买入"), total(summary.buys)],
              [c("Open-market sales", "公开市场卖出"), total(summary.sells)],
              [
                c("Transactions covered", "覆盖交易日期"),
                summary.from && summary.to ? (
                  <span className="text-sm font-medium">
                    {f.date(summary.from)} – {f.date(summary.to)}
                  </span>
                ) : (
                  "—"
                ),
              ],
              [
                c("Filings read", "已读取申报"),
                `${(data?.filings.length ?? 0) - (data?.failed_filings ?? 0)} / ${data?.filings.length ?? 0}`,
              ],
            ]}
          />
          <div
            role="region"
            tabIndex={0}
            aria-label={c(
              "Insider transactions, horizontally scrollable",
              "内部人交易表，可横向滚动",
            )}
            className="glass-card bg-card-glass max-h-[72vh] overflow-auto rounded-3xl border border-foreground/10 focus-visible:outline-none"
          >
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
                <tr>
                  {[
                    c("Trade date", "交易日"),
                    c("Insider", "内部人"),
                    c("Type", "类型"),
                    c("Shares", "股数"),
                    c("Price", "价格"),
                    c("Value", "金额"),
                    c("Held after", "交易后持股"),
                    c("Filed", "申报日"),
                  ].map((label, index) => (
                    <th
                      key={label}
                      scope="col"
                      className={cn(head, index > 2 && index < 7 ? "text-right" : "text-left")}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.source_url}-${index}`}
                    className="border-t border-border"
                  >
                    <td className="figure px-4 py-3">
                      {row.date ? f.date(row.date) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{row.owner}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.position}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3",
                        row.code === "P"
                          ? "font-medium text-positive"
                          : row.code === "S"
                            ? "font-medium text-negative"
                            : "text-muted-foreground",
                      )}
                    >
                      {codeLabel(row.code)}
                      {row.amended && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {c("Amended", "修正")}
                        </span>
                      )}
                    </td>
                    <td className={cell}>{f.number(row.shares, false)}</td>
                    <td className={cell}>
                      {row.price === null ? "—" : `$${f.number(row.price, false)}`}
                    </td>
                    <td className={cell}>
                      {row.value === null || row.value === 0 ? "—" : `$${f.number(row.value)}`}
                    </td>
                    <td className={cell}>{f.number(row.shares_after, false)}</td>
                    <td className="figure px-4 py-3">
                      <SecLink href={row.source_url}>{f.date(row.filed)}</SecLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <SourceNote>
        {c(
          `Source: SEC Form 4 and 4/A. Non-derivative transactions from the latest ${data?.filing_limit ?? 12} filings only, so this is not a complete trading history and 3/6/12-month totals are not shown. Totals count open-market trades (codes P and S); grants, exercises and tax withholding are listed but not counted. Amendments appear as separate rows.`,
          `来源：SEC Form 4 及 4/A。仅含最近 ${data?.filing_limit ?? 12} 份申报中的非衍生品交易，不是完整交易历史，所以不显示 3／6／12 个月汇总。合计只统计公开市场交易（代码 P、S）；授予、行权、代扣税等会列出但不计入。修正申报单独成行。`,
        )}
      </SourceNote>
    </section>
  );
}
