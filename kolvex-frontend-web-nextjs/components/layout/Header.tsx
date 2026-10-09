"use client";

import { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDecisionCommand } from "@/components/decision/CommandLayer";
import { useCopy } from "@/components/decision/shared";

interface HeaderProps {
  title?: string;
  hasSidebarTrigger?: boolean;
  leftAction?: ReactNode;
  actions?: ReactNode;
  extra?: ReactNode;
}

export default function Header({
  title,
  hasSidebarTrigger = true,
  leftAction,
  actions,
  extra,
}: HeaderProps) {
  const c = useCopy();
  const { openAsk, canAsk } = useDecisionCommand();
  return (
    <header className="relative z-10 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/70 bg-sidebar px-4 py-2.5 lg:min-h-16 lg:px-8">
      <div className="flex min-w-0 basis-full items-center gap-2 sm:flex-1 sm:basis-auto">
        {hasSidebarTrigger && <SidebarTrigger className="-ml-1.5 shrink-0 lg:hidden" />}
        {leftAction && <div className="flex shrink-0 items-center">{leftAction}</div>}
        {title && (
          <h1 className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h1>
        )}
        {extra && <>{extra}</>}
        {canAsk && (
          <button
            type="button"
            onClick={openAsk}
            aria-label={c("Ask Kolvex", "询问 Kolvex")}
            className="-mr-1.5 ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
          >
            <Sparkles className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>
      {actions && (
        <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 [&>*]:shrink-0 sm:w-auto">
          {actions}
        </div>
      )}
    </header>
  );
}
