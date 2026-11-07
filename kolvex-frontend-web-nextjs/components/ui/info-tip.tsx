"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** ⓘ next to a heading or label; the explanation stays hidden until opened (tap or click). */
export function InfoTip({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className={cn(
          "relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-3 after:content-['']",
          className,
        )}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="max-w-xs px-4 py-3 text-sm font-normal leading-6 text-muted-foreground">
        {children}
      </PopoverContent>
    </Popover>
  );
}
