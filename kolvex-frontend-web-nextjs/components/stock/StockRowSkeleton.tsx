"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

/** StockRowSkeleton 变体模式 */
export type StockRowSkeletonVariant = "trending" | "tracking";

interface StockRowSkeletonProps {
  variant?: StockRowSkeletonVariant;
}

/**
 * 统一的股票行骨架屏组件
 * 支持 trending 和 tracking 两种模式
 */
export function StockRowSkeleton({
  variant = "trending",
}: StockRowSkeletonProps) {
  if (variant === "trending") {
    // ========== Trending 模式骨架屏 ==========
    return (
      <TableRow className="border-b border-gray-100 dark:border-white/5">
        {/* Stock Info + Star */}
        <TableCell className="w-[240px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Skeleton className="w-8 h-8 rounded-md" />
              <div className="space-y-1.5">
                <Skeleton className="w-12 h-3.5" />
                <Skeleton className="w-16 h-2.5" />
              </div>
            </div>
            <Skeleton className="w-7 h-7 rounded" />
          </div>
        </TableCell>

        {/* Mentions */}
        <TableCell className="w-[90px]">
          <div className="flex justify-center">
            <Skeleton className="w-10 h-3.5" />
          </div>
        </TableCell>

        {/* Top Authors */}
        <TableCell className="w-[120px]">
          <div className="flex justify-center -space-x-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton
                key={i}
                className="w-6 h-6 !rounded-full ring-2 ring-white dark:ring-gray-900"
              />
            ))}
          </div>
        </TableCell>

        {/* Sentiment */}
        <TableCell className="w-[90px]">
          <div className="flex justify-center">
            <Skeleton className="w-14 h-5 rounded-full" />
          </div>
        </TableCell>

        {/* Trending Score */}
        <TableCell className="w-[90px]">
          <div className="flex justify-center">
            <Skeleton className="w-10 h-3.5" />
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // ========== Tracking 模式骨架屏 ==========
  return (
    <TableRow className="border-b border-gray-100 dark:border-white/5">
      {/* Stock Info + Star */}
      <TableCell className="w-[240px]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-8 h-8 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="w-12 h-3.5" />
              <Skeleton className="w-20 h-2.5" />
            </div>
          </div>
          <Skeleton className="w-7 h-7 rounded" />
        </div>
      </TableCell>

      {/* Price */}
      <TableCell className="w-[160px]">
        <div className="flex justify-end">
          <Skeleton className="w-16 h-3.5" />
        </div>
      </TableCell>

      {/* Change Percent */}
      <TableCell className="w-[160px]">
        <div className="flex justify-end">
          <Skeleton className="w-14 h-3.5" />
        </div>
      </TableCell>

      {/* Sparkline */}
      <TableCell className="hidden sm:table-cell w-[160px]">
        <div className="flex justify-center">
          <Skeleton className="w-[60px] h-5" />
        </div>
      </TableCell>

      {/* Top Authors */}
      <TableCell className="hidden md:table-cell w-[120px]">
        <div className="flex justify-center -space-x-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton
              key={i}
              className="w-6 h-6 !rounded-full ring-2 ring-white dark:ring-gray-900"
            />
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** 加载更多行 */
export function LoadingMoreRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-6">
        <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading more stocks...</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** 没有更多数据行 */
export function NoMoreDataRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="text-center py-6 text-sm text-gray-400 dark:text-white/40 font-medium"
      >
        No more stocks to load
      </TableCell>
    </TableRow>
  );
}

/** 空数据行 */
export function EmptyRow({
  colSpan,
  searchQuery,
}: {
  colSpan: number;
  searchQuery?: string;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="text-center py-8 text-sm text-gray-500 dark:text-white/50"
      >
        {searchQuery ? "No stocks match your search" : "No stocks to display"}
      </TableCell>
    </TableRow>
  );
}

export default StockRowSkeleton;
