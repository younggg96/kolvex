"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Tracking 股票表格的骨架屏组件
 * 列结构: Stock (240px) | Price (160px) | Change (160px) | Today/Sparkline (160px) | KOLs (120px)
 */
export function TrackingStockSkeleton() {
  return (
    <TableRow className="border-b border-gray-100 dark:border-white/5">
      {/* Stock Info + Star */}
      <TableCell className="w-[240px]">
        <div className="flex items-center justify-between gap-2 h-[42.5px]">
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

      {/* Sparkline (Today) */}
      <TableCell className="w-[160px]">
        <div className="flex justify-center">
          <Skeleton className="w-[60px] h-5" />
        </div>
      </TableCell>

      {/* Top Authors (KOLs) */}
      <TableCell className="w-[120px]">
        <div className="flex items-center justify-center -space-x-2">
          {[0, 1, 2].map((i) => (
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

export default TrackingStockSkeleton;
