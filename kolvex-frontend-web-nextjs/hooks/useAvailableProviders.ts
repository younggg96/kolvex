"use client";

import { useState, useEffect, useCallback } from "react";
import { getAvailableProviders } from "@/lib/api/userApiKeysApi";

/**
 * Hook to fetch which LLM providers have usable API keys.
 * Returns provider IDs (e.g. "openai", "anthropic") that have keys configured
 * either at the server level or by the user.
 */
export function useAvailableProviders() {
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getAvailableProviders();
      setAvailableProviders(data.available_providers);
    } catch (error) {
      console.warn("Failed to load available providers:", error);
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
