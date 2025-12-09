import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import {
  ArrowDownUp,
  ArrowDownWideNarrow,
  ArrowDownNarrowWide,
  ArrowDownZA,
  ArrowDownAZ,
  ArrowDown01,
  ArrowDown10,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SortType = "numeric" | "alpha" | "amount";

interface SortableHeaderProps<T extends string> {
  label: string;
  sortKey: T;
  currentSortKey?: T | null;
  sortDirection?: "asc" | "desc";
  onSort: (key: T) => void;
  align?: "left" | "center" | "right";
  className?: string;
  hideIcon?: boolean;
  type?: SortType;
}

export function SortableHeader<T extends string>({
  label,
  sortKey,
  currentSortKey,
  sortDirection,
  onSort,
  align = "center",
  className,
  hideIcon = false,
  type = "amount", // default to amount (wide-narrow) style
}: SortableHeaderProps<T>) {
  const isActive = currentSortKey === sortKey;
  const iconClass = cn(
    "w-3.5 h-3.5",
    isActive ? "text-primary opacity-100" : "text-muted-foreground opacity-40"
  );

  const getSortIcon = () => {
    // If not active, show default unsorted icon
    if (!isActive) {
      return <ArrowDownUp className={iconClass} />;
    }

    // Active state icons based on type and direction
    if (sortDirection === "asc") {
      switch (type) {
        case "numeric":
          return <ArrowDown01 className={iconClass} />;
        case "alpha":
          return <ArrowDownAZ className={iconClass} />;
        case "amount":
        default:
          return <ArrowDownNarrowWide className={iconClass} />;
      }
    } else {
      // desc
      switch (type) {
        case "numeric":
          return <ArrowDown10 className={iconClass} />;
        case "alpha":
          return <ArrowDownZA className={iconClass} />;
        case "amount":
        default:
          return <ArrowDownWideNarrow className={iconClass} />;
      }
    }
  };

  return (
    <TableHead
      className={cn(
        "text-xs font-semibold select-none",
        align === "left" && "text-left",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 group cursor-pointer hover:text-foreground transition-colors",
          align === "left" && "justify-start",
          align === "center" && "justify-center",
          align === "right" && "justify-end",
          isActive && "text-foreground"
        )}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        {!hideIcon && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 !p-0 hover:bg-transparent"
          >
            {getSortIcon()}
          </Button>
        )}
      </div>
    </TableHead>
  );
}
