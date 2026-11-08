import { Skeleton } from "@/components/ui/skeleton";
import { REPORT_READER_GRID } from "./reader-styles";

/**
 * Mirrors a research report page: logo + ticker + decision/published badges and actions,
 * the author/date meta line, then the reader grid (section nav + report sections).
 */
export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading research report" className="space-y-10 px-[16px] pb-10 pt-6 md:px-8 md:pt-8">
      <div aria-hidden="true" className="border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-h-11 items-center gap-3 px-1">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-lg md:h-9" />
          </div>
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <div className="flex gap-2 sm:ml-auto"><Skeleton className="h-10 w-24 rounded-full" /><Skeleton className="h-10 w-10 rounded-full" /></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-4 w-20 rounded-md" /></span>
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
      </div>
      <div aria-hidden="true" className={REPORT_READER_GRID}>
        <div className="flex gap-1 overflow-hidden border-b border-border pb-3 lg:flex-col lg:gap-2 lg:border-b-0 lg:pb-0">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="flex min-h-11 shrink-0 items-center px-3 py-2"><Skeleton className="h-4 w-20 rounded-md" /></div>)}
        </div>
        <div className="min-w-0 space-y-12">
          {[0, 1].map((section) => (
            <div key={section}>
              <Skeleton className="mb-5 h-6 w-48 rounded-md" />
              <div className="space-y-2.5">
                {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className={i === 5 ? "h-4 w-1/2 rounded-md" : "h-4 w-full rounded-md"} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
