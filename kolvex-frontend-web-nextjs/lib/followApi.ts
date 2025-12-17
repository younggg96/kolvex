/**
 * Follow API Module
 * Client-side API calls for user follow functionality
 */

import type {
  UserFollow,
  FollowStatus,
  FollowListResponse,
} from "@/lib/supabase/database.types";

const API_PREFIX = "/api/users";

/**
 * API request wrapper
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_PREFIX}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// ========== Follow Operations ==========

/**
 * Follow a user
 * @param userId User ID to follow
 */
export async function followUser(userId: string): Promise<UserFollow> {
  return apiRequest<UserFollow>(`/${userId}/follow`, {
    method: "POST",
  });
}

/**
 * Unfollow a user
 * @param userId User ID to unfollow
 */
export async function unfollowUser(
  userId: string
): Promise<{ message: string; success: boolean }> {
  return apiRequest<{ message: string; success: boolean }>(`/${userId}/follow`, {
    method: "DELETE",
  });
}

/**
 * Get follow status for a user
 * @param userId Target user ID
 */
export async function getFollowStatus(userId: string): Promise<FollowStatus> {
  return apiRequest<FollowStatus>(`/${userId}/follow-status`);
}

/**
 * Get followers of a user
 * @param userId Target user ID
 * @param page Page number
 * @param pageSize Number of items per page
 */
export async function getFollowers(
  userId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<FollowListResponse> {
  return apiRequest<FollowListResponse>(
    `/${userId}/followers?page=${page}&page_size=${pageSize}`
  );
}

/**
 * Get users that a user is following
 * @param userId Target user ID
 * @param page Page number
 * @param pageSize Number of items per page
 */
export async function getFollowing(
  userId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<FollowListResponse> {
  return apiRequest<FollowListResponse>(
    `/${userId}/following?page=${page}&page_size=${pageSize}`
  );
}

/**
 * Batch check if current user is following given users
 * @param userIds Array of user IDs to check
 */
export async function batchCheckFollowStatus(
  userIds: string[]
): Promise<Record<string, boolean>> {
  if (userIds.length === 0) {
    return {};
  }
  const params = userIds.map((id) => `user_ids=${id}`).join("&");
  return apiRequest<Record<string, boolean>>(`/batch-follow-status?${params}`, {
    method: "POST",
  });
}

