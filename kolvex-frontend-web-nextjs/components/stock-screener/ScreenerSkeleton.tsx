"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function ScreenerSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="p-1">
        {/* Header row */}
        <div className="flex gap-3 px-3 py-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 10 }).map((_, row) => (
          <div
            key={row}
            className="flex items-center gap-3 px-3 py-3 border-t border-border/30"
          >
            <div className="flex items-center gap-2 min-w-[160px]">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-2 w-20" />
              </div>
            </div>
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-14" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
