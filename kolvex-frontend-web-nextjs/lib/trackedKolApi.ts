// API functions for tracked KOL operations
import type { Platform } from "@/lib/supabase/database.types";

interface TrackKOLParams {
  kol_id: string;
  platform: Platform;
  notify?: boolean;
}

interface TrackedKOL {
  id: string;
  user_id: string;
  kol_id: string;
  platform: Platform;
  notify: boolean;
  created_at: string;
  updated_at?: string;
  kol_name?: string;
  kol_avatar_url?: string | null;
  kol_username?: string;
  kol_verified?: boolean;
  kol_bio?: string | null;
  kol_followers_count?: number;
  kol_category?: string | null;
  kol_influence_score?: number;
  kol_trending_score?: number;
}

interface TrackedKOLsResponse {
  count: number;
  tracked_kols: TrackedKOL[];
}

/**
 * Track a KOL (add to subscriptions)
 */
export async function trackKOL(params: TrackKOLParams): Promise<void> {
  const response = await fetch("/api/my-tracked-kols", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kol_id: params.kol_id,
      platform: params.platform,
      notify: params.notify ?? true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.detail || "Failed to track KOL");
  }
}

/**
 * Untrack a KOL (remove from subscriptions)
 */
export async function untrackKOL(
  kolId: string,
  platform: Platform
): Promise<void> {
  const url = new URL("/api/my-tracked-kols", window.location.origin);
  url.searchParams.set("kol_id", kolId);
  url.searchParams.set("platform", platform);

  const response = await fetch(url.toString(), {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.detail || "Failed to untrack KOL");
  }
}

/**
 * Check if a KOL is being tracked
 */
export async function isKOLTracked(
  kolId: string,
  platform: Platform
): Promise<boolean> {
  try {
    const response = await fetch(`/api/my-tracked-kols?platform=${platform}`);

    if (!response.ok) {
      return false;
    }

    const data: TrackedKOLsResponse = await response.json();
    return data.tracked_kols.some(
      (kol) => kol.kol_id === kolId && kol.platform === platform
    );
  } catch {
    return false;
  }
}

/**
 * Get all tracked KOLs for current user
 */
export async function getTrackedKOLs(
  platform?: Platform
): Promise<TrackedKOL[]> {
  const url = new URL("/api/my-tracked-kols", window.location.origin);
  if (platform) {
    url.searchParams.set("platform", platform);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || error.detail || "Failed to get tracked KOLs"
    );
  }

  const data: TrackedKOLsResponse = await response.json();
  return data.tracked_kols || [];
}

/**
 * Update notification setting for a tracked KOL
 */
export async function updateKOLNotification(
  kolId: string,
  platform: Platform,
  notify: boolean
): Promise<void> {
  const response = await fetch("/api/my-tracked-kols", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kol_id: kolId,
      platform: platform,
      notify: notify,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error || error.detail || "Failed to update KOL notification"
    );
  }
}
