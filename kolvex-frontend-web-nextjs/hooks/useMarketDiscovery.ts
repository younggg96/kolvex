"use client";

import { useEffect, useRef } from "react";
import { currentMarketDiscovery, fetchMarketDiscovery } from "@/lib/marketDiscovery";
import { useCachedResource } from "./useCachedResource";
import { useVisiblePolling } from "./useVisiblePolling";

export function useMarketDiscovery(enabled: boolean, refreshToken = 0) {
  const resource = useCachedResource("/api/market/discovery", fetchMarketDiscovery, {
    enabled, ttl: 60_000, maxAge: 15 * 60_000, timeout: 30_000,
  });
  const { refresh, revalidate } = resource;
  useVisiblePolling(revalidate, 60_000, enabled);
  const lastToken = useRef(refreshToken);
  useEffect(() => {
    if (enabled && lastToken.current !== refreshToken) {
      lastToken.current = refreshToken;
      refresh();
    }
  }, [enabled, refreshToken, refresh]);
  return { ...resource, data: currentMarketDiscovery(resource.data) };
}
