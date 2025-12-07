import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks";
import type {
  UserProfile,
  Theme,
  NotificationMethod,
} from "@/lib/supabase/database.types";

export interface UserProfileUpdate {
  username?: string;
  full_name?: string;
  avatar_url?: string;
  phone_e164?: string;
  is_subscribe_newsletter?: boolean;
}

export interface NotificationUpdate {
  is_subscribe_newsletter?: boolean;
  notification_method?: NotificationMethod;
}

interface ApiResult {
  success: boolean;
  data?: UserProfile;
  error?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

/**
 * Hook to get and manage current user profile
 */
export function useCurrentUserProfile() {
  const { user, session, isAuthenticated, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated || !session?.access_token) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/users/me`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          setProfile(null);
          return;
        }
        throw new Error("Failed to fetch profile");
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, session?.access_token]);

  const updateProfile = useCallback(
    async (updates: UserProfileUpdate): Promise<ApiResult> => {
      if (!isAuthenticated || !session?.access_token) {
        return { success: false, error: "Not authenticated" };
      }

      try {
        const response = await fetch(`${API_BASE_URL}${API_PREFIX}/users/me`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to update profile");
        }

        const data = await response.json();
        setProfile(data);
        return { success: true, data };
      } catch (err) {
        console.error("Error updating profile:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "An error occurred",
        };
      }
    },
    [isAuthenticated, session?.access_token]
  );

  const updateTheme = useCallback(
    async (theme: Theme): Promise<ApiResult> => {
      if (!isAuthenticated || !session?.access_token) {
        return { success: false, error: "Not authenticated" };
      }

      try {
        const response = await fetch(`${API_BASE_URL}${API_PREFIX}/users/me/theme`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ theme }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to update theme");
        }

        const data = await response.json();
        setProfile(data);
        return { success: true, data };
      } catch (err) {
        console.error("Error updating theme:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "An error occurred",
        };
      }
    },
    [isAuthenticated, session?.access_token]
  );

  const updateNotifications = useCallback(
    async (settings: NotificationUpdate): Promise<ApiResult> => {
      if (!isAuthenticated || !session?.access_token) {
        return { success: false, error: "Not authenticated" };
      }

      try {
        const response = await fetch(`${API_BASE_URL}${API_PREFIX}/users/me/notifications`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settings),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || "Failed to update notification settings"
          );
        }

        const data = await response.json();
        setProfile(data);
        return { success: true, data };
      } catch (err) {
        console.error("Error updating notifications:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "An error occurred",
        };
      }
    },
    [isAuthenticated, session?.access_token]
  );

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
  }, [fetchProfile, authLoading]);

  return {
    profile,
    loading: loading || authLoading,
    error,
    refetch: fetchProfile,
    updateProfile,
    updateTheme,
    updateNotifications,
  };
}

/**
 * Update user theme (standalone function)
 */
export async function updateUserTheme(
  accessToken: string,
  theme: Theme
): Promise<ApiResult> {
  try {
    const response = await fetch(`${API_BASE_URL}${API_PREFIX}/users/me/theme`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ theme }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to update theme");
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
  accessToken: string,
  settings: NotificationUpdate
): Promise<ApiResult> {
  try {
    const response = await fetch(`${API_BASE_URL}${API_PREFIX}/users/me/notifications`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || "Failed to update notification settings"
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

