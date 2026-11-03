import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const EVENTS = [0, 1, 2];

function EventPlaceholder({ index, day }: { index: number; day: number }) {
  const hasTicker = (index + day) % 2 === 0;
  return (
    <div className={cn("py-3", index > 0 && "border-t border-border/60")}>
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-5 w-10 rounded-full" />
      </div>
      {hasTicker && <Skeleton className="mt-2.5 h-11 w-24 rounded-full" />}
      <Skeleton className="mt-3 h-5 w-3/5" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}

/** Mirrors the week switcher and day columns so the layout holds when events arrive. */
export function MarketEventCalendarSkeleton({ label, calendar }: { label: string; calendar: boolean }) {
  return (
    <div role="status" aria-label={label} className="min-w-0">
      <div aria-hidden="true">
        <div className="flex items-center justify-between gap-4 px-1 pb-3">
          <Skeleton className="h-11 w-48 rounded-full" />
          {calendar && (
            <div className="flex gap-2">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-11 w-11 rounded-full" />
            </div>
          )}
        </div>
        <Skeleton className="mx-1 mb-3 h-3 w-48" />
        <div className={calendar ? "overflow-hidden pb-2" : undefined}>
          <div className={calendar ? "grid min-w-[168rem] grid-cols-7 gap-4" : "space-y-4"}>
            {(calendar ? DAYS : DAYS.slice(0, 3)).map((day) => (
              <div key={day} className={cn("min-w-0 rounded-3xl border border-border bg-card", calendar ? "p-4" : "p-5")}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-7 rounded-full" />
                </div>
                {EVENTS.map((index) => <EventPlaceholder key={index} index={index} day={day} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
