"use client";

import DashboardLayout from "@/components/DashboardLayout";
import SectionCard from "@/components/SectionCard";

export default function StockTrackerLoading() {
  return (
    <DashboardLayout title="Stocks Monitor">
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-2 p-2 overflow-hidden">
        {/* Left Column - My Tracked Stocks */}
        <div className="xl:col-span-2 flex flex-col min-h-0">
          <SectionCard
            title="Trending Stocks"
            useSectionHeader
            padding="md"
            contentClassName="px-4 pb-4"
          >
            {/* Table Skeleton */}
            <div className="rounded-md border border-border-light dark:border-border-dark overflow-hidden">
              {/* Table Header (Stock | Price | Change | Sentiment | KOLs | Actions) */}
              <div className="grid grid-cols-[200px_1fr_1fr_1fr_1fr_50px] gap-4 px-4 py-3 bg-gray-50 dark:bg-white/5 border-b border-border-light dark:border-border-dark">
                <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-20 animate-pulse"></div>
                <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-16 animate-pulse ml-auto"></div>
                <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-16 animate-pulse ml-auto"></div>
                <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-20 animate-pulse ml-auto"></div>
                <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-10 animate-pulse ml-auto"></div>
                <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-6 animate-pulse mx-auto"></div>
              </div>

              {/* Table Rows */}
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[200px_1fr_1fr_1fr_1fr_50px] gap-4 px-4 py-3 border-b border-border-light dark:border-border-dark last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  {/* Stock Info */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-300 dark:bg-white/10 rounded-md animate-pulse flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="h-3.5 bg-gray-300 dark:bg-white/10 rounded w-16 mb-1.5 animate-pulse"></div>
                      <div className="h-2.5 bg-gray-300 dark:bg-white/10 rounded w-24 animate-pulse"></div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-end">
                    <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-16 animate-pulse"></div>
                  </div>

                  {/* Change */}
                  <div className="flex items-center justify-end">
                    <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-14 animate-pulse"></div>
                  </div>

                  {/* Sentiment */}
                  <div className="flex items-center justify-end">
                    <div className="h-6 bg-gray-300 dark:bg-white/10 rounded-full w-20 animate-pulse"></div>
                  </div>

                  {/* KOLs */}
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-8 animate-pulse"></div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-center">
                    <div className="h-6 w-6 bg-gray-300 dark:bg-white/10 rounded-md animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right Column - Hot Stocks List */}
        <div className="space-y-2 xl:col-span-1">
          {/* HotStocksList Skeleton */}
          <div className="bg-white dark:bg-card-dark rounded-lg border border-border-light dark:border-border-dark p-4">
            <div className="h-4 w-28 bg-gray-300 dark:bg-white/10 rounded mb-3 animate-pulse"></div>
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-white/10 animate-pulse"></div>
                    <div>
                      <div className="h-3.5 bg-gray-300 dark:bg-white/10 rounded w-14 mb-1 animate-pulse"></div>
                      <div className="h-2.5 bg-gray-300 dark:bg-white/10 rounded w-20 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-3.5 bg-gray-300 dark:bg-white/10 rounded w-12 ml-auto animate-pulse"></div>
                    <div className="h-2.5 bg-gray-300 dark:bg-white/10 rounded w-14 ml-auto mt-1 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
