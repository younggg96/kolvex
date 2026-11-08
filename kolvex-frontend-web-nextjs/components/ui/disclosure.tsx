"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Disclosure({
  title,
  count,
  className,
  children,
}: {
  title: ReactNode;
  count?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={cn("group/disclosure min-w-0", className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded text-sm font-medium hover:text-muted-foreground focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          {title}
          {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/disclosure:rotate-180" aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}
