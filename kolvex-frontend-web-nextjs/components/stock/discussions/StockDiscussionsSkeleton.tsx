"use client";

import SectionCard from "@/components/layout/SectionCard";

export default function StockDiscussionsSkeleton() {
  return (
    <SectionCard useSectionHeader={false} padding="none" contentClassName="p-3">
      <div className="animate-pulse">
        {/* Tab 骨架 */}
        <div className="h-10 bg-muted rounded-lg mb-3" />

        {/* 头部统计骨架 */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-5 bg-muted rounded w-16" />
        </div>

        {/* KOL 头像骨架 */}
        <div className="flex gap-4 mb-6 pt-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-muted rounded-full" />
              <div className="h-3 bg-muted rounded w-12" />
            </div>
          ))}
        </div>

        <div className="h-px bg-muted mb-3" />

        {/* 推文骨架 */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-muted rounded-full" />
                <div className="h-4 bg-muted rounded w-24" />
              </div>
              <div className="h-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

