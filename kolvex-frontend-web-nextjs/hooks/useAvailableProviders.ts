"use client";

import { useState, useEffect, useCallback } from "react";
import { getAvailableProviders } from "@/lib/api/userApiKeysApi";

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

  const refresh = useCallback(async () => {
    try {
      const data = await getAvailableProviders();
      setAvailableProviders(data.available_providers);
    } catch (error) {
      console.warn("Failed to load available providers:", error);
      // Set to empty array (not undefined) so UI knows loading is done but no providers found
      setAvailableProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { availableProviders, loading, refresh };
}
