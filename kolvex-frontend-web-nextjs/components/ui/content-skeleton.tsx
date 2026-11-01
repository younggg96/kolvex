import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

/** Static content shapes; status text is announced once, never repeated per row. */
export function ContentSkeleton({ label, variant = "list", rows = 3, className }: {
  label: string;
  variant?: "list" | "video" | "article" | "profile" | "text";
  rows?: number;
  className?: string;
}) {
  return <div role="status" aria-busy="true" className={cn("min-w-0 py-4", className)}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="space-y-5">
      {variant === "article" ? <>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        {[0, 1, 2].map(section => <div key={section} className="space-y-3 pt-5"><Skeleton className="h-5 w-1/3" />{[0, 1, 2, 3].map(line => <Skeleton key={line} className={cn("h-4", line === 3 ? "w-3/4" : "w-full")} />)}</div>)}
      </> : variant === "profile" ? <>
        <div className="flex items-center gap-4"><Skeleton className="h-16 w-16 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /></div></div>
        {[0, 1, 2].map(row => <div key={row} className="space-y-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-11 w-full rounded-full" /></div>)}
      </> : variant === "video" ? Array.from({ length: rows }, (_, row) => <div key={row} className="min-w-0 space-y-4">
        <div className="flex items-center gap-2"><Skeleton className="h-7 w-7 shrink-0 rounded-full" /><Skeleton className="h-4 w-1/2" /></div>
        <Skeleton className="h-5 w-full" /><Skeleton className="h-3 w-1/3" />
        {[0, 1].map(opinion => <div key={opinion} className="space-y-3 pt-2"><div className="flex justify-between gap-3"><Skeleton className="h-4 w-16" /><Skeleton className="h-3 w-20" /></div><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div>)}
      </div>) : Array.from({ length: rows }, (_, row) => <div key={row} className={cn("min-w-0", variant === "list" && "flex min-h-16 items-center gap-3")}>
        {variant === "list" && <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />}
        <div className="min-w-0 flex-1 space-y-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" />{variant === "text" && <Skeleton className="h-3 w-4/5" />}</div>
        {variant === "list" && <div className="w-16 shrink-0 space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="ml-auto h-3 w-10" /></div>}
      </div>)}
    </div>
  </div>;
}
