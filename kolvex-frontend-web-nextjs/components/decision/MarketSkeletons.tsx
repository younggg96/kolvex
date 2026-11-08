"use client";

import { ListCard, phonePlainCardClass } from "@/components/ui/list-card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StockRowsSkeleton } from "@/components/decision/StockRowsSkeleton";
import { useCopy } from "@/components/decision/shared";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Same grid as StockObservationList rows. */
const STOCK_GRID = "grid grid-cols-[minmax(0,1fr)_80px] gap-x-2 min-[360px]:grid-cols-[minmax(0,1fr)_60px_80px] sm:grid-cols-[minmax(0,1fr)_100px_100px] sm:gap-x-4";

/** Compact rail rows (Watchlist card, creator updates): small logo + ticker, then one or two end values. */
export function RailRowsSkeleton({ rows = 4, ends = 2 }: { rows?: number; ends?: 1 | 2 }) {
  return <div className="min-w-0">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-1 max-md:px-0">
      <span className="flex min-w-0 items-center gap-2"><Skeleton className="h-8 w-8 shrink-0 rounded-full md:h-5 md:w-5" /><Skeleton className={cn("h-4 rounded-md", i % 2 ? "w-10" : "w-12")} /></span>
      <span className="flex items-center gap-2"><Skeleton className="h-4 w-14 rounded-md" />{ends === 2 && <Skeleton className="h-3.5 w-12 rounded-md" />}</span>
    </div>)}
  </div>;
}

/** One benchmark card: name/date, symbol, value, change, sparkline, footnote. */
function IndexCardSkeleton() {
  return <div className="glass-card bg-card-glass h-60 w-60 shrink-0 rounded-3xl border border-foreground/10 p-4 max-md:h-auto max-md:w-[11.25rem] max-md:p-3 xl:w-auto">
    <div className="flex h-6 items-center justify-between max-md:h-5"><Skeleton className="h-4 w-24 rounded-md" /><Skeleton className="h-3 w-10 rounded-md" /></div>
    <Skeleton className="mt-1 h-3 w-12 rounded-md" />
    <Skeleton className="mt-3 h-8 w-28 rounded-lg max-md:mt-1.5 max-md:h-7" />
    <Skeleton className="mt-1 h-4 w-32 rounded-md" />
    <Skeleton className="mt-2 h-16 w-full rounded-xl max-md:h-10" />
    <Skeleton className="mt-2 h-3 w-20 rounded-md max-md:hidden" />
  </div>;
}

/** Markets route fallback: page frame, view pills and range controls, index cards, stock list and side rail. */
export function MarketPageSkeleton({ noTransition = false }: { noTransition?: boolean }) {
  const c = useCopy();
  return <DashboardLayout title={c("Markets", "行情")} noTransition={noTransition}>
    <main className="min-w-0 flex-1 overflow-y-auto">
      <ContentLoading label={c("Loading markets", "正在加载行情")} className="mx-auto w-full min-w-0 max-w-[100rem] px-[16px] pb-10 pt-6 md:px-8 md:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 max-md:w-full">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-28 rounded-full max-md:flex-1" />)}</div>
          <div className="flex items-center gap-3 max-md:w-full max-md:justify-between md:ml-auto"><Skeleton className="h-11 w-56 rounded-full max-md:w-40" /><Skeleton className="h-11 w-20 rounded-full" /><Skeleton className="h-11 w-11 rounded-full" /></div>
        </div>
        <div className="grid gap-x-8 gap-y-2 pt-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:gap-x-12">
          <div className="min-w-0 xl:col-span-2">
            <div className="mb-4 flex min-h-9 items-center justify-between"><Skeleton className="h-6 w-32 rounded-md" /><Skeleton className="h-8 w-20 rounded-full" /></div>
            <div className="flex gap-3 overflow-hidden pb-2 sm:gap-4 xl:grid xl:grid-cols-5">{[0, 1, 2, 3, 4].map(i => <IndexCardSkeleton key={i} />)}</div>
          </div>
          <div className="min-w-0">
            <div className="mb-3 flex min-h-14 items-center justify-between"><Skeleton className="h-6 w-28 rounded-md" /><Skeleton className="h-9 w-24 rounded-full" /></div>
            <ListCard>
              <div className="mb-3 flex gap-2">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9 w-16 rounded-full" />)}</div>
              <div className="border-b border-border px-2 py-3"><Skeleton className="h-3.5 w-1/3 rounded-md" /></div>
              <StockRowsSkeleton grid={STOCK_GRID} trendClass="hidden min-[360px]:block" watchClass="max-md:hidden" reason />
            </ListCard>
          </div>
          <aside className="min-w-0 space-y-8">
            {[2, 1].map((ends, i) => <section key={i}>
              <div className="mb-3 flex min-h-14 items-center gap-2"><Skeleton className="h-6 w-24 rounded-md" /><Skeleton className="ml-auto h-11 w-11 rounded-full" /></div>
              {ends === 2
                ? <div className={cn("rounded-3xl border border-foreground/10 glass-card bg-card-glass p-3", phonePlainCardClass)}><RailRowsSkeleton ends={2} /></div>
                : <ListCard><RailRowsSkeleton ends={1} /></ListCard>}
            </section>)}
          </aside>
        </div>
      </ContentLoading>
    </main>
  </DashboardLayout>;
}
