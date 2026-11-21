"use client";

import { useEffect } from "react";
import { API_KEYS_CHANGED_EVENT, getAvailableProviders } from "@/lib/api/userApiKeysApi";
import { useCachedResource } from "./useCachedResource";

/** Only provider availability is cached; API key values never enter the read cache. */
export function useAvailableProviders() {
  const resource = useCachedResource(
    "/api/user-api-keys?action=available-providers",
    getAvailableProviders,
    { ttl: 60_000, maxAge: 60_000 },
  );
  const { refresh, revalidate } = resource;
  useEffect(() => {
    window.addEventListener(API_KEYS_CHANGED_EVENT, refresh);
    window.addEventListener("focus", revalidate);
    return () => {
      window.removeEventListener(API_KEYS_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", revalidate);
    };
  }, [refresh, revalidate]);
  const allowance = resource.data?.free_allowance ?? null;
  return {
    availableProviders: resource.data?.available_providers ?? (resource.loading ? undefined : []),
    // A spent allowance takes the free model out of the picker until the week resets.
    freeModels: allowance?.exhausted ? [] : (resource.data?.free_models ?? []),
    freeAllowance: resource.data?.free_models?.length ? allowance : null,
    loading: resource.loading,
    refresh,
  };
}
