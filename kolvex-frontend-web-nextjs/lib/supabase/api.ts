// API functions - Re-export from new API module
// Legacy file kept for backward compatibility
import { createClient } from "./client";
import type { Platform } from "./database.types";

// Re-export from new API module
export {
  updateUserProfile,
  updateNotificationSettings,
  getUserProfile,
  getCurrentUserProfile,
  updateTheme,
} from "@/lib/api/users";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
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

