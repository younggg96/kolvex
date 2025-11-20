import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import type { UserProfile } from "@/lib/supabase/database.types";

// Mock profile
const MOCK_PROFILE: UserProfile = {
  id: "mock-user-123",
  email: "demo@example.com",
  username: "demouser",
  full_name: "Demo User",
  avatar_url: "https://i.pravatar.cc/150?img=10",
  membership: "FREE",
  theme: "SYSTEM",
  is_subscribe_newsletter: false,
  notification_method: "EMAIL",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) {
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Simulate loading delay
        await new Promise((resolve) => setTimeout(resolve, 300));
        
        // Return mock profile
        setProfile(MOCK_PROFILE);
      } catch (err) {
        setError("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [user?.id]);

  const refresh = async () => {
    if (!user?.id) return;

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setProfile(MOCK_PROFILE);
    } catch (err) {
      setError("Failed to refresh profile");
    }
  };

  return {
    profile,
    isLoading,
    error,
    refresh,
  };
}
