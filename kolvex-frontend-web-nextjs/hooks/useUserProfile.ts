import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
  updateUserTheme,
  updateUserNotifications,
  type UserProfile,
  type UserProfileUpdate,
  type UserNotificationUpdate,
} from "@/lib/api/userApi";

export type { UserProfile, UserProfileUpdate, UserNotificationUpdate };

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getCurrentUserProfile();

      if (result.success && result.data) {
        setProfile(result.data);
      } else {
        setError(result.error || "Failed to load profile");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const updateProfile = useCallback(
    async (updates: UserProfileUpdate) => {
      if (!user?.id) return { success: false, error: "Not authenticated" };

      try {
        const result = await updateCurrentUserProfile(updates);

        if (result.success && result.data) {
          setProfile(result.data);
          return { success: true };
        }

        return { success: false, error: result.error };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
    [user?.id]
  );

  const updateTheme = useCallback(
    async (theme: "LIGHT" | "DARK" | "SYSTEM") => {
      if (!user?.id) return { success: false, error: "Not authenticated" };

      try {
        const result = await updateUserTheme(theme);

        if (result.success && result.data) {
          setProfile(result.data);
          return { success: true };
        }

        return { success: false, error: result.error };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
    [user?.id]
  );

  const updateNotifications = useCallback(
    async (updates: UserNotificationUpdate) => {
      if (!user?.id) return { success: false, error: "Not authenticated" };

      try {
        const result = await updateUserNotifications(updates);

        if (result.success && result.data) {
          setProfile(result.data);
          return { success: true };
        }

        return { success: false, error: result.error };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
    [user?.id]
  );

  return {
    profile,
    isLoading,
    error,
    refresh,
    updateProfile,
    updateTheme,
    updateNotifications,
  };
}
