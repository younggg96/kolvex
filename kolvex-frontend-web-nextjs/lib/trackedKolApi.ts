// API functions for tracked KOL operations
import { createClient } from "@/lib/supabase/client";
import type { Platform } from "@/lib/supabase/database.types";

interface TrackKOLParams {
  kol_id: string;
  platform: Platform;
  notify?: boolean;
}

/**
 * Track a KOL (add to subscriptions)
 */
export async function trackKOL(params: TrackKOLParams): Promise<void> {
  const supabase = createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  const { error } = await supabase.from("kol_subscriptions").upsert(
    {
      user_id: user.id,
      platform: params.platform,
      kol_id: params.kol_id,
      notify: params.notify ?? true,
    },
    {
      onConflict: "user_id,platform,kol_id",
    }
  );

  if (error) {
    console.error("Track KOL error:", error);
    throw new Error(error.message);
  }
}

/**
 * Untrack a KOL (remove from subscriptions)
 */
export async function untrackKOL(
  kolId: string,
  platform: Platform
): Promise<void> {
  const supabase = createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  const { error } = await supabase
    .from("kol_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", platform)
    .eq("kol_id", kolId);

  if (error) {
    console.error("Untrack KOL error:", error);
    throw new Error(error.message);
  }
}

/**
 * Check if a KOL is being tracked
 */
export async function isKOLTracked(
  kolId: string,
  platform: Platform
): Promise<boolean> {
  const supabase = createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return false;
  }

  const { data, error } = await supabase
    .from("kol_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .eq("kol_id", kolId)
    .single();

  if (error) {
    return false;
  }

  return !!data;
}

/**
 * Get all tracked KOLs for current user
 */
export async function getTrackedKOLs(platform?: Platform): Promise<any[]> {
  const supabase = createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  let query = supabase
    .from("kol_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Get tracked KOLs error:", error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Update notification setting for a tracked KOL
 */
export async function updateKOLNotification(
  kolId: string,
  platform: Platform,
  notify: boolean
): Promise<void> {
  const supabase = createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  const { error } = await supabase
    .from("kol_subscriptions")
    .update({ notify })
    .eq("user_id", user.id)
    .eq("platform", platform)
    .eq("kol_id", kolId);

  if (error) {
    console.error("Update KOL notification error:", error);
    throw new Error(error.message);
  }
}

