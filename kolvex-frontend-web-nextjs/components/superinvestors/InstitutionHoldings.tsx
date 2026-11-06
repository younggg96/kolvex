"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { institutionKey, type HoldingActivity, type Institution } from "@/lib/freeResearch";
import { cn } from "@/lib/utils";
import { FactList, SecLink, SecState, SourceNote, useFreeResearch } from "@/components/decision/SecData";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { useCopy } from "@/components/decision/shared";

const head = "px-4 py-4 font-medium";
const cell = "figure px-4 py-3 text-right";
const PAGE = 50;

export function useActivityLabel() {
  const c = useCopy();
  return (kind: HoldingActivity) =>
    ({
      new: c("New", "新建仓"),
      increased: c("Added", "增持"),
      reduced: c("Reduced", "减持"),
      exited: c("Exited", "清仓"),
      unchanged: c("Unchanged", "不变"),
      unknown: c("Not compared", "未比较"),
    })[kind];
}

export const activityTone = (kind: HoldingActivity) =>
  kind === "new" || kind === "increased"
    ? "text-positive"
    : kind === "reduced" || kind === "exited"
      ? "text-negative"
      : "text-muted-foreground";

/** One manager's latest 13F: filing facts, then a filterable holdings table. */
export default function InstitutionHoldings({ manager }: { manager: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const activity = useActivityLabel();
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const resource = useFreeResearch<Institution>(institutionKey(manager));
  const data = resource.data;
  const holdings = data?.holdings ?? [];
  const held = holdings.filter((row) => row.activity !== "exited");
  const totalValue = held.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const needle = query.trim().toUpperCase();
  const filtered = holdings.filter(
    (row) => !needle || row.issuer.toUpperCase().includes(needle) || row.cusip?.includes(needle),
  );
  const rows = filtered.slice(0, visible);
  return (
    <section aria-labelledby="holdings-title" className="space-y-6">
      <SecState
        loading={resource.loading}
        error={resource.error}
        empty={!resource.loading && !holdings.length}
        retry={resource.refresh}
        emptyText={c("This investor has no 13F holdings available.", "这家机构暂无可用的 13F 持仓。")}
        errorText={c("13F holdings could not be loaded. Try again.", "13F 持仓加载失败，请重试。")}
      />
      {!!holdings.length && data?.filing && (
        <>
          <FactList
            items={[
              [c("Reporting period", "持仓截止日"), f.date(data.filing.period)],
              [
                c("Filed", "申报日"),
                <SecLink key="filing" href={data.filing.source_url}>
                  {f.date(data.filing.filed)}
                </SecLink>,
              ],
              [c("Positions", "持仓数"), f.number(held.length, false)],
              [c("Reported value", "申报市值"), `$${f.number(totalValue)}`],
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="holdings-title" className="text-lg font-semibold">
              {c("Holdings", "持仓明细")}
            </h2>
            <Input
              type="search"
              className="w-full px-4 text-sm sm:w-64"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisible(PAGE);
              }}
              placeholder={c("Filter by company or CUSIP", "按公司或 CUSIP 筛选")}
              aria-label={c("Filter holdings by company", "按公司筛选持仓")}
            />
          </div>
          <div
            role="region"
            tabIndex={0}
            aria-label={c("13F holdings, horizontally scrollable", "13F 持仓表，可横向滚动")}
            className="glass-card bg-card-glass max-h-[72vh] overflow-auto rounded-3xl border border-foreground/10 focus-visible:outline-none"
          >
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
                <tr>
                  {[
                    c("Company", "公司"),
                    c("Value", "市值"),
                    c("Weight", "权重"),
                    c("Shares", "股数"),
                    c("Vs prior quarter", "较上季"),
                    c("Share change", "股数变化"),
                  ].map((label, index) => (
                    <th key={label} scope="col" className={cn(head, index ? "text-right" : "text-left")}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.cusip}-${row.class}-${row.share_type}-${row.put_call}`} className="border-t border-border">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {row.issuer}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {row.class}
                        {row.put_call && ` · ${row.put_call}`}
                      </span>
                    </th>
                    <td className={cell}>${f.number(row.value)}</td>
                    <td className={cell}>{f.percent(row.weight)}</td>
                    <td className={cell}>{f.number(row.shares)}</td>
                    <td className={cn("px-4 py-3 text-right", activityTone(row.activity))}>{activity(row.activity)}</td>
                    <td className={cell}>
                      {row.change === null
                        ? "—"
                        : `${row.change > 0 ? "+" : row.change < 0 ? "−" : ""}${f.number(Math.abs(row.change))}`}
                      {row.change_percent !== null && row.change !== 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">{f.percent(row.change_percent)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                {c("No holdings match this filter.", "没有符合筛选条件的持仓。")}
              </p>
            )}
          </div>
          {filtered.length > visible && (
            <Button variant="outline" onClick={() => setVisible((count) => count + PAGE)}>
              {c("Show more", "显示更多")} ({filtered.length - visible})
            </Button>
          )}
          {data.partial && (
            <p className="text-sm text-muted-foreground" role="status">
              {c(
                "This filing has an amendment or its prior quarter could not be read, so quarter-over-quarter changes are not compared.",
                "这份申报有修正，或上季申报无法读取，所以不比较季度变化。",
              )}
            </p>
          )}
        </>
      )}
      <SourceNote>
        {c(
          "Source: SEC Form 13F-HR. A quarter-end snapshot filed up to 45 days later, not live positions, and it excludes shorts and most non-US holdings. Changes are unadjusted for splits and only compare adjacent quarters. Investors are a curated list.",
          "来源：SEC Form 13F-HR。这是季度末持仓快照，最晚在季末 45 天后才披露，不代表当前持仓，也不含空头和大部分非美股持仓。股数变化未按拆股调整，仅比较相邻两个季度。投资机构为精选名单。",
        )}
      </SourceNote>
    </section>
  );
}
