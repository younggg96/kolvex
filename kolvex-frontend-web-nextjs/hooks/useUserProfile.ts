import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import type { UserProfile as DBUserProfile, ProfileUpdate } from "@/lib/supabase/database.types";

export interface UserProfile extends DBUserProfile {}

export interface UserProfileUpdate extends ProfileUpdate {}

export interface UserNotificationUpdate {
  notification_method?: "EMAIL" | "MESSAGE";
}

interface UseUserProfileReturn {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (updates: UserProfileUpdate) => Promise<boolean>;
  updateNotifications: (updates: UserNotificationUpdate) => Promise<boolean>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

/**
 * Custom hook for user profile management
 *
 * Usage:
 * ```typescript
 * const { profile, isLoading, updateProfile } = useUserProfile();
 * ```
 */
export function useUserProfile(): UseUserProfileReturn {
  const { user, session, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated || !session?.access_token) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/users/me`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        // If 404, profile might not exist yet - that's okay
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
      setIsLoading(false);
    }
  }, [isAuthenticated, session?.access_token]);

  const updateProfile = useCallback(
    async (updates: UserProfileUpdate): Promise<boolean> => {
      if (!isAuthenticated || !session?.access_token) {
        return false;
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
          throw new Error("Failed to update profile");
        }

        const data = await response.json();
        setProfile(data);
        return true;
      } catch (err) {
        console.error("Error updating profile:", err);
        return false;
      }
    },
    [isAuthenticated, session?.access_token]
  );

  const updateNotifications = useCallback(
    async (updates: UserNotificationUpdate): Promise<boolean> => {
      if (!isAuthenticated || !session?.access_token) {
        return false;
      }

      try {
        const response = await fetch(`${API_BASE_URL}${API_PREFIX}/users/me/notifications`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error("Failed to update notification settings");
        }

        const data = await response.json();
        setProfile(data);
        return true;
      } catch (err) {
        console.error("Error updating notifications:", err);
        return false;
      }
    },
    [isAuthenticated, session?.access_token]
  );

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    refresh: fetchProfile,
    updateProfile,
    updateNotifications,
  };
}

