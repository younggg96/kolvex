"use client";

import { useRouter } from "next/navigation";
import { CheckCheck, Trash2, Zap, Activity, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { HeroSection } from "@/components/ui/hero-section";
import {
  NotificationList,
  NotificationFilters,
  useNotifications,
} from "@/components/notifications";
import { useAuth } from "@/hooks/useAuth";

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

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
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
  } = useNotifications(isAuthenticated);

  // Redirect if not authenticated
  if (!authLoading && !isAuthenticated) {
    router.push("/auth");
    return null;
  }

  return (
    <DashboardLayout
      headerClassName="lg:hidden"
      title="Notifications"
      showHeader={true}
      headerActions={
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
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

        {/* Hero Section */}
        <HeroSection
          title="Notifications"
          description="Stay updated with portfolio changes and market signals"
          className="lg:block hidden"
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

        <div className="relative p-4 min-w-0 space-y-4">
          {/* Filter Tabs */}
          <NotificationFilters
            activeTab={activeTab}
            unreadCount={unreadCount}
            onTabChange={handleTabChange}
          />

          {/* Notifications List */}
          <NotificationList
            notifications={notifications}
            loading={loading}
            loadingMore={loadingMore}
            activeTab={activeTab}
            markingReadId={markingReadId}
            deletingId={deletingId}
            loadMoreRef={loadMoreRef}
            onMarkAsRead={handleMarkAsRead}
            onDelete={handleDelete}
            onNotificationClick={handleNotificationClick}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
