import { TableHead, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function TableHeaderRow({ className }: { className?: string }) {
  return (
    <TableRow className={cn(className)}>
      <TableHead className="text-xs font-semibold w-[240px]">Stock</TableHead>
      <TableHead className="text-xs text-right font-semibold w-[160px]">
        Price
      </TableHead>
      <TableHead className="text-xs text-right font-semibold w-[160px]">
        Change
      </TableHead>
      <TableHead className="text-xs text-center font-semibold w-[160px]">
        Today
      </TableHead>
      <TableHead className="text-xs text-center font-semibold w-[120px]">
        KOLs
      </TableHead>
    </TableRow>
  );
}
