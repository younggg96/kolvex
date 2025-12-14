import { TableHead, TableRow } from "@/components/ui/table";

export function TableHeaderRow() {
  return (
    <TableRow className="border-b border-gray-200 dark:border-white/10">
      <TableHead className="text-xs font-semibold">Stock</TableHead>
      <TableHead className="text-xs text-right font-semibold">Price</TableHead>
      <TableHead className="text-xs text-right font-semibold">Change</TableHead>
      <TableHead className="text-xs text-center font-semibold hidden sm:table-cell">
        Today
      </TableHead>
      <TableHead className="text-xs text-center font-semibold hidden md:table-cell">
        KOLs
      </TableHead>
      <TableHead className="text-xs text-center font-semibold w-12">
        <span className="sr-only">Action</span>
      </TableHead>
    </TableRow>
  );
}


