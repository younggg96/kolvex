/**
 * Hooks for KOL data fetching
 */
import { useCallback } from 'react';
import { useApi, usePaginatedApi } from './useApi';
import { kolPostsApi, kolSubscriptionApi } from '@/lib/api';
import type { KOLProfile, KOLProfilesResponse, KOLPost, KOLPostsResponse, Platform } from '@/lib/types';

/** Fetch KOL profiles list */
export function useKOLProfiles(platform?: Platform) {
  const fetcher = useCallback(
    () => kolPostsApi.getProfiles(platform ? { platform } : undefined),
    [platform]
  );
  return useApi<KOLProfilesResponse>(fetcher, { deps: [platform] });
}

/** Fetch a single KOL profile */
export function useKOLProfile(username: string) {
  const fetcher = useCallback(() => kolPostsApi.getProfile(username), [username]);
  return useApi<KOLProfile>(fetcher, { deps: [username] });
}

/** Fetch KOL posts with pagination */
export function useKOLPosts(params?: { platform?: Platform; username?: string; sentiment?: string; ticker?: string; search?: string; pageSize?: number }) {
  const { pageSize: customPageSize, ...apiParams } = params || {};
  const fetcher = useCallback(
    (page: number, pageSize: number) =>
      kolPostsApi.getPosts({
        page,
        page_size: pageSize,
        ...apiParams,
      }).then(res => ({
        items: res.posts,
        total: res.total,
        hasMore: res.has_more,
      })),
    [apiParams?.platform, apiParams?.username, apiParams?.sentiment, apiParams?.ticker, apiParams?.search]
  );
  return usePaginatedApi<KOLPost>(fetcher, { pageSize: customPageSize || 20 });
}

/** Fetch posts by a specific KOL user */
export function useKOLUserPosts(username: string, platform?: Platform) {
  const fetcher = useCallback(
    (page: number, pageSize: number) =>
      kolPostsApi.getUserPosts(username, { page, page_size: pageSize, platform }).then(res => ({
        items: res.posts,
        total: res.total,
        hasMore: res.has_more,
      })),
    [username, platform]
  );
  return usePaginatedApi<KOLPost>(fetcher, { pageSize: 15 });
}

/** Check if a KOL is tracked/subscribed */
export function useKOLTrackedCheck(username: string, platform: Platform) {
  const fetcher = useCallback(
    () => kolSubscriptionApi.checkTracked(username, platform),
    [username, platform]
  );
  return useApi<{ is_tracked: boolean }>(fetcher, { deps: [username, platform] });
}

/** Fetch user's tracked KOLs */
export function useTrackedKOLs() {
  const fetcher = useCallback(() => kolSubscriptionApi.getTracked(), []);
  return useApi(fetcher);
}
