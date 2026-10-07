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
    <div className="space-y-8 px-4 pt-6 md:px-8 md:pt-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-12 w-28 rounded-xl" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
