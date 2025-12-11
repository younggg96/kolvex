import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import type {
  UserProfile as DBUserProfile,
  ProfileUpdate,
} from "@/lib/supabase/database.types";

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

/**
 * Custom hook for user profile management
 * Uses global UserProfileContext to avoid redundant API calls
 *
 * Usage:
 * ```typescript
 * const { profile, isLoading, updateProfile } = useUserProfile();
 * ```
 */
export function useUserProfile(): UseUserProfileReturn {
  return useUserProfileContext();
}
