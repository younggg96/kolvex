import { ReactNode, useState } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import LiveButton from "./LiveButton";
import { toast } from "sonner";

interface SectionCardProps {
  // Header props
  title?: string;
  titleSize?: "sm" | "md" | "lg";
  icon?: ReactNode;
  showLiveIndicator?: boolean;
  headerExtra?: ReactNode;
  headerRightExtra?: ReactNode;
  headerBorder?: boolean;
  headerClassName?: string;

  // SectionHeader props (optional, 使用这些会替换默认的简单 header)
  useSectionHeader?: boolean;
  sectionHeaderIcon?: LucideIcon;
  sectionHeaderSubtitle?: string;
  sectionHeaderAction?: ReactNode;

  // Content props
  children: ReactNode;
  scrollable?: boolean;
  contentClassName?: string;
  maxHeight?: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;

  // Container props
  className?: string;
  padding?: "sm" | "md" | "lg" | "none";
  liveIndicatorClassName?: string;
  onLiveToggle?: (live: boolean) => void;
}

export default function SectionCard({
  title,
  titleSize = "md",
  icon,
  showLiveIndicator = false,
  headerClassName = "",
  headerExtra,
  headerRightExtra,
  headerBorder = false,
  useSectionHeader = true,
  sectionHeaderIcon,
  sectionHeaderSubtitle,
  sectionHeaderAction,
  children,
  scrollable = false,
  contentClassName = "",
  maxHeight,
  onScroll,
  className = "",
  padding = "md",
  liveIndicatorClassName = "",
  onLiveToggle,
}: SectionCardProps) {
  const titleSizeClasses = {
    sm: "text-[16px]",
    md: "text-[17px]",
    lg: "text-lg",
  };

  const headerPaddingClasses = {
    none: "px-4 pt-4",
    sm: "px-3 pt-3",
    md: "px-4 pt-4",
    lg: "px-4 pt-4",
  };

  const headerBottomClasses = {
    withBorder: "pb-4",
    withoutBorder: "pb-4",
  };

  const handleLiveToggle = (live: boolean) => {
    if (live) {
      toast.success("Live updates enabled");
    } else {
      toast.info("Live updates disabled");
    }
    onLiveToggle?.(live);
  };

  return (
    <div
      className={`bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg transition-colors duration-300 flex flex-col ${
        scrollable ? "overflow-hidden" : ""
      } ${className}`}
    >
      {/* Header */}
      {useSectionHeader &&
        (sectionHeaderIcon ? (
          <div
            className={`${headerPaddingClasses[padding]} ${headerClassName}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-2">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                  {(() => {
                    const Icon = sectionHeaderIcon;
                    return <Icon className="w-3.5 h-3.5 text-primary" />;
                  })()}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                    {title}
                  </h3>
                  {sectionHeaderSubtitle && (
                    <p className="text-[11px] sm:text-xs text-gray-600 dark:text-white/60">
                      {sectionHeaderSubtitle}
                    </p>
                  )}
                </div>
              </div>
              {sectionHeaderAction && (
                <div className="w-full sm:w-auto">{sectionHeaderAction}</div>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`flex items-center justify-between ${headerClassName} ${
              headerBorder
                ? `border-b border-border-light dark:border-border-dark ${headerBottomClasses.withBorder}`
                : headerBottomClasses.withoutBorder
            } ${headerPaddingClasses[padding]}`}
          >
            <div className="flex items-center gap-2">
              {icon && icon}
              {title && (
                <h2
                  className={`${titleSizeClasses[titleSize]} font-bold text-gray-900 dark:text-white`}
                >
                  {title}
                </h2>
              )}
              {headerExtra && (
                <div className="w-full sm:w-auto">{headerExtra}</div>
              )}
            </div>
            <div className="flex items-center gap-4">
              {headerRightExtra && (
                <div className="w-full sm:w-auto">{headerRightExtra}</div>
              )}
              {showLiveIndicator && (
                <LiveButton
                  isEnabled={true}
                  onLiveToggle={handleLiveToggle}
                  className={liveIndicatorClassName}
                />
              )}
            </div>
          </div>
        ))}
      {/* Content */}
      {scrollable ? (
        <div
          className={`flex-1 overflow-y-auto ${contentClassName}`}
          onScroll={onScroll}
          style={{
            maxHeight,
          }}
        >
          {children}
        </div>
      ) : (
        <div className={contentClassName}>{children}</div>
      )}
    </div>
  );
}
