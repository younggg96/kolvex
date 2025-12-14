"use client";

import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandButtonProps {
  totalCount: number;
  showAll: boolean;
  onClick: () => void;
}

export default function ExpandButton({
  totalCount,
  showAll,
  onClick,
}: ExpandButtonProps) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <Button
        variant="outline"
        size="icon"
        onClick={onClick}
        className={cn(
          "w-10 h-10 !rounded-full flex items-center justify-center transition-all !border-primary/60 hover:!border-primary hover:!bg-primary/20"
        )}
        title={showAll ? "Collapse" : `View all ${totalCount} KOLs`}
      >
        {showAll ? (
          <ChevronLeft className="w-4 h-4 text-primary" />
        ) : (
          <ChevronRight className="w-4 h-4 text-primary" />
        )}
      </Button>
      <span className="text-xs text-muted-foreground">
        {showAll ? "Collapse" : `+${totalCount - 7}`}
      </span>
    </div>
  );
}

