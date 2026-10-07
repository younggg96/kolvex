"use client";

import { ReactNode } from "react";
import Header from "./Header";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  showTitle?: boolean;
  showHeader?: boolean;
  /** Tailwind CSS classes for responsive header visibility, e.g. "lg:hidden" */
  headerClassName?: string;
  hasSidebarTrigger?: boolean;
  headerLeftAction?: ReactNode;
  headerExtra?: ReactNode;
  headerActions?: ReactNode;
  /** Disable page transition animation */
  noTransition?: boolean;
}

/**
 * Page-level layout wrapper that renders the header and content area.
 * The sidebar is provided by the parent Next.js layout (AppShell).
 */
export default function DashboardLayout({
  children,
  title = "Dashboard",
  showTitle = true,
  showHeader = true,
  headerClassName,
  hasSidebarTrigger = true,
  headerLeftAction,
  headerExtra,
  headerActions,
  noTransition = false,
}: DashboardLayoutProps) {
  return (
    <>
      {showHeader && (
        <div className={headerClassName}>
          <Header
            title={showTitle ? title : undefined}
            hasSidebarTrigger={hasSidebarTrigger}
            leftAction={headerLeftAction}
            actions={headerActions}
            extra={headerExtra}
          />
        </div>
      )}
      <div
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-90" />
        <div
          className={`dashboard-content relative flex min-w-0 flex-col flex-1 overflow-hidden ${
            noTransition ? "" : "animate-page-enter"
          }`}
        >
          {children}
        </div>
      </div>
    </>
  );
}
