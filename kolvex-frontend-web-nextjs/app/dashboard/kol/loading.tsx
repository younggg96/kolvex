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
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="h-3 bg-muted rounded w-20 animate-pulse"></div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
                <Star className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="h-3 bg-muted rounded w-20 animate-pulse"></div>
              </div>
            </div>
          }
        >
          <div className="px-4 pb-4 space-y-3">
            {/* Table Skeleton */}
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="bg-muted/50 border-b border-border">
                <div className="flex items-center px-4 py-3 gap-4">
                  <div className="h-3 bg-muted rounded w-12 animate-pulse"></div>
                  <div className="h-3 bg-muted rounded w-24 animate-pulse"></div>
                  <div className="h-3 bg-muted rounded w-20 animate-pulse"></div>
                  <div className="h-3 bg-muted rounded w-20 animate-pulse"></div>
                  <div className="flex-1"></div>
                  <div className="h-3 bg-muted rounded w-12 animate-pulse"></div>
                </div>
              </div>

              {/* Table Rows */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="border-b border-border last:border-b-0"
                >
                  <div className="flex items-center px-4 py-3 gap-4">
                    {/* Rank */}
                    <div className="w-6 h-6 bg-muted rounded-full animate-pulse flex-shrink-0"></div>

                    {/* Name & Username */}
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-muted rounded w-28 animate-pulse"></div>
                      <div className="h-2.5 bg-muted rounded w-20 animate-pulse"></div>
                    </div>

                    {/* Platform */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 bg-muted rounded animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-12 animate-pulse"></div>
                    </div>

                    {/* Followers */}
                    <div className="h-3 bg-muted rounded w-16 animate-pulse"></div>

                    {/* Description (hidden on mobile) */}
                    <div className="hidden md:block flex-1 max-w-[200px]">
                      <div className="h-3 bg-muted rounded w-full animate-pulse"></div>
                    </div>

                    {/* Action Button */}
                    <div className="w-8 h-8 bg-muted rounded animate-pulse"></div>
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
