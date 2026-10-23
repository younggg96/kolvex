"use client";

import { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  headerLeftAction?: ReactNode;
  headerExtra?: ReactNode;
  headerActions?: ReactNode;
  /** Disable page transition animation */
  noTransition?: boolean;
}

/** Page content and optional inline actions; AppShell owns navigation. */
export default function DashboardLayout({
  children,
  title,
  headerLeftAction,
  headerExtra,
  headerActions,
  noTransition = false,
}: DashboardLayoutProps) {
  const hasActions = Boolean(headerLeftAction || headerExtra || headerActions);

  return (
    <section aria-label={title} className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-[0.12] dark:opacity-90" />
      <div
        className={`dashboard-content relative flex min-w-0 flex-1 flex-col overflow-hidden ${
          noTransition ? "" : "animate-page-enter"
        }`}
      >
        {hasActions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-4 md:px-8">
            {headerLeftAction}
            {headerExtra}
            {headerActions && (
              <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center gap-2 [&>*]:shrink-0">
                {headerActions}
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
