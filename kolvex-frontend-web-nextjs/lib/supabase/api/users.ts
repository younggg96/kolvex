// User-related API functions
import { createClient } from "../client";
import type { Theme, ProfileUpdate } from "../database.types";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Update user theme preference
 */
export async function updateTheme(
  userId: string,
  theme: Theme
): Promise<ApiResponse> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("user_profiles")
      .update({ theme })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Update theme error:", error);
    return { success: false, error: error.message };
  }
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

