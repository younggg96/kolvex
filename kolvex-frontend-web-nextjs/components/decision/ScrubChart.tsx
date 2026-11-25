"use client";

import type { ComponentProps } from "react";
import { lazyComponent } from "@/components/common/lazyComponent";
import type ScrubChartImpl from "./ScrubChartImpl";

export type { ScrubPoint } from "./ScrubChartImpl";

/** recharts loads after hydration; the placeholder holds the chart's height. */
const ScrubChart = lazyComponent<ComponentProps<typeof ScrubChartImpl>>(
  () => import("./ScrubChartImpl").then((module) => module.default),
  ({ height = 220 }) => <div aria-hidden="true" style={{ height }} />,
);

export default ScrubChart;
