import { TableHead, TableRow } from "@/components/ui/table";

export function TableHeaderRow() {
  return (
    <TableRow className="border-b border-gray-200 dark:border-white/10">
      <TableHead className="text-xs font-semibold">Stock</TableHead>
      <TableHead className="text-xs text-right font-semibold">Price</TableHead>
      <TableHead className="text-xs text-right font-semibold">Change</TableHead>
      <TableHead className="text-xs text-center font-semibold">Today</TableHead>
      <TableHead className="text-xs text-center font-semibold">KOLs</TableHead>
    </TableRow>
  );
}
