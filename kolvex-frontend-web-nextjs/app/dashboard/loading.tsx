"use client";

import { ListCard } from "@/components/ui/list-card";
import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { RouteLoadingSignal } from "@/components/layout/NavigationProgress";
import { MarketPageSkeleton } from "@/components/decision/MarketSkeletons";
import { WatchlistPageSkeleton } from "@/components/decision/Watchlist";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";

/**
 * Lets dashboard routes switch immediately while the next page's server payload loads.
 * Routes with a dedicated page skeleton show it; the rest share the list-page frame
 * (heading, toolbar, list card) that most dashboard pages use.
 */
export default function DashboardLoading() {
  const pathname = usePathname();
  const { t } = useTranslation();

  if (pathname === "/dashboard") return <><RouteLoadingSignal /><MarketPageSkeleton noTransition /></>;
  if (pathname === "/dashboard/watchlist") return <><RouteLoadingSignal /><WatchlistPageSkeleton noTransition /></>;

  return (
    <DashboardLayout noTransition>
      <RouteLoadingSignal />
      <main className="min-h-0 flex-1 overflow-hidden">
        <ContentLoading label={t("common.loading")} className="mx-auto min-h-0 w-full max-w-6xl px-[16px] pb-16 pt-6 md:px-8 md:pt-8">
          <div className="mb-6 flex flex-col gap-3"><Skeleton className="h-8 w-40 rounded-lg sm:h-9" /><Skeleton className="h-4 w-64 max-w-full rounded-md" /></div>
          <ListCard>
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-16 rounded-full" />)}</div><Skeleton className="h-9 w-28 rounded-full" /></div>
            <div className="mt-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="flex min-h-20 items-center gap-3 px-2 py-4 max-md:min-h-0 max-md:px-0 max-md:py-2">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2"><Skeleton className={i % 2 ? "h-4 w-1/3 rounded-md" : "h-4 w-1/2 rounded-md"} /><Skeleton className="h-3 w-1/4 rounded-md" /></div>
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>)}</div>
          </ListCard>
        </ContentLoading>
      </main>
    </DashboardLayout>
  );
}
