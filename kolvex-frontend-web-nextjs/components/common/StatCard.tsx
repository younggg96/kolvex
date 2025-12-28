"use client";

import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  /** 标签文字 */
  label: string;
  /** 显示的值 */
  value: string | number | null;
  /** 右上角图标 */
  icon?: LucideIcon;
  /** 加载状态 */
  loading?: boolean;
  /** 副标题/说明文字 */
  subtitle?: React.ReactNode;
  /** 值的颜色变体 */
  variant?: "default" | "positive" | "negative" | "muted";
  /** 自定义类名 */
  className?: string;
  /** 值的自定义类名 */
  valueClassName?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  loading = false,
  subtitle,
  variant = "default",
  className,
  valueClassName,
}: StatCardProps) {
  // 根据 variant 决定值的颜色
  const valueColorClass = {
    default: "",
    positive: "text-green-600 dark:text-green-500",
    negative: "text-red-600 dark:text-red-500",
    muted: "text-muted-foreground",
  }[variant];

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="!p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground/50" />}
        </div>
        <div className="mt-2">
          {loading || value === null ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                valueColorClass,
                valueClassName
              )}
            >
              {value}
            </p>
          )}
        </div>
        {subtitle && !loading && (
          <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default StatCard;
