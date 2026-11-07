"use client";

import { Card } from "@/components/ui/card";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Section title + subtitle with the refresh button on the end side, as on the valuation tabs. */
function HeaderSkeleton() {
  return <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="flex flex-col gap-2"><Skeleton className="h-7 w-40 rounded-lg" /><Skeleton className="h-4 w-64 max-w-full rounded-md" /></div>
    <Skeleton className="h-10 w-24 rounded-full" />
  </div>;
}

function Segments({ count }: { count: number }) {
  return <div className="flex gap-1 rounded-full bg-foreground/[0.04] p-1">{Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-8 w-14 rounded-full" />)}</div>;
}

/** Chart card: title/current value, view + range toggles, plot area, session line and footnote. */
export function ChartCardSkeleton({ plotClass = "h-72 sm:h-80", titled = true, controls = [2, 3] }: { plotClass?: string; titled?: boolean; controls?: number[] }) {
  return <Card className="space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      {titled && <div className="flex flex-col gap-2"><Skeleton className="h-5 w-44 rounded-md" /><Skeleton className="h-4 w-56 rounded-md" /></div>}
      <div className={cn("flex flex-wrap gap-2", !titled && "w-full justify-between")}>{controls.map((n, i) => <Segments key={i} count={n} />)}</div>
    </div>
    <Skeleton className={cn("w-full rounded-2xl", plotClass)} />
    <div className="flex items-center justify-between gap-3 border-t border-border pt-4"><Skeleton className="h-4 w-56 rounded-md" /><div className="flex gap-2"><Skeleton className="h-9 w-20 rounded-full" /><Skeleton className="h-9 w-20 rounded-full" /></div></div>
    <Skeleton className="h-3 w-full rounded-md" />
  </Card>;
}

/** PE / P/S history card. */
export function MultipleChartSkeleton({ label }: { label: string }) {
  return <ContentLoading label={label} className="min-h-0"><ChartCardSkeleton /></ContentLoading>;
}

/** Valuation analysis tab: header, current reference card with range bar, and the history chart. */
export function ValuationAnalysisSkeleton({ label }: { label: string }) {
  return <ContentLoading label={label} className="min-h-0"><div className="space-y-6">
    <HeaderSkeleton />
    <Card className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap justify-between gap-4">
        <div className="flex flex-col gap-2"><Skeleton className="h-5 w-32 rounded-md" /><Skeleton className="h-3 w-44 rounded-md" /></div>
        <div className="flex flex-col items-end gap-2"><Skeleton className="h-7 w-24 rounded-lg" /><Skeleton className="h-3 w-20 rounded-md" /></div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(i => <div key={i} className="flex flex-col gap-2"><Skeleton className="h-3 w-16 rounded-md" /><Skeleton className="h-6 w-20 rounded-md" /></div>)}</div>
        <Skeleton className="h-1 w-full rounded-full" />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2"><Skeleton className="h-4 w-40 rounded-md" /><Skeleton className="h-4 w-44 rounded-md" /></div>
      <Skeleton className="h-3 w-3/4 rounded-md" />
    </Card>
    <ChartCardSkeleton titled={false} plotClass="h-80 sm:h-96" />
  </div></ContentLoading>;
}

/** Company valuation calculator: header, AI card, method toggle, then the results card. */
export function CalculatorSkeleton({ label }: { label: string }) {
  return <ContentLoading label={label} className="min-h-0"><div className="space-y-6">
    <HeaderSkeleton />
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-2"><Skeleton className="h-5 w-28 rounded-md" /><Skeleton className="h-4 w-full rounded-md" /><Skeleton className="h-4 w-2/3 rounded-md" /></div>
      <div className="flex flex-wrap items-end gap-3"><div className="w-full space-y-1.5 sm:w-72"><Skeleton className="h-3.5 w-12 rounded-md" /><Skeleton className="h-10 w-full rounded-xl" /></div><Skeleton className="h-10 w-36 rounded-full" /></div>
      <Skeleton className="h-4 w-1/2 rounded-md" />
    </Card>
    <Segments count={3} />
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex justify-between gap-3"><Skeleton className="h-5 w-28 rounded-md" /><Skeleton className="h-3 w-16 rounded-md" /></div>
      <Skeleton className="h-4 w-2/3 rounded-md" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border p-4"><Skeleton className="h-3 w-16 rounded-md" /><Skeleton className="h-7 w-24 rounded-lg" /><Skeleton className="h-3 w-20 rounded-md" /></div>)}</div>
    </Card>
    <Card className="space-y-4 p-4 sm:p-5">
      <Skeleton className="h-5 w-32 rounded-md" />
      <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map(i => <div key={i} className="space-y-1.5"><Skeleton className="h-3.5 w-24 rounded-md" /><Skeleton className="h-10 w-full rounded-xl" /></div>)}</div>
    </Card>
  </div></ContentLoading>;
}
