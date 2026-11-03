import { Skeleton } from "@/components/ui/skeleton";

export function DetailSkeleton() {
  return (
    <div className="space-y-10 px-[16px] pt-6 md:px-8 md:pt-8">
      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-3xl" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[10.5rem_minmax(0,1fr)] lg:gap-12">
        <div className="flex gap-3 lg:flex-col">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-24 rounded-2xl" />)}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
