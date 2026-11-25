"use client";

import type { ComponentProps } from "react";
import { lazyComponent } from "@/components/common/lazyComponent";
import type MarketCompareDialogImpl from "./MarketCompareChartImpl";

/** Opened on demand, so its recharts chunk stays out of the market page's first load. */
const MarketCompareDialog = lazyComponent<ComponentProps<typeof MarketCompareDialogImpl>>(
  () => import("./MarketCompareChartImpl").then((module) => module.default),
  () => null,
);

export default MarketCompareDialog;
