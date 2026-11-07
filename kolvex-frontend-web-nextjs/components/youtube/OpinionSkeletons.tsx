"use client";

import { ContentLoading, SkeletonRepeat } from "@/components/ui/content-loading";
import { listCompactRowClass, listFeedGroupRowClass, listFeedRowClass, listRowTargetClass } from "@/components/ui/list-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Same grids as the explorer's card rows, so placeholders line up with the rows that replace them. */
const cardRow = cn("grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2", listRowTargetClass);
const cardStockRow = cn("grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_110px_160px] sm:gap-x-4", listRowTargetClass);
const cardNarrowStockRow = cn("grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2", listRowTargetClass);

const nameWidths = ["w-28", "w-20", "w-32", "w-24"];

function Strength({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4 w-16 rounded-md", className)} />;
}

/** Stock directory rows: logo, ticker/company, performance column (wide only) and consensus. */
export function StockDirectorySkeleton({ label, rows = 6, narrow = false }: { label?: string; rows?: number; narrow?: boolean }) {
  return <ContentLoading label={label} className="min-h-0"><ul className="min-w-0">
    <SkeletonRepeat count={rows}>{i => <li className="flex items-center gap-1 pr-2 max-md:pr-0 max-md:[&>*]:!px-0">
      <div className={narrow ? cardNarrowStockRow : cardStockRow}>
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full max-md:h-8 max-md:w-8" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5"><Skeleton className="h-4 w-14 rounded-md" /><Skeleton className={cn("h-3.5 rounded-md", nameWidths[i % 4])} /></div>
        </div>
        {!narrow && <div className="hidden flex-col items-end gap-1.5 sm:flex"><Skeleton className="h-4 w-14 rounded-md" /><Skeleton className="h-3 w-10 rounded-md" /></div>}
        <div className={cn("col-span-2 flex items-center justify-between gap-3", !narrow && "sm:col-span-1 sm:flex-col sm:items-end sm:justify-center sm:gap-1.5")}><Strength /><Skeleton className="h-3 w-24 rounded-md" /></div>
      </div>
    </li>}</SkeletonRepeat>
  </ul></ContentLoading>;
}

/** Creator rows: avatar, channel title/handle, consensus and opinion count. */
export function CreatorRowsSkeleton({ label, rows = 6 }: { label?: string; rows?: number }) {
  return <ContentLoading label={label} className="min-h-0"><ul className="min-w-0">
    <SkeletonRepeat count={rows}>{i => <li className="flex items-center gap-1 pr-2 max-md:pr-0 max-md:[&>*]:!px-0">
      <div className={cardRow}>
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5"><Skeleton className={cn("h-4 rounded-md", nameWidths[i % 4])} /><Skeleton className="h-3.5 w-20 rounded-md" /></div>
        </div>
        <div className="flex flex-col items-end gap-1.5"><Strength /><Skeleton className="h-3 w-14 rounded-md" /></div>
      </div>
    </li>}</SkeletonRepeat>
  </ul></ContentLoading>;
}

/** Compact "recent shifts" rows: small logo, ticker/date range, change badge. */
export function ChangeRowsSkeleton({ label, rows = 5 }: { label?: string; rows?: number }) {
  return <ContentLoading label={label} className="min-h-0"><ul className="min-w-0">
    <SkeletonRepeat count={rows}>{() => <li className={cn(listCompactRowClass, "hover:bg-transparent")}>
      <span className="flex min-w-0 items-center gap-3"><Skeleton className="h-8 w-8 shrink-0 rounded-full" /><span className="flex flex-col gap-1.5"><Skeleton className="h-4 w-12 rounded-md" /><Skeleton className="h-3 w-24 rounded-md" /></span></span>
      <Skeleton className="h-4 w-14 rounded-md" />
    </li>}</SkeletonRepeat>
  </ul></ContentLoading>;
}

/** A video group: optional creator line, thumbnail + title/meta, then stock opinion rows. */
function VideoGroupSkeleton({ showCreator, index, compact = false }: { showCreator: boolean; index: number; compact?: boolean }) {
  return <div className="min-w-0">
    {showCreator && <div className="mb-3 flex items-center gap-2"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-3.5 w-24 rounded-md" /></div>}
    <div className="flex min-w-0 items-start gap-4 sm:gap-5">
      {!compact && <Skeleton className="aspect-video w-[7.5rem] shrink-0 rounded-3xl sm:w-[10.5rem]" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:pt-0.5">
        <Skeleton className="h-5 w-full rounded-md" />
        <Skeleton className={cn("h-5 rounded-md", index % 2 ? "w-1/2" : "w-2/3")} />
        <Skeleton className="mt-1 h-3.5 w-32 rounded-md" />
      </div>
    </div>
    <div className="mt-5">
      <SkeletonRepeat count={compact ? 2 : 3}>{j => <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-t border-border py-3 first:border-t-0", compact ? "px-3" : "sm:grid-cols-[7rem_7.5rem_minmax(0,1fr)_auto]")}>
        <span className="flex items-center gap-2.5"><Skeleton className="h-7 w-7 shrink-0 rounded-full" /><Skeleton className="h-4 w-12 rounded-md" /></span>
        {!compact && <Strength className="hidden sm:block" />}
        <Skeleton className={cn("col-span-2 row-start-2 h-4 rounded-md", !compact && "sm:col-span-1 sm:col-start-3 sm:row-start-1", j % 2 ? "w-3/4" : "w-full")} />
        <Skeleton className={cn("col-start-2 row-start-1 h-3 w-8 justify-self-end rounded-md", !compact && "sm:col-start-4")} />
      </div>}</SkeletonRepeat>
    </div>
  </div>;
}

export function VideoGroupsSkeleton({ label, rows = 3, showCreator = false, compact = false }: { label?: string; rows?: number; showCreator?: boolean; compact?: boolean }) {
  return <ContentLoading label={label} className="min-h-0"><ul className="min-w-0">
    <SkeletonRepeat count={rows}>{i => <li className={cn(listFeedGroupRowClass, "py-4 first:pt-1")}><VideoGroupSkeleton showCreator={showCreator} index={i} compact={compact} /></li>}</SkeletonRepeat>
  </ul></ContentLoading>;
}

/** Single opinion cards: optional avatar, ticker/date line, sentiment line, then the opinion text. */
export function OpinionCardsSkeleton({ label, rows = 3, showCreator = false }: { label?: string; rows?: number; showCreator?: boolean }) {
  return <ContentLoading label={label} className="min-h-0"><ul className="min-w-0">
    <SkeletonRepeat count={rows}>{i => <li className={listFeedRowClass}>
      <div className="flex min-w-0 items-start gap-3">
        {showCreator && <Skeleton className="h-10 w-10 shrink-0 rounded-full" />}
        <div className="flex min-w-0 flex-1 flex-col gap-2"><span className="flex items-center gap-2"><Skeleton className="h-4 w-14 rounded-md" /><Skeleton className="h-3 w-20 rounded-md" /></span><span className="flex gap-4"><Skeleton className="h-3.5 w-12 rounded-md" /><Skeleton className="h-3.5 w-16 rounded-md" /></span></div>
      </div>
      <div className="mt-4 flex flex-col gap-2.5"><Skeleton className="h-4 w-full rounded-md" /><Skeleton className="h-4 w-full rounded-md" /><Skeleton className={cn("h-4 rounded-md", i % 2 ? "w-1/2" : "w-2/3")} /></div>
    </li>}</SkeletonRepeat>
  </ul></ContentLoading>;
}
