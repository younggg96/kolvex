"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCopy } from "./shared";

/** Renders a tab's own controls in the row shared with the Markets tabs. */
export function MarketToolbarControls({ toolbar, children }: { toolbar: HTMLElement | null; children: ReactNode }) {
  return toolbar ? createPortal(children, toolbar) : null;
}

/** Matches the height of the bordered segmented controls beside it. */
export function MarketRefreshButton({ refreshing, disabled, onClick }: { refreshing: boolean; disabled?: boolean; onClick: () => void }) {
  const c = useCopy();
  return (
    <Button variant="outline" size="sm" className="h-[calc(2.75rem+2px)] shrink-0 rounded-full" disabled={disabled ?? refreshing} onClick={onClick}>
      <RefreshCw className={cn("mr-2 h-3.5 w-3.5", refreshing && "animate-spin motion-reduce:animate-none")} aria-hidden />
      {c("Refresh", "刷新")}
    </Button>
  );
}
