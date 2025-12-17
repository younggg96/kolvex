// User-related API functions - Re-export from new API module
// Legacy file kept for backward compatibility

// Re-export all user API functions from new location
export {
  getUserProfile,
  getCurrentUserProfile,
  updateUserProfile,
  updateTheme,
  updateNotificationSettings,
  type UserProfile,
} from "@/lib/api/users";

import { createClient } from "../client";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Update stock tracking for a user
 */
export async function updateStockTracking(
  userId: string,
  symbols: string[]
): Promise<ApiResponse> {
  try {
    const supabase = createClient();

    // First, get existing tracked stocks
    const { data: existingStocks, error: fetchError } = await supabase
      .from("stock_tracking")
      .select("symbol")
      .eq("user_id", userId);

    if (fetchError) throw fetchError;

    const existingSymbols = new Set(
      existingStocks?.map((s) => s.symbol) || []
    );
    const newSymbols = symbols.filter((symbol) => !existingSymbols.has(symbol));

    // Insert new stocks
    if (newSymbols.length > 0) {
      const { error: insertError } = await supabase
        .from("stock_tracking")
        .insert(
          newSymbols.map((symbol) => ({
            user_id: userId,
            symbol,
          }))
        );

      if (insertError) throw insertError;
    }

    return { success: true };
  } catch (error: any) {
    console.error("Update stock tracking error:", error);
    return { success: false, error: error.message };
  }
}

