"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { Star, TrendingUp } from "lucide-react";

export default function KOLTrackerLoading() {
  return (
    <DashboardLayout title="KOL Tracker">
      <div className="flex-1 p-2">
        {/* Unified KOL Section with Tab Switcher Skeleton */}
        <SectionCard
          useSectionHeader
          headerExtra={
            <div className="flex gap-2">
              {/* Tab Skeleton */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-200 dark:bg-white/10">
                <TrendingUp className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <div className="h-3 bg-gray-300 dark:bg-white/20 rounded w-20 animate-pulse"></div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5">
                <Star className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-20 animate-pulse"></div>
              </div>
            </div>
          }
        >
          <div className="px-4 pb-4 space-y-3">
            {/* Table Skeleton */}
            <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="bg-gray-50 dark:bg-white/5 border-b border-border-light dark:border-border-dark">
                <div className="flex items-center px-4 py-3 gap-4">
                  <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-12 animate-pulse"></div>
                  <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-24 animate-pulse"></div>
                  <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-20 animate-pulse"></div>
                  <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-20 animate-pulse"></div>
                  <div className="flex-1"></div>
                  <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-12 animate-pulse"></div>
                </div>
              </div>

              {/* Table Rows */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="border-b border-border-light dark:border-border-dark last:border-b-0"
                >
                  <div className="flex items-center px-4 py-3 gap-4">
                    {/* Rank */}
                    <div className="w-6 h-6 bg-gray-300 dark:bg-white/10 rounded-full animate-pulse flex-shrink-0"></div>

                    {/* Name & Username */}
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-gray-300 dark:bg-white/10 rounded w-28 animate-pulse"></div>
                      <div className="h-2.5 bg-gray-300 dark:bg-white/10 rounded w-20 animate-pulse"></div>
                    </div>

                    {/* Platform */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 bg-gray-300 dark:bg-white/10 rounded animate-pulse"></div>
                      <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-12 animate-pulse"></div>
                    </div>

                    {/* Followers */}
                    <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-16 animate-pulse"></div>

                    {/* Description (hidden on mobile) */}
                    <div className="hidden md:block flex-1 max-w-[200px]">
                      <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-full animate-pulse"></div>
                    </div>

                    {/* Action Button */}
                    <div className="w-8 h-8 bg-gray-300 dark:bg-white/10 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}
