import type { Notification } from "@/lib/supabase/database.types";

export type FilterTab = "all" | "unread" | "read";

export interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClick: (notification: Notification) => void;
  isMarkingRead: boolean;
  isDeleting: boolean;
}

export interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  loadingMore: boolean;
  activeTab: FilterTab;
  markingReadId: string | null;
  deletingId: string | null;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  onMarkAsRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onNotificationClick: (notification: Notification) => void;
}

export interface NotificationFiltersProps {
  activeTab: FilterTab;
  unreadCount: number;
  onTabChange: (tab: FilterTab) => void;
}

export interface NotificationActionsProps {
  hasNotifications: boolean;
  unreadCount: number;
  onMarkAllAsRead: () => Promise<void>;
  onDeleteAll: () => Promise<void>;
}
