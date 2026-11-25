"use client";

import { lazyComponent } from "@/components/common/lazyComponent";
import type { DonutChartProps } from "./types";

/** recharts loads after hydration; the square placeholder matches the chart's footprint. */
export const DonutChart = lazyComponent<DonutChartProps>(
  () => import("./DonutChartImpl").then((module) => module.DonutChart),
  () => <div className="relative aspect-square w-full" aria-hidden="true" />,
);

export default DonutChart;
