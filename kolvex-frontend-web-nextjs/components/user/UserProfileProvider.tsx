"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import type {
  UserProfile as DBUserProfile,
  ProfileUpdate,
} from "@/lib/supabase/database.types";

export interface UserProfile extends DBUserProfile {}

export interface UserProfileUpdate extends ProfileUpdate {}

export interface UserNotificationUpdate {
  notification_method?: "EMAIL" | "MESSAGE";
}

interface UserProfileContextValue {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (updates: UserProfileUpdate) => Promise<boolean>;
  updateNotifications: (updates: UserNotificationUpdate) => Promise<boolean>;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

interface UserProfileProviderProps {
  children: ReactNode;
}

export function UserProfileProvider({ children }: UserProfileProviderProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/users/me", {
        headers: {
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
      setHasFetched(true);
    }
  }, [isAuthenticated]);

  const updateProfile = useCallback(
    async (updates: UserProfileUpdate): Promise<boolean> => {
      if (!isAuthenticated) {
        return false;
      }

      try {
        const response = await fetch("/api/users/me", {
          method: "PUT",
          headers: {
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
    [isAuthenticated]
  );

  const updateNotifications = useCallback(
    async (updates: UserNotificationUpdate): Promise<boolean> => {
      if (!isAuthenticated) {
        return false;
      }

      try {
        const response = await fetch("/api/users/me/notifications", {
          method: "PATCH",
          headers: {
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
    [isAuthenticated]
  );

  // 只在认证状态确定后且未获取过数据时获取
  useEffect(() => {
    if (!authLoading && !hasFetched) {
      fetchProfile();
    }
  }, [authLoading, hasFetched, fetchProfile]);

  // 当用户登出时重置状态
  useEffect(() => {
    if (!isAuthenticated && hasFetched) {
      setProfile(null);
      setHasFetched(false);
    }
  }, [isAuthenticated, hasFetched]);

  const value: UserProfileContextValue = {
    profile,
    isLoading: isLoading || authLoading,
    error,
    refresh: fetchProfile,
    updateProfile,
    updateNotifications,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfileContext(): UserProfileContextValue {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error(
      "useUserProfileContext must be used within a UserProfileProvider"
    );
  }
  return context;
}

