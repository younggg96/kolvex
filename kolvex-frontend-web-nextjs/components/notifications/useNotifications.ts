"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from "@/lib/notificationApi";
import type { Notification } from "@/lib/supabase/database.types";
import type { FilterTab } from "./types";

const PAGE_SIZE = 20;

export function useNotifications(isAuthenticated: boolean) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(
    async (
      pageNum: number,
      reset: boolean = false,
      filter: FilterTab = activeTab
    ) => {
      if (!isAuthenticated) return;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const unreadOnly = filter === "unread";
        const readOnly = filter === "read";
        const result = await getNotifications(
          pageNum,
          PAGE_SIZE,
          unreadOnly,
          readOnly
        );

        if (reset) {
          setNotifications(result.notifications);
          setPage(1);
        } else {
          setNotifications((prev) => [...prev, ...result.notifications]);
        }

        setTotal(result.total);
        setUnreadCount(result.unread_count);
        const currentTotal = reset
          ? result.notifications.length
          : notifications.length + result.notifications.length;
        setHasMore(
          result.notifications.length === PAGE_SIZE &&
            currentTotal < result.total
        );
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [isAuthenticated, activeTab, notifications.length]
  );

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications(1, true, activeTab);
    }
  }, [isAuthenticated, activeTab]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !loadingMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchNotifications(nextPage, false, activeTab);
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, loadingMore, loading, page, activeTab, fetchNotifications]);

  const handleTabChange = useCallback((tab: FilterTab) => {
    setActiveTab(tab);
    setPage(1);
    setNotifications([]);
  }, []);

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      setMarkingReadId(notificationId);
      try {
        await markAsRead(notificationId);
        if (activeTab === "unread") {
          setNotifications((prev) =>
            prev.filter((n) => n.id !== notificationId)
          );
          setTotal((prev) => Math.max(0, prev - 1));
        } else {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notificationId ? { ...n, is_read: true } : n
            )
          );
        }
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Failed to mark as read:", error);
      } finally {
        setMarkingReadId(null);
      }
    },
    [activeTab]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
      if (activeTab === "unread") {
        setNotifications([]);
        setTotal(0);
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, [activeTab]);

  const handleDelete = useCallback(async (notificationId: string) => {
    setDeletingId(notificationId);
    try {
      await deleteNotification(notificationId);
      setNotifications((prev) => {
        const deleted = prev.find((n) => n.id === notificationId);
        if (deleted && !deleted.is_read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((n) => n.id !== notificationId);
      });
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleDeleteAll = useCallback(async () => {
    if (!confirm("Are you sure you want to delete all notifications?")) return;

    try {
      await deleteAllNotifications();
      setNotifications([]);
      setTotal(0);
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to delete all notifications:", error);
    }
  }, []);

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.is_read) {
        handleMarkAsRead(notification.id);
      }
    },
    [handleMarkAsRead]
  );

  return {
    notifications,
    total,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    markingReadId,
    deletingId,
    activeTab,
    loadMoreRef,
    handleTabChange,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDelete,
    handleDeleteAll,
    handleNotificationClick,
  };
}

