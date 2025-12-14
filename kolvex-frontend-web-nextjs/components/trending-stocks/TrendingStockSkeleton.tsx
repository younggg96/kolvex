"use client";

import { TableCell, TableRow } from "@/components/ui/table";

export function TrendingStockSkeleton() {
  return (
    <TableRow className="border-b border-gray-100 dark:border-white/5">
      <TableCell className="py-3 w-[140px] min-w-[140px]">
        <div className="flex items-center justify-start gap-2">
          <div className="w-8 h-8 rounded bg-gray-300 dark:bg-white/10 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="w-12 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mb-1" />
            <div className="w-16 h-2.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse" />
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center py-3 w-[90px]">
        <div className="w-10 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="py-3 w-[120px]">
        <div className="flex justify-center -space-x-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full bg-gray-300 dark:bg-white/10 animate-pulse ring-2 ring-white dark:ring-gray-900"
            />
          ))}
        </div>
      </TableCell>
      <TableCell className="text-center py-3 w-[90px]">
        <div className="w-8 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="text-center py-3 w-[90px]">
        <div className="w-12 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
    </TableRow>
  );
}

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
