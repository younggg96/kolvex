"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceNote } from "@/components/decision/SecData";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { useCopy } from "@/components/decision/shared";
import { useCachedResource } from "@/hooks/useCachedResource";
import {
  INSTITUTIONS_KEY,
  institutionSummaryKey,
  reportingQuarter,
  type InstitutionManager,
  type InstitutionSummary,
} from "@/lib/freeResearch";
import { loadFundamentals } from "@/lib/stockFundamentals";
import { cn } from "@/lib/utils";
import { activityTone, useActivityLabel } from "./InstitutionHoldings";

type Entry = { manager: InstitutionManager; summary: InstitutionSummary | null };
type Sort = "latest" | "size";

export const superinvestorHref = (id: string) => `/dashboard/superinvestors/${encodeURIComponent(id)}`;

/**
 * Every summary is a separate request, so one slow SEC read can fail alone
 * without hiding the rest of the directory.
 */
async function loadDirectory(signal: AbortSignal): Promise<Entry[]> {
  const { managers } = await loadFundamentals<{ managers: InstitutionManager[] }>(INSTITUTIONS_KEY, signal);
  const results = await Promise.allSettled(
    managers.map((manager) => loadFundamentals<InstitutionSummary>(institutionSummaryKey(manager.id), signal)),
  );
  return managers.map((manager, index) => {
    const result = results[index];
    return { manager, summary: result.status === "fulfilled" ? result.value : null };
  });
}

const filed = (entry: Entry) => entry.summary?.filing?.filed ?? "";

