"use client";

import { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

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
  return (
    <header className="relative z-10 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-background px-4 py-3 lg:px-7">
      <div className="flex min-w-0 items-center gap-3">
        {/* Mobile menu button */}
        {hasSidebarTrigger && <SidebarTrigger className="lg:hidden" />}
        {leftAction}
        {title && (
          <h1 className="min-w-0 break-words text-base font-medium text-foreground">
            {title}
          </h1>
        )}
        {extra && <>{extra}</>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
