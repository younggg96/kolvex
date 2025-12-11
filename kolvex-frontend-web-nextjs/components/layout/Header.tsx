"use client";

import { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface HeaderProps {
  title?: string;
  leftAction?: ReactNode;
  actions?: ReactNode;
}

export default function Header({
  title = "Home",
  leftAction,
  actions,
}: HeaderProps) {
  return (
    <header className="flex justify-between items-center px-4 lg:px-6 py-3 lg:py-4 h-[48px] lg:h-[56px] bg-white dark:bg-background-dark border-b border-border-light dark:border-border-dark">
      <div className="flex items-center gap-3 lg:gap-4">
        {/* Mobile menu button */}
        <SidebarTrigger className="lg:hidden" />
        {leftAction}
        <h1 className="text-[16px] lg:text-[18px] font-semibold text-gray-900 dark:text-white">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
