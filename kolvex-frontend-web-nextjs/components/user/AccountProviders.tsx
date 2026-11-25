"use client";

import type { ReactNode } from "react";
import { UserProfileProvider } from "@/components/user/UserProfileProvider";
import { StockDataCacheProvider } from "@/components/portfolio/hooks/useStockDataCache";

/**
 * Signed-in context (profile, holdings cache). Mounted by the layouts that show account
 * UI instead of the root layout, so the anonymous reading pages ship without Supabase Auth.
 */
export function AccountProviders({ children }: { children: ReactNode }) {
  return (
    <UserProfileProvider>
      <StockDataCacheProvider>{children}</StockDataCacheProvider>
    </UserProfileProvider>
  );
}
