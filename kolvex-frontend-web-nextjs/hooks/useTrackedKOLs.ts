import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import type { Platform } from "@/lib/supabase/database.types";

export interface TrackedKOL {
  id: string;
  user_id: string;
  platform: Platform;
  kol_id: string;
  notify: boolean;
  created_at: string;
  updated_at: string;
  // KOL profile info (joined from backend or fetched separately)
  kol_name?: string;
  kol_username?: string;
  kol_avatar_url?: string;
  kol_bio?: string;
  kol_followers_count?: number;
  kol_verified?: boolean;
  kol_influence_score?: number;
  kol_trending_score?: number;
}

interface UseTrackedKOLsReturn {
  trackedKOLs: TrackedKOL[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  trackKOL: (
    kolId: string,
    platform: Platform,
    notify?: boolean
  ) => Promise<boolean>;
  untrackKOL: (kolId: string, platform: Platform) => Promise<boolean>;
  isTracking: (kolId: string, platform: Platform) => boolean;
}

/**
 * Custom hook for managing tracked KOLs
 *
 * Usage:
 * ```typescript
 * const { trackedKOLs, isLoading, trackKOL, untrackKOL } = useTrackedKOLs();
 * ```
 */
export function useTrackedKOLs(): UseTrackedKOLsReturn {
  const { user, isAuthenticated } = useAuth();
  const [trackedKOLs, setTrackedKOLs] = useState<TrackedKOL[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrackedKOLs = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setTrackedKOLs([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch from API to get enriched data with KOL profiles
      const response = await fetch("/api/my-tracked-kols", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setTrackedKOLs([]);
          setIsLoading(false);
          return;
        }
        throw new Error("Failed to fetch tracked KOLs");
      }

      const data = await response.json();
      const mappedData: TrackedKOL[] = (data.tracked_kols || []).map(
        (item: any) => ({
          id: item.id,
          user_id: item.user_id,
          platform: item.platform,
          kol_id: item.kol_id,
          notify: item.notify,
          created_at: item.created_at,
          updated_at: item.updated_at || item.created_at,
          kol_name: item.kol_name,
          kol_username: item.kol_username || item.kol_id,
          kol_avatar_url: item.kol_avatar_url,
          kol_bio: item.kol_bio,
          kol_followers_count: item.kol_followers_count,
          kol_verified: item.kol_verified,
          kol_influence_score: item.kol_influence_score,
          kol_trending_score: item.kol_trending_score,
        })
      );

      setTrackedKOLs(mappedData);
    } catch (err) {
      console.error("Error fetching tracked KOLs:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setTrackedKOLs([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  const trackKOL = useCallback(
    async (
      kolId: string,
      platform: Platform,
      notify: boolean = true
    ): Promise<boolean> => {
      if (!isAuthenticated || !user?.id) {
        return false;
      }

      try {
        const response = await fetch("/api/my-tracked-kols", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kol_id: kolId,
            platform,
            notify,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to track KOL");
        }

        // Refresh the list to get updated data with KOL info
        await fetchTrackedKOLs();
        return true;
      } catch (err) {
        console.error("Error tracking KOL:", err);
        return false;
      }
    },
    [isAuthenticated, user?.id, fetchTrackedKOLs]
  );

  const untrackKOL = useCallback(
    async (kolId: string, platform: Platform): Promise<boolean> => {
      if (!isAuthenticated || !user?.id) {
        return false;
      }

      try {
        const url = new URL("/api/my-tracked-kols", window.location.origin);
        url.searchParams.set("kol_id", kolId);
        url.searchParams.set("platform", platform);

        const response = await fetch(url.toString(), {
          method: "DELETE",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to untrack KOL");
        }

        // Update local state
        setTrackedKOLs((prev) =>
          prev.filter(
            (kol) => !(kol.kol_id === kolId && kol.platform === platform)
          )
        );
        return true;
      } catch (err) {
        console.error("Error untracking KOL:", err);
        return false;
      }
    },
    [isAuthenticated, user?.id]
  );

  const isTracking = useCallback(
    (kolId: string, platform: Platform): boolean => {
      return trackedKOLs.some(
        (kol) => kol.kol_id === kolId && kol.platform === platform
      );
    },
    [trackedKOLs]
  );

  useEffect(() => {
    fetchTrackedKOLs();
  }, [fetchTrackedKOLs]);

  return {
    trackedKOLs,
    isLoading,
    error,
    refresh: fetchTrackedKOLs,
    trackKOL,
    untrackKOL,
    isTracking,
  };
}
