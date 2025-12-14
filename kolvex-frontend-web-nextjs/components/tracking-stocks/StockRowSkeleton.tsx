import { TableCell, TableRow } from "@/components/ui/table";

export function StockRowSkeleton() {
  return (
    <TableRow className="border-b border-gray-100 dark:border-white/5">
      <TableCell className="py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-gray-300 dark:bg-white/10 animate-pulse" />
          <div>
            <div className="w-16 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mb-1" />
            <div className="w-24 h-3 bg-gray-300 dark:bg-white/10 rounded animate-pulse" />
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right py-3">
        <div className="w-16 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse ml-auto" />
      </TableCell>
      <TableCell className="text-right py-3">
        <div className="w-12 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse ml-auto" />
      </TableCell>
      <TableCell className="py-3 hidden sm:table-cell">
        <div className="w-[60px] h-5 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
      <TableCell className="py-3 hidden md:table-cell">
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-3.5 bg-gray-300 dark:bg-white/10 rounded animate-pulse" />
          <div className="flex -space-x-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full bg-gray-300 dark:bg-white/10 animate-pulse"
              />
            ))}
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="w-7 h-7 bg-gray-300 dark:bg-white/10 rounded animate-pulse mx-auto" />
      </TableCell>
    </TableRow>
  );
}


