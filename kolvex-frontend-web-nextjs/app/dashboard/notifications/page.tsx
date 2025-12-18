"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationIcon,
  formatNotificationTime,
} from "@/lib/notificationApi";
import type { Notification } from "@/lib/supabase/database.types";
import { useAuth } from "@/hooks/useAuth";

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  const fetchNotifications = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (!isAuthenticated) return;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const result = await getNotifications(pageNum, PAGE_SIZE);

        if (reset) {
          setNotifications(result.notifications);
        } else {
          setNotifications((prev) => [...prev, ...result.notifications]);
        }

        setTotal(result.total);
        setUnreadCount(result.unread_count);
        setHasMore(result.notifications.length === PAGE_SIZE);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications(1, true);
    }
  }, [isAuthenticated, fetchNotifications]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage, false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    setMarkingRead(notificationId);
    try {
      await markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    } finally {
      setMarkingRead(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    setDeleting(notificationId);
    try {
      await deleteNotification(notificationId);
      const deleted = notifications.find((n) => n.id === notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setTotal((prev) => Math.max(0, prev - 1));
      if (deleted && !deleted.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Are you sure you want to delete all notifications?")) return;

    try {
      await deleteAllNotifications();
      setNotifications([]);
      setTotal(0);
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to delete all notifications:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.related_symbol) {
      router.push(`/dashboard/stock/${notification.related_symbol}`);
    } else if (notification.related_user_id) {
      router.push(`/community/${notification.related_user_id}`);
    }
  };

  // Redirect if not authenticated
  if (!authLoading && !isAuthenticated) {
    router.push("/auth");
    return null;
  }

  return (
    <DashboardLayout
      title="Notifications"
      headerActions={
        notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleMarkAllAsRead}
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              onClick={handleDeleteAll}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete all</span>
            </Button>
          </div>
        )
      }
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative p-4 min-w-0 space-y-4">
          {/* Stats */}
          {!loading && notifications.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {total} notification{total !== 1 && "s"} · {unreadCount} unread
              </span>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <SectionCard useSectionHeader={false}>
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </SectionCard>
          )}

          {/* Empty State */}
          {!loading && notifications.length === 0 && (
            <SectionCard useSectionHeader={false}>
              <EmptyState
                icon={Bell}
                title="No Notifications"
                description="You're all caught up! Notifications about portfolio updates from people you follow will appear here."
              />
            </SectionCard>
          )}

          {/* Notifications List */}
          {!loading && notifications.length > 0 && (
            <SectionCard useSectionHeader={false} className="p-0">
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "group px-4 py-4 hover:bg-muted/50 cursor-pointer transition-colors",
                      !notification.is_read && "bg-primary/5"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <span className="text-2xl flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm",
                            !notification.is_read && "font-semibold"
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatNotificationTime(notification.created_at)}
                          </span>
                          {notification.related_symbol && (
                            <span className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                              ${notification.related_symbol}
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id);
                            }}
                            disabled={markingRead === notification.id}
                          >
                            {markingRead === notification.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notification.id);
                          }}
                          disabled={deleting === notification.id}
                        >
                          {deleting === notification.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center py-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </Button>
                </div>
              )}

              {/* End of list */}
              {!hasMore && notifications.length > 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground border-t border-border">
                  You&apos;ve reached the end
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

