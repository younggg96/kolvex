/**
 * User API client functions
 * All calls go through Next.js API routes -> FastAPI backend
 */

import type { Theme, ProfileUpdate, NotificationSettings } from "@/lib/supabase/database.types";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UserProfile {
  id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  email?: string;
  phone_e164?: string;
  theme?: Theme;
  notification_method?: string;
  is_subscribe_newsletter?: boolean;
  created_at?: string;
  updated_at?: string;
}

const API_BASE = "/api/users";

/**
 * Get user profile by ID (public)
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const response = await fetch(`${API_BASE}/${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error("Failed to fetch user profile");
    }

    return await response.json();
  } catch (error) {
    console.error("Get user profile error:", error);
    return null;
  }
}

/**
 * Get current user profile (requires auth)
 */
export async function getCurrentUserProfile(): Promise<ApiResponse<UserProfile>> {
  try {
    const response = await fetch(`${API_BASE}/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch profile");
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error("Get current user profile error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update current user profile (requires auth)
 */
export async function updateUserProfile(
  updates: ProfileUpdate
): Promise<ApiResponse<UserProfile>> {
  try {
    const response = await fetch(`${API_BASE}/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to update profile");
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error("Update profile error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user theme preference (requires auth)
 */
export async function updateTheme(theme: Theme): Promise<ApiResponse<UserProfile>> {
  try {
    const response = await fetch(`${API_BASE}/me/theme`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ theme }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to update theme");
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error("Update theme error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update notification settings (requires auth)
 */
export async function updateNotificationSettings(
  settings: Partial<NotificationSettings>
): Promise<ApiResponse<UserProfile>> {
  try {
    const response = await fetch(`${API_BASE}/me/notifications`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to update notification settings");
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error("Update notification settings error:", error);
    return { success: false, error: error.message };
  }
}