export default function SuperinvestorsDirectory() {
  const c = useCopy();
  const [sort, setSort] = useState<Sort>("latest");
  const { data, loading, refreshing, error, refresh } = useCachedResource(
    "superinvestors:directory",
    loadDirectory,
    { ttl: 600_000, timeout: 90_000 },
  );
  const entries = data ?? [];
  const loaded = entries.filter((entry) => entry.summary?.filing);
  const failed = entries.filter((entry) => !entry.summary);
  const lead = [...loaded].sort((a, b) => b.summary!.value - a.summary!.value)[0];

  const groups = (() => {
    if (sort === "size")
      return [{ key: "all", label: null as string | null, items: [...loaded].sort((a, b) => b.summary!.value - a.summary!.value) }];
    const byQuarter = new Map<string, Entry[]>();
    for (const entry of [...loaded].sort((a, b) => filed(b).localeCompare(filed(a)))) {
      const q = reportingQuarter(entry.summary!.filing!.period);
      const key = q ? `${q.year}-${q.quarter}` : "other";
      byQuarter.set(key, [...(byQuarter.get(key) ?? []), entry]);
    }
    return [...byQuarter.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => {
        const [year, quarter] = key.split("-");
        return {
          key,
          label: key === "other" ? c("Other periods", "其他期间") : c(`Q${quarter} ${year}`, `${year} 年第 ${quarter} 季度`),
          items,
        };
      });
  })();

  return (
    <div className="space-y-8 md:space-y-10">
      {loading && !data ? (
        <DirectorySkeleton />
      ) : error && !data ? (
        <Card role="alert" className="px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {c("Investor filings could not be loaded. Try again.", "投资者申报加载失败，请重试。")}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
            {c("Retry", "重试")}
          </Button>
        </Card>
      ) : (
        <>
          {lead && <LeadCard entry={lead} />}

          <section aria-labelledby="superinvestors-list-title" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="superinvestors-list-title" className="text-lg font-semibold md:text-xl">
                {c(`${entries.length} investors`, `${entries.length} 位投资者`)}
              </h2>
              <SegmentedControl
                size="sm"
                label={c("Sort investors", "投资者排序")}
                value={sort}
                onChange={setSort}
                options={[
                  { value: "latest", label: c("Latest filing", "最新申报") },
                  { value: "size", label: c("Size", "规模") },
                ]}
              />
            </div>

            {groups.map((group) => (
              <div key={group.key} className="space-y-3">
                {group.label && (
                  <h3 className="border-b border-border pb-2 text-sm font-medium text-muted-foreground">
                    {group.label}
                  </h3>
                )}
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((entry) => (
                    <li key={entry.manager.id} className="min-w-0">
                      <InvestorCard entry={entry} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {failed.length > 0 && (
              <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-sm">
                <p className="text-muted-foreground">
                  {c(
                    `Filings for ${failed.map((entry) => entry.manager.name).join(", ")} could not be read from the SEC right now.`,
                    `暂时无法从 SEC 读取 ${failed.map((entry) => entry.manager.name).join("、")} 的申报。`,
                  )}
                </p>
                <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
                  {c("Retry", "重试")}
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      <SourceNote>
        {c(
          "Source: SEC Form 13F-HR, latest original filing per investor. 13F is a quarter-end snapshot filed up to 45 days later. It is not live positions and excludes shorts and most non-US holdings. Investors are a curated list, not every institution.",
          "来源：SEC Form 13F-HR，每位投资者最近一份原始申报。13F 是季度末持仓快照，最晚在季末 45 天后披露，不代表当前持仓，也不含空头和大部分非美股持仓。投资者为精选名单，并非全部机构。",
        )}
      </SourceNote>
    </div>
  );
}

function ChangeCount({ summary, className }: { summary: InstitutionSummary; className?: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  if (!summary.changes)
    return <span className={cn("text-muted-foreground", className)}>{c("Not compared", "未比较季度变化")}</span>;
  const { new: opened, increased, reduced, exited } = summary.changes;
  const total = opened + increased + reduced + exited;
  return (
    <span
      className={cn("text-muted-foreground", className)}
      title={c(
        `${opened} new · ${increased} added · ${reduced} reduced · ${exited} exited`,
        `新建仓 ${opened} · 增持 ${increased} · 减持 ${reduced} · 清仓 ${exited}`,
      )}
    >
      {c(`${f.number(total, false)} changes`, `${f.number(total, false)} 项变动`)}
    </span>
  );
}

function LeadCard({ entry }: { entry: Entry }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const activity = useActivityLabel();
  const summary = entry.summary!;
  return (
    <section aria-labelledby="superinvestor-lead-title">
      <Card className="grid gap-6 p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8 md:p-6">
        <div className="flex min-w-0 flex-col justify-between gap-6">
          <div className="flex min-w-0 items-start gap-3">
            <Monogram name={entry.manager.name} large />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{c("Largest reported value", "申报市值最大")}</p>
              <h2 id="superinvestor-lead-title" className="mt-1 truncate text-xl font-semibold">
                <Link href={superinvestorHref(entry.manager.id)} className="hover:underline focus-visible:outline-none focus-visible:underline">
                  {entry.manager.name}
                </Link>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {c("Filed", "申报于")} {f.date(summary.filing!.filed)}
              </p>
            </div>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="text-xs text-muted-foreground">{c("Reported value", "申报市值")}</dt>
              <dd className="figure mt-1 text-lg font-semibold">${f.number(summary.value)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{c("Positions", "持仓数")}</dt>
              <dd className="figure mt-1 text-lg font-semibold">{f.number(summary.positions, false)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{c("Vs prior quarter", "较上季")}</dt>
              <dd className="mt-1 text-lg font-semibold">
                <ChangeCount summary={summary} className="text-foreground" />
              </dd>
            </div>
          </dl>
        </div>
        <div className="min-w-0 md:border-l md:border-border md:pl-8">
          <h3 className="text-xs font-medium text-muted-foreground">{c("Top holdings", "前五大持仓")}</h3>
          <ol className="mt-2">
            {summary.top.map((row, index) => (
              <li
                key={`${row.cusip}-${row.class}-${row.put_call}`}
                className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2.5 text-sm last:border-0"
              >
                <span className="figure text-xs text-muted-foreground">{index + 1}</span>
                <span className="min-w-0 truncate">
                  <span className="font-medium">{row.issuer}</span>
                  <span className={cn("ml-2 text-xs", activityTone(row.activity))}>{activity(row.activity)}</span>
                </span>
                <span className="figure text-right">{f.percent(row.weight)}</span>
              </li>
            ))}
          </ol>
          <Link
            href={superinvestorHref(entry.manager.id)}
            className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
          >
            {c("All holdings", "查看全部持仓")}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Card>
    </section>
  );
}

function InvestorCard({ entry }: { entry: Entry }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const summary = entry.summary!;
  return (
    <Link
      href={superinvestorHref(entry.manager.id)}
      className="glass-card group flex h-full min-w-0 flex-col gap-4 rounded-3xl border border-foreground/10 bg-card-glass p-4 transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Monogram name={entry.manager.name} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold">{entry.manager.name}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {c("Filed", "申报于")} {f.date(summary.filing!.filed)}
          </p>
        </div>
        <ChevronRight
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </div>
      <p className="min-w-0 truncate text-xs text-muted-foreground" title={summary.top.map((row) => row.issuer).join(" · ")}>
        <span className="text-foreground">{f.number(summary.positions, false)}</span> {c("holdings", "个持仓")}
        {summary.top.length > 0 && <> · {summary.top.slice(0, 3).map((row) => row.issuer).join(" · ")}</>}
      </p>
      <div className="mt-auto flex items-end justify-between gap-3">
        <div>
          <p className="figure text-lg font-semibold">${f.number(summary.value)}</p>
          <p className="text-xs text-muted-foreground">{c("Reported value", "申报市值")}</p>
        </div>
        <ChangeCount summary={summary} className="text-right text-xs" />
      </div>
    </Link>
  );
}

/** Firms have no logo source here, so a neutral monogram keeps the cards scannable. */
function Monogram({ name, large = false }: { name: string; large?: boolean }) {
  const letters = name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] font-semibold text-foreground/80",
        large ? "h-12 w-12 text-base" : "h-10 w-10 text-sm",
      )}
    >
      {letters || "·"}
    </span>
  );
}

function DirectorySkeleton() {
  const c = useCopy();
  return (
    <div role="status" className="space-y-8">
      <span className="sr-only">
        {c("Reading the latest 13F filings from the SEC…", "正在从 SEC 读取最新 13F 申报…")}
      </span>
      <Skeleton className="h-56 w-full rounded-3xl" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-40 rounded-3xl" />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {c(
          "The first load reads each investor's filings from the SEC and can take a little while.",
          "首次加载需要从 SEC 逐一读取申报，可能稍慢。",
        )}
      </p>
    </div>
  );
}
