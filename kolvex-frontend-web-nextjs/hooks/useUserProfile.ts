import {
  useUserProfileContext,
  type UserProfile,
  type UserProfileUpdate,
} from "@/components/user/UserProfileProvider";

export type { UserProfile, UserProfileUpdate };

interface UseUserProfileReturn {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (updates: UserProfileUpdate) => Promise<boolean>;
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
