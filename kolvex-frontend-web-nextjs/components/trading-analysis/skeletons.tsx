import { Skeleton } from "@/components/ui/skeleton";

export function HistorySkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 py-3.5"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-10 px-4 pt-6 md:px-8 md:pt-8">
      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[168px_minmax(0,1fr)] lg:gap-12">
        <div className="flex gap-3 lg:flex-col">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-24 rounded-lg" />)}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
