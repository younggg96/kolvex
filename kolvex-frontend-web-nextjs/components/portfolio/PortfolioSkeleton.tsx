import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Mirrors PortfolioHoldings: header actions, the performance chart (value, change, range
 * control, 260px plot), the stats row, the view switch, then collapsed account cards.
 */
export function PortfolioSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading portfolio" className={cn("space-y-6", className)}>
      <div aria-hidden="true" className="space-y-6">
        <div className="flex justify-end gap-2"><Skeleton className="h-9 w-24 rounded-full" /><Skeleton className="h-9 w-9 rounded-full" /></div>
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><Skeleton className="h-10 w-44 rounded-lg sm:h-12" /><Skeleton className="mt-2 h-4 w-36 rounded-md" /></div>
            <Skeleton className="h-9 w-56 rounded-full" />
          </div>
          <Skeleton className="mt-5 h-[260px] w-full rounded-2xl" />
        </div>
        <div className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="py-4 pr-4 sm:pr-6"><Skeleton className="h-3.5 w-20 rounded-md" /><Skeleton className="mt-2 h-6 w-24 rounded-md" /></div>)}
        </div>
        <div className="flex items-center justify-between gap-4"><Skeleton className="h-10 w-56 rounded-full" /><Skeleton className="h-3 w-28 rounded-md" /></div>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="overflow-hidden !p-0 sm:!p-0 max-md:-mx-[16px]">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3"><Skeleton className="h-4 w-4 rounded" /><div className="space-y-1.5"><Skeleton className="h-4 w-32 rounded-md" /><Skeleton className="h-3 w-16 rounded-md" /></div></div>
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
