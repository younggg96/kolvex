"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const card = "min-w-0 rounded-3xl border border-foreground/10 glass-card bg-card-glass";

/** FinancialMetricChart: label, latest value, change line, h-60 chart, footnote. */
export function MetricChartCardSkeleton() {
  return <div className={cn(card, "p-4 sm:p-6")}>
    <div className="flex items-start justify-between gap-3"><Skeleton className="h-4 w-28 rounded-md" /><Skeleton className="h-4 w-4 rounded" /></div>
    <Skeleton className="mt-2 h-7 w-24 rounded-lg" />
    <Skeleton className="mt-2 h-3.5 w-36 rounded-md" />
    <Skeleton className="mt-6 h-60 w-full rounded-2xl" />
    <Skeleton className="mt-3 h-3 w-1/2 rounded-md" />
  </div>;
}

/** Bordered data table with a muted header row; `lead` widens the first (label) column. */
export function DataTableSkeleton({ columns = 5, rows = 8, lead = false }: { columns?: number; rows?: number; lead?: boolean }) {
  const grid = { gridTemplateColumns: `${lead ? "minmax(10rem,1.6fr)" : "minmax(6rem,1fr)"} repeat(${columns - 1}, minmax(5rem,1fr))` };
  return <div className={cn(card, "overflow-hidden")}>
    <div className="grid items-center gap-4 bg-muted px-4 py-4" style={grid}>{Array.from({ length: columns }, (_, i) => <Skeleton key={i} className={cn("h-3.5 rounded-md", i ? "ml-auto w-14" : "w-20")} />)}</div>
    {Array.from({ length: rows }, (_, r) => <div key={r} className="grid items-center gap-4 border-t border-border px-4 py-4" style={grid}>
      {Array.from({ length: columns }, (_, i) => <Skeleton key={i} className={cn("h-4 rounded-md", i ? "ml-auto w-14" : r % 2 ? "w-24" : "w-32")} />)}
    </div>)}
  </div>;
}

/** Section heading + caption, as above the earnings / filings tables. */
export function SectionHeadSkeleton({ caption = true }: { caption?: boolean }) {
  return <div className="flex flex-wrap items-baseline justify-between gap-3"><Skeleton className="h-6 w-40 rounded-md" />{caption && <Skeleton className="h-3 w-32 rounded-md" />}</div>;
}

/** Charts grid followed by the statement table (income / balance / cash flow / SEC financials). */
export function StatementSkeleton({ charts = 2, columns = 6 }: { charts?: 2 | 3; columns?: number }) {
  return <div className="space-y-4">
    <div className={cn("grid gap-4", charts === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>{Array.from({ length: charts }, (_, i) => <MetricChartCardSkeleton key={i} />)}</div>
    <DataTableSkeleton columns={columns} rows={10} lead />
  </div>;
}

/** Earnings: EPS chart section, then the history table. */
export function EarningsSkeleton() {
  return <div className="space-y-8">
    <div><SectionHeadSkeleton /><Skeleton className="mt-6 h-80 w-full rounded-2xl" /></div>
    <div><Skeleton className="mb-4 h-6 w-32 rounded-md" /><DataTableSkeleton columns={5} rows={6} /></div>
  </div>;
}

/** Analyst targets: two cards with a big figure, a 2×2 stat grid and a chart/legend. */
export function AnalystSkeleton() {
  return <div className="grid gap-4 xl:grid-cols-2">{[0, 1].map((i) => <div key={i} className={cn(card, "p-4 sm:p-6")}>
    <div className="flex items-start justify-between gap-4"><div><Skeleton className="h-4 w-28 rounded-md" /><Skeleton className="mt-3 h-9 w-32 rounded-lg sm:h-10" /></div><div className="flex flex-col items-end gap-2"><Skeleton className="h-3 w-16 rounded-md" /><Skeleton className="h-4 w-20 rounded-md" /></div></div>
    <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5">{[0, 1, 2, 3].map((j) => <div key={j}><Skeleton className="h-3 w-16 rounded-md" /><Skeleton className="mt-2 h-5 w-20 rounded-md" /></div>)}</div>
    <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
    <div className="mt-3 flex gap-5">{[0, 1, 2].map((j) => <Skeleton key={j} className="h-3 w-16 rounded-md" />)}</div>
  </div>)}</div>;
}

/** Company profile: four facts, the business summary paragraph and the website link. */
export function ProfileSkeleton() {
  return <div className="space-y-6">
    <div className={cn(card, "grid grid-cols-2 gap-6 p-6 lg:grid-cols-4")}>{[0, 1, 2, 3].map((i) => <div key={i}><Skeleton className="h-3 w-14 rounded-md" /><Skeleton className="mt-2 h-4 w-24 rounded-md" /></div>)}</div>
    <div className="space-y-2.5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className={cn("h-4 rounded-md", i === 4 ? "w-1/2" : "w-full")} />)}</div>
    <Skeleton className="h-4 w-28 rounded-md" />
  </div>;
}

/** Fundamentals overview: AI analysis card, key-indicator card, then the metric group cards. */
export function FundamentalsSkeleton() {
  return <div className="space-y-4">
    <div className={cn(card, "p-4 sm:p-6")}><div className="flex items-center justify-between gap-3"><Skeleton className="h-5 w-36 rounded-md" /><Skeleton className="h-10 w-28 rounded-full" /></div><Skeleton className="mt-3 h-4 w-2/3 rounded-md" /></div>
    <div className={cn(card, "p-4 sm:p-6")}>
      <Skeleton className="h-4 w-24 rounded-md" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="flex items-start gap-3"><Skeleton className="mt-1 h-4 w-4 shrink-0 rounded" /><Skeleton className="h-4 w-3/4 rounded-md" /></div>)}</div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={cn(card, "p-4 sm:p-6")}>
      <Skeleton className="h-4 w-24 rounded-md" /><Skeleton className="mb-3 mt-2 h-3 w-3/4 rounded-md" />
      <div className="divide-y divide-border">{[0, 1, 2, 3, 4].map((j) => <div key={j} className="flex items-baseline justify-between gap-4 py-3"><Skeleton className="h-4 w-28 rounded-md" /><Skeleton className="h-4 w-16 rounded-md" /></div>)}</div>
    </div>)}</div>
  </div>;
}
