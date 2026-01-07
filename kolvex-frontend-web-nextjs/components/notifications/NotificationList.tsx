"use client";

import { Bell, Loader2, Mail, MailOpen } from "lucide-react";
import SectionCard from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/common/EmptyState";
import {
  NotificationItemSkeleton,
  SkeletonGrid,
} from "@/components/common/LoadingSkeleton";
import { NotificationItem } from "./NotificationItem";
import type { NotificationListProps } from "./types";

export function NotificationList({
  notifications,
  loading,
  loadingMore,
  activeTab,
  markingReadId,
  deletingId,
  loadMoreRef,
  onMarkAsRead,
  onDelete,
  onNotificationClick,
}: NotificationListProps) {
  // Loading state
  if (loading) {
    return (
      <SkeletonGrid count={8}>
        <NotificationItemSkeleton />
      </SkeletonGrid>
    );
  }

  // Empty state
  if (notifications.length === 0) {
    return (
      <SectionCard
        useSectionHeader={false}
        padding="sm"
        scrollable
        contentClassName="space-y-0 p-4"
      >
        <EmptyState
          icon={
            activeTab === "unread"
              ? Mail
              : activeTab === "read"
              ? MailOpen
              : Bell
          }
          title={
            activeTab === "unread"
              ? "No Unread Notifications"
              : activeTab === "read"
              ? "No Read Notifications"
              : "No Notifications"
          }
          description={
            activeTab === "unread"
              ? "You're all caught up! No unread notifications at the moment."
              : activeTab === "read"
              ? "No notifications have been read yet."
              : "Notifications about portfolio updates from people you follow will appear here."
          }
        />
      </SectionCard>
    );
  }

  // Notifications list
  return (
    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onDelete={onDelete}
          onClick={onNotificationClick}
          isMarkingRead={markingReadId === notification.id}
          isDeleting={deletingId === notification.id}
        />
      ))}

      {/* Infinite Scroll Trigger */}
      <div
        ref={loadMoreRef as React.RefObject<HTMLDivElement>}
        className="flex justify-center py-4"
      >
        {loadingMore && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-white/50">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading more...</span>
          </div>
        )}
      </div>
    </div>
  );
}
