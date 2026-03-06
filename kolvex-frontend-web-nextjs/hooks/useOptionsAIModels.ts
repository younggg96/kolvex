"use client";

import { useState, useEffect, useCallback } from "react";
import { getOptionsAIModels } from "@/lib/optionsFlowApi";

/**
 * Hook to fetch available Ollama models for Options AI.
 * Same pattern as useAvailableProviders for Chat: fetches from backend, returns
 * models list. If Ollama is down, returns empty array.
 */
export function useOptionsAIModels() {
  const [models, setModels] = useState<string[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getOptionsAIModels();
      const names = (data.models || []).map((m) => m.name);
      setModels(names);
    } catch (error) {
      console.warn("Failed to load Options AI models:", error);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { models, loading, refresh };
}
