"use client";

import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";

const lineWidths = ["w-3/4", "w-1/2", "w-2/3"];

/**
 * Divided admin rows: optional avatar, a meta line, a title line, an optional third line,
 * and the trailing action buttons — the shape every admin list shares.
 */
export function AdminRowsSkeleton({ label, rows = 4, avatar = false, actions = 1, lines = 3 }: { label: string; rows?: number; avatar?: boolean; actions?: number; lines?: 2 | 3 }) {
  return <ContentLoading label={label} className="min-h-0">
    <div className="divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-start justify-between gap-3 py-4">
        {avatar && <Skeleton className="h-10 w-10 shrink-0 rounded-full" />}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-40 rounded-md" />
          <Skeleton className={`h-4 rounded-md ${lineWidths[i % 3]}`} />
          {lines === 3 && <Skeleton className="h-3 w-1/3 rounded-md" />}
        </div>
        <div className="flex shrink-0 gap-2">{Array.from({ length: actions }, (_, j) => <Skeleton key={j} className="h-9 w-14 rounded-full" />)}</div>
      </div>)}
    </div>
  </ContentLoading>;
}
