// API functions for Supabase operations
import { createClient } from "./client";
import type { NotificationSettings, ProfileUpdate, Platform } from "./database.types";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<ApiResponse> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("user_profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Update profile error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(
  userId: string,
  settings: NotificationSettings
): Promise<ApiResponse> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("user_profiles")
      .update(settings)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Update notification settings error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Add KOL subscription
 */
export async function addKOL(params: {
  user_id: string;
  platform: Platform;
  kol_id: string;
  notify: boolean;
}): Promise<ApiResponse> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("kol_subscriptions")
      .upsert(
        {
          user_id: params.user_id,
          platform: params.platform,
          kol_id: params.kol_id,
          notify: params.notify,
        },
        {
          onConflict: "user_id,platform,kol_id",
        }
      )
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Add KOL error:", error);
    return { success: false, error: error.message };
  }
}

