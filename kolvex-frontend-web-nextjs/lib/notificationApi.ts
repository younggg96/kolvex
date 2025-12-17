/**
 * Notification API Module
 * Client-side API calls for notification functionality
 */

import type {
  Notification,
  NotificationListResponse,
} from "@/lib/supabase/database.types";

const API_PREFIX = "/api/notifications";

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

// ========== Notification Operations ==========

/**
 * Get notifications list
 * @param page Page number
 * @param pageSize Number of items per page
 * @param unreadOnly Whether to fetch only unread notifications
 */
export async function getNotifications(
  page: number = 1,
  pageSize: number = 20,
  unreadOnly: boolean = false
): Promise<NotificationListResponse> {
  return apiRequest<NotificationListResponse>(
    `?page=${page}&page_size=${pageSize}&unread_only=${unreadOnly}`
  );
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  const result = await apiRequest<{ unread_count: number }>("/unread-count");
  return result.unread_count;
}

/**
 * Mark a notification as read
 * @param notificationId Notification ID
 */
export async function markAsRead(
  notificationId: string
): Promise<{ message: string; success: boolean }> {
  return apiRequest<{ message: string; success: boolean }>(
    `/${notificationId}/read`,
    { method: "POST" }
  );
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<{
  message: string;
  success: boolean;
}> {
  return apiRequest<{ message: string; success: boolean }>("/read-all", {
    method: "POST",
  });
}

/**
 * Delete a notification
 * @param notificationId Notification ID
 */
export async function deleteNotification(
  notificationId: string
): Promise<{ message: string; success: boolean }> {
  return apiRequest<{ message: string; success: boolean }>(
    `/${notificationId}`,
    { method: "DELETE" }
  );
}

/**
 * Delete all notifications
 */
export async function deleteAllNotifications(): Promise<{
  message: string;
  success: boolean;
}> {
  return apiRequest<{ message: string; success: boolean }>("", {
    method: "DELETE",
  });
}

/**
 * Helper to get notification icon based on type
 */
export function getNotificationIcon(type: Notification["type"]): string {
  switch (type) {
    case "POSITION_BUY":
      return "🛒";
    case "POSITION_SELL":
      return "💰";
    case "POSITION_INCREASE":
      return "📈";
    case "POSITION_DECREASE":
      return "📉";
    case "NEW_FOLLOWER":
      return "👤";
    case "SYSTEM":
    default:
      return "🔔";
  }
}

/**
 * Helper to format notification time
 */
export function formatNotificationTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

