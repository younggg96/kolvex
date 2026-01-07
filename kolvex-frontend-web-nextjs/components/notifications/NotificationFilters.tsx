"use client";

import { Inbox, Mail, MailOpen } from "lucide-react";
import { SwitchTab } from "@/components/ui/switch-tab";
import type { NotificationFiltersProps, FilterTab } from "./types";

export function NotificationFilters({
  activeTab,
  unreadCount,
  onTabChange,
}: NotificationFiltersProps) {
  return (
    <SwitchTab
      options={[
        {
          value: "all",
          label: "All",
          icon: <Inbox className="w-4 h-4" />,
        },
        {
          value: "unread",
          label:
            unreadCount > 0
              ? `Unread (${unreadCount > 99 ? "99+" : unreadCount})`
              : "Unread",
          icon: <Mail className="w-4 h-4" />,
        },
        {
          value: "read",
          label: "Read",
          icon: <MailOpen className="w-4 h-4" />,
        },
      ]}
      value={activeTab}
      onValueChange={(value) => onTabChange(value as FilterTab)}
      size="md"
      variant="pills"
      className="!w-fit"
    />
  );
}
