"use client";

import {
  Check,
  Trash2,
  Loader2,
  TrendingUp,
  TrendingDown,
  UserPlus,
  Info,
  DollarSign,
  ShoppingCart,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CompanyLogo from "@/components/ui/company-logo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatNotificationTime } from "@/lib/notificationApi";
import type { Notification } from "@/lib/supabase/database.types";
import type { NotificationItemProps } from "./types";
import { useRouter } from "next/navigation";

// 通知类型配置
const notificationConfig: Record<
  Notification["type"],
  {
    icon: React.ElementType;
    iconColor: string;
    bgColor: string;
    label: string;
  }
> = {
  POSITION_BUY: {
    icon: ShoppingCart,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    label: "Buy",
  },
  POSITION_SELL: {
    icon: DollarSign,
    iconColor: "text-orange-500",
    bgColor: "bg-orange-500/10",
    label: "Sell",
  },
  POSITION_INCREASE: {
    icon: TrendingUp,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Add",
  },
  POSITION_DECREASE: {
    icon: TrendingDown,
    iconColor: "text-rose-500",
    bgColor: "bg-rose-500/10",
    label: "Reduce",
  },
  NEW_FOLLOWER: {
    icon: UserPlus,
    iconColor: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "Follow",
  },
  SYSTEM: {
    icon: Info,
    iconColor: "text-primary",
    bgColor: "bg-primary/10",
    label: "System",
  },
};

function NotificationTypeIcon({
  type,
  isRead,
}: {
  type: Notification["type"];
  isRead: boolean;
}) {
  const config = notificationConfig[type] || notificationConfig.SYSTEM;
  const Icon = config.icon;
  return (
    <div
      className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
        config.bgColor,
        isRead && "opacity-50"
      )}
    >
      <Icon className={cn("w-5 h-5", config.iconColor)} />
    </div>
  );
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  isMarkingRead,
  isDeleting,
}: NotificationItemProps) {
  const isRead = notification.is_read;
  const config =
    notificationConfig[notification.type] || notificationConfig.SYSTEM;
  const hasSymbol = !!notification.related_symbol;
  const router = useRouter();

  return (
    <TooltipProvider>
      <div
        className={cn(
          "group relative rounded-xl transition-all duration-200",
          "bg-white dark:bg-card-dark/50",
          !isRead
            ? "bg-gradient-to-r from-primary/[0.03] to-transparent border-primary/20 dark:border-primary/30 shadow-sm"
            : "bg-transparent border-transparent hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
        )}
        // onClick={() => onClick(notification)}
      >
        {/* 未读指示器 - 左侧渐变条 */}
        {!isRead && (
          <div className="absolute left-1.5 top-4 bottom-4 w-1 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
        )}

        <div className="flex items-start gap-4 p-4 pl-5">
          {/* 左侧：Logo 或 图标 */}
          <div className="relative flex-shrink-0">
            {hasSymbol ? (
              <div className="relative">
                <CompanyLogo
                  symbol={notification.related_symbol!}
                  size="md"
                  shape="rounded"
                  border="light"
                  className={cn(isRead && "opacity-80")}
                />
                {/* 操作类型小图标 */}
                <div
                  className={cn(
                    "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 bg-card-light dark:bg-card-dark",
                    config.bgColor
                  )}
                >
                  <config.icon
                    className={cn("w-2.5 h-2.5", config.iconColor)}
                  />
                </div>
              </div>
            ) : (
              <NotificationTypeIcon type={notification.type} isRead={isRead} />
            )}
          </div>

          {/* 中间：内容区域 */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* 标题行 */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p
                  className={cn(
                    "text-sm leading-snug",
                    !isRead
                      ? "font-semibold text-gray-900 dark:text-white"
                      : "font-medium text-gray-500 dark:text-white/50"
                  )}
                >
                  {notification.title}
                </p>
                {/* New 标签 */}
                {!isRead && (
                  <Badge
                    variant="default"
                    size="xs"
                    className="bg-primary/90 hover:bg-primary text-white border-0 animate-pulse"
                  >
                    NEW
                  </Badge>
                )}
              </div>
            </div>

            {/* 消息内容 */}
            <p
              className={cn(
                "text-xs leading-relaxed",
                !isRead
                  ? "text-gray-600 dark:text-white/70"
                  : "text-gray-400 dark:text-white/40"
              )}
            >
              {notification.message}
            </p>

            {/* 标签区域 */}
            <div className="flex items-center gap-2 pt-0.5">
              {/* 股票标签 */}
              {hasSymbol && (
                <Badge
                  variant="outline"
                  size="xs"
                  className={cn(
                    "gap-1 font-bold tracking-wide cursor-pointer",
                    !isRead
                      ? "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                      : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50"
                  )}
                  onClick={() =>
                    notification.related_symbol &&
                    router.push(
                      `/dashboard/stock/${notification.related_symbol}`
                    )
                  }
                >
                  ${notification.related_symbol}
                </Badge>
              )}

              {/* 操作类型标签 */}
              <Badge
                variant="outline"
                size="xs"
                className={cn(
                  "border-0",
                  config.bgColor,
                  config.iconColor,
                  isRead && "opacity-60"
                )}
              >
                {config.label}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1 transition-all duration-200",
                "opacity-0 group-hover:opacity-100"
              )}
            >
              {!isRead && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkAsRead(notification.id);
                      }}
                      disabled={isMarkingRead}
                    >
                      {isMarkingRead ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark as read</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(notification.id);
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
            {/* 时间 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "text-[11px] whitespace-nowrap font-medium flex-shrink-0",
                    !isRead
                      ? "text-primary/80 dark:text-primary"
                      : "text-gray-400 dark:text-white/30"
                  )}
                >
                  {formatNotificationTime(notification.created_at)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{new Date(notification.created_at).toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
