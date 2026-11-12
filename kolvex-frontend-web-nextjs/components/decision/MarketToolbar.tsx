"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCopy } from "./shared";

/** Renders a tab's own controls in the row shared with the Markets tabs. */
export function MarketToolbarControls({ toolbar, children }: { toolbar: HTMLElement | null; children: ReactNode }) {
  return toolbar ? createPortal(children, toolbar) : null;
}

export function MarketInfoButton({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="cursor-pointer data-[state=open]:bg-foreground/[0.08]" aria-label={label} title={label}>
          <Info className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={label} align="end" collisionPadding={16} className={cn("max-h-[var(--radix-popover-content-available-height)] max-w-[calc(100vw-2rem)] space-y-2 overflow-y-auto p-4 text-xs leading-5 text-muted-foreground motion-reduce:animate-none", wide ? "w-96" : "w-72")}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** Matches the height of the bordered segmented controls beside it; icon only on phones. */
export function MarketRefreshButton({ refreshing, disabled, onClick }: { refreshing: boolean; disabled?: boolean; onClick: () => void }) {
  const c = useCopy();
  return (
    <Button variant="outline" size="sm" className="h-[calc(2.75rem+2px)] shrink-0 rounded-full max-md:!h-10 max-md:!w-10 max-md:!p-0" disabled={disabled ?? refreshing} onClick={onClick}>
      <RefreshCw className={cn("h-3.5 w-3.5 md:mr-2", refreshing && "animate-spin motion-reduce:animate-none")} aria-hidden />
      <span className="max-md:sr-only">{c("Refresh", "刷新")}</span>
    </Button>
  );
}
