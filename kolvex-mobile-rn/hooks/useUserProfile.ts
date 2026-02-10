/**
 * Hook for user profile data
 */
import { useCallback } from 'react';
import { useApi } from './useApi';
import { userApi, notificationApi } from '@/lib/api';
import type { UserProfile, NotificationsResponse } from '@/lib/types';

/** Fetch current user profile from backend */
export function useUserProfile() {
  const fetcher = useCallback(() => userApi.getProfile(), []);
  const result = useApi<UserProfile>(fetcher);

  const updateProfile = useCallback(async (data: Partial<Pick<UserProfile, 'username' | 'display_name' | 'bio' | 'avatar_url'>>) => {
    const updated = await userApi.updateProfile(data);
    result.setData(updated);
    return updated;
  }, [result]);

  const updateTheme = useCallback(async (theme: 'LIGHT' | 'DARK' | 'SYSTEM') => {
    const updated = await userApi.updateTheme(theme);
    result.setData(updated);
    return updated;
  }, [result]);

  return {
    ...result,
    updateProfile,
    updateTheme,
  };
}

/** Fetch notifications */
export function useNotifications() {
  const fetcher = useCallback(() => notificationApi.getNotifications(), []);
  return useApi<NotificationsResponse>(fetcher);
}

/** Fetch unread notification count */
export function useUnreadNotificationCount() {
  const fetcher = useCallback(() => notificationApi.getUnreadCount(), []);
  return useApi<{ count: number }>(fetcher);
}
