"use client";

import { useCopy } from "@/components/decision/shared";
import type { ActivitySession } from "@/lib/optionsActivity";

// Kept apart from sections.tsx so pages that only need the label do not pull in recharts.
export function useSessionLabel() {
  const c = useCopy();
  return (session: ActivitySession) =>
    ({
      pre: c("Pre-market", "盘前"),
      intraday: c("Midday", "盘中"),
      post: c("After close", "盘后"),
    })[session];
}
