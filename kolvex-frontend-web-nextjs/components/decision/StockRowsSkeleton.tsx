import { Skeleton } from "@/components/ui/skeleton";
import { ContentLoading, SkeletonRepeat } from "@/components/ui/content-loading";
import { listRowTargetClass } from "@/components/ui/list-card";
import { cn } from "@/lib/utils";

/**
 * Placeholder rows that mirror the Markets / Watchlist stock rows: logo + symbol/name,
 * sparkline column, price/change column and the trailing watch star.
 */
export function StockRowsSkeleton({ grid, trendClass, label, rows = 6, reason = false, watchClass }: {
  /** The same ROW_GRID the real rows use. */
  grid: string;
  /** Visibility classes of the trend column, e.g. "hidden min-[400px]:block". */
  trendClass: string;
  label?: string;
  rows?: number;
  /** Rows that carry a full-width reason line under the main row. */
  reason?: boolean;
  /** Visibility classes for the watch-star column. */
  watchClass?: string;
}) {
  return <ContentLoading label={label} className="min-h-0">
    <ul className="min-w-0">
      <SkeletonRepeat count={rows}>{i => <li className="flex items-center gap-1 pr-2 max-md:pr-0 max-md:[&>*]:!px-0">
        <div className={cn(grid, listRowTargetClass, reason && "gap-y-1")}>
          <span className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-14 rounded-md" />
              <Skeleton className={cn("h-3.5 rounded-md", i % 2 ? "w-24" : "w-32")} />
            </span>
          </span>
          <span className={trendClass}><span className="flex h-10 items-center"><Skeleton className="h-7 w-full rounded-lg" /></span></span>
          <span className="flex flex-col items-end gap-2">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-3.5 w-12 rounded-md" />
          </span>
          {reason && <Skeleton className={cn("col-span-full h-3.5 rounded-md", i % 2 ? "w-1/2" : "w-2/3")} />}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center", watchClass)}><Skeleton className="h-5 w-5 rounded-full" /></div>
      </li>}</SkeletonRepeat>
    </ul>
  </ContentLoading>;
}
