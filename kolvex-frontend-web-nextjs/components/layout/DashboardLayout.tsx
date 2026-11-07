"use client";

import { ReactNode } from "react";
import OpinionSourceNav, { useOpinionHeaderActive } from "./OpinionSourceNav";
import { HeaderBackProvider, useHeaderBackState } from "./headerBack";

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
  const headerActive = useOpinionHeaderActive();
  const { back, register } = useHeaderBackState();

  return (
    <section aria-label={title} className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className={`dashboard-content relative flex min-w-0 flex-1 flex-col overflow-hidden ${
          noTransition ? "" : "animate-page-enter"
        }`}
      >
        <HeaderBackProvider register={headerActive ? register : null}>
          <OpinionSourceNav back={back} />
          {/* With the phone header, its back button replaces this row below md. */}
          {breadcrumb && (
            <div data-header-back={headerActive || undefined} className="flex min-w-0 shrink-0 items-center px-[16px] py-1 md:px-8 md:py-4">
              {breadcrumb}
            </div>
          )}
          {children}
        </HeaderBackProvider>
      </div>
    </section>
  );
}
