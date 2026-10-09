"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { API_KEYS_CHANGED_EVENT, getAvailableProviders } from "@/lib/api/userApiKeysApi";

/**
 * Hook to fetch which LLM providers the user has configured in Settings.
 * Only user-configured API keys are counted. The chat model dropdown will
 * enable only models for these providers; others stay disabled. If none,
 * the UI shows a "need API key" prompt.
 */
export function useAvailableProviders() {
  const [availableProviders, setAvailableProviders] = useState<
    string[] | undefined
  >(undefined);
  const [loading, setLoading] = useState(true);

  const requestVersion = useRef(0);
  const invalidateRequests = useCallback(() => {
    ++requestVersion.current;
  }, []);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const data = await getAvailableProviders();
      if (version === requestVersion.current) setAvailableProviders(data.available_providers);
    } catch (error) {
      console.warn("Failed to load available providers:", error);
      // Set to empty array (not undefined) so UI knows loading is done but no providers found
      if (version === requestVersion.current) setAvailableProviders([]);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onFocus = () => { void refresh(); };
    void refresh();
    window.addEventListener(API_KEYS_CHANGED_EVENT, onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      invalidateRequests();
      window.removeEventListener(API_KEYS_CHANGED_EVENT, onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, invalidateRequests]);

  return { availableProviders, loading, refresh };
}
