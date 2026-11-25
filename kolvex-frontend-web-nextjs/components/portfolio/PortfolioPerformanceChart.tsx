"use client";

import type { ComponentProps } from "react";
import { lazyComponent } from "@/components/common/lazyComponent";
import { Skeleton } from "@/components/ui/skeleton";
import type { PortfolioPerformanceChart as Impl } from "./PortfolioPerformanceChartImpl";

/** recharts loads after hydration; the skeleton reserves the header plus the plot height. */
export const PortfolioPerformanceChart = lazyComponent<ComponentProps<typeof Impl>>(
  () =>
    import("./PortfolioPerformanceChartImpl").then((module) => module.PortfolioPerformanceChart),
  ({ height = 260, className }) => (
    <div className={className} aria-hidden="true">
      <Skeleton className="h-14 w-48 rounded-lg" />
      <Skeleton className="mt-4 w-full rounded-xl" style={{ height }} />
    </div>
  ),
);
