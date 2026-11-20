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
    // overflow-clip, not hidden: a hidden box can still be scrolled by focus or
    // scrollIntoView, which would slide the whole page out of view. Clip is not a
    // scroll container, so min-h-0 has to be explicit for the flex child to shrink.
    <section
      aria-label={title}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-clip"
    >
      <div
        className={`dashboard-content relative flex min-w-0 flex-1 flex-col overflow-clip ${
          noTransition ? "" : "animate-page-enter"
        }`}
      >
        <HeaderBackProvider register={headerActive ? register : null}>
          <OpinionSourceNav back={back} />
          {/* With the phone header, its back button replaces this row below md. */}
          {breadcrumb && (
            <div
              data-header-back={headerActive || undefined}
              className="flex min-w-0 shrink-0 items-center px-[16px] py-1 md:px-8 md:py-4"
            >
              {breadcrumb}
            </div>
          )}
          {children}
        </HeaderBackProvider>
      </div>
    </section>
  );
}
