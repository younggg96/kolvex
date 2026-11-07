"use client";

import { DataTableSkeleton } from "@/components/decision/StockTabSkeletons";
import { useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  freeResearchKey,
  type RevenueOutlook,
  type SecFilings,
} from "@/lib/freeResearch";
import { cn } from "@/lib/utils";
import { SecLink, SecState, SourceNote, useFreeResearch } from "./SecData";
import { useFinancialFormat } from "./StockFinancialData";
import { useCopy } from "./shared";

const headCell = "px-4 py-4 font-medium";
const bodyCell = "figure px-4 py-4 text-right";

/** Revenue consensus and SEC filing links, shown below the EPS history. */
export default function StockEarningsMaterials({ symbol }: { symbol: string }) {
  return (
    <div className="space-y-8">
      <RevenueEstimates symbol={symbol} />
      <EarningsFilings symbol={symbol} />
    </div>
  );
}

function RevenueEstimates({ symbol }: { symbol: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const resource = useFreeResearch<RevenueOutlook>(
    freeResearchKey(symbol, "revenue-outlook"),
  );
  const rows = resource.data?.estimates ?? [];
  const periodLabel = (period: string) =>
    ({
      "0q": c("Current quarter", "本季度"),
      "+1q": c("Next quarter", "下季度"),
      "0y": c("Current fiscal year", "本财年"),
      "+1y": c("Next fiscal year", "下财年"),
    })[period] ?? period;
  return (
    <section aria-labelledby="revenue-estimates-title" className="space-y-4">
      <h2 id="revenue-estimates-title" className="text-xl font-semibold">
        {c("Revenue estimates", "营收预期")}
      </h2>
      <SecState
        skeleton={<DataTableSkeleton columns={7} rows={4} />}
        loading={resource.loading}
        error={resource.error}
        empty={!resource.loading && !rows.length}
        retry={resource.refresh}
        emptyText={c(
          "The free source has no revenue estimates for this stock.",
          "免费数据源暂无这只股票的营收预期。",
        )}
        errorText={c(
          "Revenue estimates could not be loaded. Try again.",
          "营收预期加载失败，请重试。",
        )}
      />
      {!!rows.length && (
        <div
          role="region"
          tabIndex={0}
          aria-label={c(
            "Revenue estimates, horizontally scrollable",
            "营收预期表，可横向滚动",
          )}
          className="glass-card bg-card-glass overflow-auto rounded-3xl border border-foreground/10 focus-visible:outline-none"
        >
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                {[
                  c("Period", "周期"),
                  c("Average", "平均预期"),
                  c("Low", "最低"),
                  c("High", "最高"),
                  c("Year-ago revenue", "去年同期"),
                  c("Implied growth", "隐含增长"),
                  c("Analysts", "分析师数"),
                ].map((label, index) => (
                  <th
                    key={label}
                    scope="col"
                    className={cn(headCell, index ? "text-right" : "text-left")}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.period} className="border-t border-border">
                  <th scope="row" className="px-4 py-4 text-left font-medium">
                    {periodLabel(row.period)}
                  </th>
                  <td className={bodyCell}>{f.number(row.average)}</td>
                  <td className={bodyCell}>{f.number(row.low)}</td>
                  <td className={bodyCell}>{f.number(row.high)}</td>
                  <td className={bodyCell}>{f.number(row.year_ago)}</td>
                  <td className={bodyCell}>{f.percent(row.growth)}</td>
                  <td className={bodyCell}>{f.number(row.analysts, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SourceNote>
        {c(
          `Source: ${resource.data?.source ?? "Yahoo Finance"}${resource.data?.currency ? ` · ${resource.data.currency}` : ""}. Current consensus only: the free source keeps no past revenue estimates, so revenue beat/miss by quarter is not available and is not inferred.`,
          `来源：${resource.data?.source ?? "Yahoo Finance"}${resource.data?.currency ? ` · ${resource.data.currency}` : ""}。仅为当前一致预期：免费数据源不保留历史营收预期，所以暂无各季度营收 Beat/Miss，也不做推算。`,
        )}
      </SourceNote>
    </section>
  );
}

function EarningsFilings({ symbol }: { symbol: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const [scope, setScope] = useState<"earnings" | "all">("earnings");
  const resource = useFreeResearch<SecFilings>(
    freeResearchKey(symbol, "filings"),
  );
  const filings = resource.data?.filings ?? [];
  const rows = scope === "earnings" ? filings.filter((row) => row.earnings) : filings;
  const describe = (form: string, items: string[] = []) => {
    if (form.startsWith("10-K") || form.startsWith("20-F"))
      return c("Annual report", "年度报告");
    if (form.startsWith("10-Q")) return c("Quarterly report", "季度报告");
    if (items.includes("2.02"))
      return c(
        "Earnings release (Item 2.02); see exhibits",
        "财报发布（Item 2.02），新闻稿见附件",
      );
    return c("Current report", "临时报告");
  };
  return (
    <section aria-labelledby="earnings-filings-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="earnings-filings-title" className="text-xl font-semibold">
          {c("Earnings filings", "财报原文")}
        </h2>
        <SegmentedControl
          label={c("Filing scope", "申报范围")}
          value={scope}
          onChange={setScope}
          options={[
            { value: "earnings", label: c("Earnings", "财报相关") },
            { value: "all", label: c("All recent", "全部近期") },
          ]}
        />
      </div>
      <SecState
        skeleton={<DataTableSkeleton columns={5} rows={8} />}
        loading={resource.loading}
        error={resource.error}
        empty={!resource.loading && !rows.length}
        retry={resource.refresh}
        emptyText={c(
          "SEC has no matching filings for this security.",
          "SEC 暂无这只证券的相关申报。",
        )}
        errorText={c(
          "SEC filings could not be loaded. Try again.",
          "SEC 申报加载失败，请重试。",
        )}
      />
      {!!rows.length && (
        <div
          role="region"
          tabIndex={0}
          aria-label={c("SEC filings, horizontally scrollable", "SEC 申报表，可横向滚动")}
          className="glass-card bg-card-glass overflow-auto rounded-3xl border border-foreground/10 focus-visible:outline-none"
        >
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className={cn(headCell, "text-left")}>{c("Filed", "申报日")}</th>
                <th scope="col" className={cn(headCell, "text-left")}>{c("Form", "表格")}</th>
                <th scope="col" className={cn(headCell, "text-left")}>{c("Type", "类型")}</th>
                <th scope="col" className={cn(headCell, "text-right")}>{c("Period", "报告期")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.accession} className="border-t border-border">
                  <td className="figure px-4 py-4">{f.date(row.filed)}</td>
                  <td className="px-4 py-4 font-medium">
                    <SecLink href={row.source_url}>{row.form}</SecLink>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{describe(row.form, row.items)}</td>
                  <td className={bodyCell}>{row.period ? f.date(row.period) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SourceNote>
        {c(
          "Source: SEC EDGAR. Links open the filing index with its exhibits. Call transcripts and slide decks have no reliable free source, so they are not listed here.",
          "来源：SEC EDGAR。链接打开申报索引页，可查看全部附件。电话会文字稿和演示文稿没有可靠的免费来源，这里不提供。",
        )}
      </SourceNote>
    </section>
  );
}
