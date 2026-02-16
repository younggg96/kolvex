import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import type { UserProfile, Theme, UserLocale } from "@/lib/supabase/database.types";

export interface UserProfileUpdate {
  username?: string;
  full_name?: string;
  avatar_url?: string;
  phone_e164?: string;
}

export interface NotificationUpdate {
  email_notifications_enabled?: boolean;
}

interface ApiResult {
  success: boolean;
  data?: UserProfile;
  error?: string;
}

/**
 * Hook to get and manage current user profile
 * Uses global UserProfileContext to avoid redundant API calls
 */
export function useCurrentUserProfile() {
  const {
    profile,
    isLoading,
    error,
    refresh,
    updateProfile: contextUpdateProfile,
    updateNotifications: contextUpdateNotifications,
  } = useUserProfileContext();

  const updateProfile = async (
    updates: UserProfileUpdate
  ): Promise<ApiResult> => {
    const success = await contextUpdateProfile(updates);
    if (success) {
      return { success: true, data: profile || undefined };
    }
    return { success: false, error: "Failed to update profile" };
  };

  const updateTheme = async (theme: Theme): Promise<ApiResult> => {
    try {
      const response = await fetch("/api/users/me/theme", {
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
      // Refresh profile to get updated data
      await refresh();
      return { success: true, data };
    } catch (err) {
      console.error("Error updating theme:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "An error occurred",
      };
    }
  };

  const updateLocale = async (locale: UserLocale): Promise<ApiResult> => {
    try {
      const response = await fetch("/api/users/me/locale", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update locale");
      }

      const data = await response.json();
      await refresh();
      return { success: true, data };
    } catch (err) {
      console.error("Error updating locale:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "An error occurred",
      };
    }
  };

  const updateNotifications = async (
    settings: NotificationUpdate
  ): Promise<ApiResult> => {
    const success = await contextUpdateNotifications({
      email_notifications_enabled: settings.email_notifications_enabled,
    });
    if (success) {
      return { success: true, data: profile || undefined };
    }
    return { success: false, error: "Failed to update notification settings" };
  };

  return {
    profile,
    loading: isLoading,
    error,
    refetch: refresh,
    updateProfile,
    updateTheme,
    updateLocale,
    updateNotifications,
  };
}

/**
 * Update user theme (standalone function)
 */
export async function updateUserTheme(theme: Theme): Promise<ApiResult> {
  try {
    const response = await fetch("/api/users/me/theme", {
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
  } catch (err) {
    console.error("Error updating theme:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An error occurred",
    };
  }
}

/**
 * Update user notification settings (standalone function)
 */
export async function updateUserNotifications(
  settings: NotificationUpdate
): Promise<ApiResult> {
  try {
    const response = await fetch("/api/users/me/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || "Failed to update notification settings"
      );
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    console.error("Error updating notifications:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An error occurred",
    };
  }
}
