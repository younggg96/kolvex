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
  TrendingUp,
  TrendingDown,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  DollarSign,
  ShoppingCart,
  Zap,
  History,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/common/EmptyState";
import { HeroSection } from "@/components/ui/hero-section";
import {
  NotificationItemSkeleton,
  SkeletonGrid,
} from "@/components/common/LoadingSkeleton";
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

  const renderNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "POSITION_BUY":
        return (
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <ShoppingCart className="w-4.5 h-4.5" />
          </div>
        );
      case "POSITION_SELL":
        return (
          <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
        );
      case "POSITION_INCREASE":
        return (
          <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
        );
      case "POSITION_DECREASE":
        return (
          <div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
            <TrendingDown className="w-4.5 h-4.5" />
          </div>
        );
      case "NEW_FOLLOWER":
        return (
          <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
            <UserPlus className="w-4.5 h-4.5" />
          </div>
        );
      case "SYSTEM":
      default:
        return (
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Info className="w-4.5 h-4.5" />
          </div>
        );
    }
  };

  const notificationFeatures = [
    {
      icon: Zap,
      label: "Real-time Alerts",
      iconClassName: "w-3.5 h-3.5 text-amber-500",
    },
    {
      icon: Activity,
      label: "Portfolio Updates",
      iconClassName: "w-3.5 h-3.5 text-primary",
    },
    {
      icon: History,
      label: "Signal History",
      iconClassName: "w-3.5 h-3.5 text-blue-500",
    },
  ];

  // Redirect if not authenticated
  if (!authLoading && !isAuthenticated) {
    router.push("/auth");
    return null;
  }

  return (
    <DashboardLayout title="Notifications" showHeader={false}>
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        {/* Hero Section */}
        <HeroSection
          title="Notifications"
          description="Stay updated with portfolio changes and market signals"
          features={notificationFeatures}
          actions={
            notifications.length > 0 ? (
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-9 text-xs font-medium bg-background/50 backdrop-blur-sm"
                    onClick={handleMarkAllAsRead}
                  >
                    <CheckCheck className="h-4 w-4" />
                    <span className="hidden sm:inline">Mark all read</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 bg-background/50 backdrop-blur-sm"
                  onClick={handleDeleteAll}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete all</span>
                </Button>
              </div>
            ) : undefined
          }
        />
        <div className="relative p-4 min-w-0 space-y-6">
          {/* Loading State */}
          {loading && (
            <SectionCard
              useSectionHeader={false}
              padding="sm"
              scrollable
              contentClassName="space-y-0 p-4"
              className="p-0"
            >
              <SkeletonGrid count={8}>
                <NotificationItemSkeleton />
              </SkeletonGrid>
            </SectionCard>
          )}

          {/* Empty State */}
          {!loading && notifications.length === 0 && (
            <SectionCard
              useSectionHeader={false}
              padding="sm"
              scrollable
              contentClassName="space-y-0 p-4"
            >
              <EmptyState
                icon={Bell}
                title="No Notifications"
                description="You're all caught up! Notifications about portfolio updates from people you follow will appear here."
              />
            </SectionCard>
          )}

          {/* Notifications List */}
          {!loading && notifications.length > 0 && (
            <SectionCard
              useSectionHeader={false}
              padding="sm"
              scrollable
              contentClassName="space-y-0 p-4"
            >
              <div className="divide-y divide-border-light dark:divide-border-dark overflow-y-auto max-h-[calc(100vh-240px)]">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "group px-4 py-4 hover:bg-gray-50/80 dark:hover:bg-primary/5 cursor-pointer transition-all duration-200 relative",
                      !notification.is_read &&
                        "bg-primary/[0.02] dark:bg-primary/[0.01]"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Unread indicator on the left side edge */}
                    {!notification.is_read && (
                      <div className="absolute left-[2px] top-1/2 -translate-y-1/2 bottom-0 w-1 h-[calc(100%-10px)] bg-primary/80 rounded-full" />
                    )}

                    <div className="flex items-start gap-4">
                      {/* Icon Section */}
                      <div className="flex-shrink-0 mt-0.5">
                        {renderNotificationIcon(notification.type)}
                      </div>

                      {/* Content Section */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={cn(
                              "text-sm leading-snug",
                              !notification.is_read
                                ? "font-semibold text-gray-900 dark:text-white"
                                : "text-gray-700 dark:text-white/80"
                            )}
                          >
                            {notification.title}
                          </p>
                          <span className="text-[11px] text-gray-400 dark:text-white/30 whitespace-nowrap font-medium">
                            {formatNotificationTime(notification.created_at)}
                          </span>
                        </div>

                        <p className="text-xs text-gray-500 dark:text-white/50 line-clamp-2 leading-relaxed">
                          {notification.message}
                        </p>

                        <div className="flex items-center gap-3 pt-1">
                          {notification.related_symbol && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/10">
                              <span className="text-[10px] font-bold tracking-wider">
                                ${notification.related_symbol}
                              </span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </div>
                          )}

                          {!notification.is_read && (
                            <span className="text-[10px] font-bold text-primary uppercase tracking-tighter px-1.5 py-0.5 rounded bg-primary/10">
                              New
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions Section */}
                      <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 -mr-1">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id);
                            }}
                            disabled={markingRead === notification.id}
                          >
                            {markingRead === notification.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notification.id);
                          }}
                          disabled={deleting === notification.id}
                        >
                          {deleting === notification.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
                <div className="flex justify-center py-4 border-t border-gray-100 dark:border-white/5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="gap-2 h-9 text-xs text-gray-500 hover:text-primary font-semibold"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "View more notifications"
                    )}
                  </Button>
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
