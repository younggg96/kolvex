import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { createClient } from "@/lib/supabase/client";
import type { Platform } from "@/lib/supabase/database.types";

export interface TrackedKOL {
  id: string;
  user_id: string;
  platform: Platform;
  kol_id: string;
  notify: boolean;
  created_at: string;
  updated_at: string;
  // Creator profile info (joined from backend or fetched separately)
  creator_name?: string;
  creator_username?: string;
  creator_avatar_url?: string;
  creator_bio?: string;
  creator_followers_count?: number;
  creator_verified?: boolean;
  creator_influence_score?: number;
  creator_trending_score?: number;
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

      // Fetch from API to get enriched data with creator profiles
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
          creator_name: item.creator_name,
          creator_username: item.creator_username || item.kol_id,
          creator_avatar_url: item.creator_avatar_url,
          creator_bio: item.creator_bio,
          creator_followers_count: item.creator_followers_count,
          creator_verified: item.creator_verified,
          creator_influence_score: item.creator_influence_score,
          creator_trending_score: item.creator_trending_score,
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
        const supabase = createClient();

        const { error: insertError } = await supabase
          .from("kol_subscriptions")
          .upsert(
            {
              user_id: user.id,
              platform,
              kol_id: kolId,
              notify,
            },
            {
              onConflict: "user_id,platform,kol_id",
            }
          );

        if (insertError) {
          throw insertError;
        }

        // Refresh the list to get updated data with creator info
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
        const supabase = createClient();

        const { error: deleteError } = await supabase
          .from("kol_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("platform", platform)
          .eq("kol_id", kolId);

        if (deleteError) {
          throw deleteError;
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
