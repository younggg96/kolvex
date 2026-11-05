"use client";

import { ReactNode } from "react";
import OpinionSourceNav from "./OpinionSourceNav";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  breadcrumb?: ReactNode;
  /** Disable page transition animation */
  noTransition?: boolean;
}

/** Page content and an optional breadcrumb; actions live in the page content. */
export default function DashboardLayout({
  children,
  title,
  breadcrumb,
  noTransition = false,
}: DashboardLayoutProps) {

  return (
    <section aria-label={title} className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className={`dashboard-content relative flex min-w-0 flex-1 flex-col overflow-hidden ${
          noTransition ? "" : "animate-page-enter"
        }`}
      >
        <OpinionSourceNav />
        {breadcrumb && (
          <div className="flex min-w-0 shrink-0 items-center px-[16px] py-4 md:px-8">
            {breadcrumb}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
