"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchTabOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SwitchTabProps {
  options: SwitchTabOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "pills" | "tabs" | "underline";
  disabled?: boolean;
}

export const SwitchTab = React.memo(function SwitchTab({
  options,
  value,
  onValueChange,
  className,
  size = "md",
  variant = "pills",
  disabled = false,
}: SwitchTabProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] =
    React.useState<React.CSSProperties>({});

  // Size configurations
  const sizeConfig = {
    sm: {
      button: "h-7 w-auto px-2 text-[10px]",
      gap: "gap-0.5",
      padding: "p-0.5",
    },
    md: {
      button: "h-8 w-auto px-3 text-xs",
      gap: "gap-1",
      padding: "p-1",
    },
    lg: {
      button: "h-9 w-auto px-4 text-sm",
      gap: "gap-1",
      padding: "p-1",
    },
  };

  // Variant configurations
  const variantConfig = {
    pills: {
      container:
        "bg-card-light dark:bg-card-dark rounded-lg w-full border border-border-light dark:border-primary/10",
      indicator: "bg-primary/20 dark:bg-primary/80 rounded-md",
      active: "text-primary dark:text-white",
      inactive:
        "text-gray-500 dark:text-white/60 hover:text-gray-800 dark:hover:text-white/80",
    },
    tabs: {
      container: "bg-transparent border-b border-gray-200 dark:border-gray-700",
      indicator: "bg-primary/40 dark:bg-primary/40 rounded-t-md",
      active: "text-primary dark:text-primary",
      inactive:
        "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
    },
    underline: {
      container: "bg-transparent",
      indicator: "bg-primary h-0.5 bottom-0 rounded-full",
      active: "text-primary dark:text-primary font-semibold",
      inactive:
        "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
    },
  };

  // Update indicator position and size
  const updateIndicator = React.useCallback(() => {
    const activeOption = options.find((opt) => opt.value === value);
    if (!activeOption) return;

    const activeButton = buttonRefs.current.get(activeOption.value);
    if (!activeButton || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    const style: React.CSSProperties = {
      width: buttonRect.width,
      transform: `translateX(${buttonRect.left - containerRect.left}px)`,
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    };

    if (variant === "underline") {
      style.height = "2px";
      style.bottom = "0";
    } else {
      style.height = buttonRect.height;
    }

    setIndicatorStyle(style);
  }, [value, options, variant]);

  React.useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // 监听窗口大小变化，更新指示器位置（响应移动端 label 隐藏/显示）
  React.useEffect(() => {
    const handleResize = () => {
      updateIndicator();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateIndicator]);

  const config = {
    size: sizeConfig[size],
    variant: variantConfig[variant],
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center",
        config.size.gap,
        config.size.padding,
        config.variant.container,
        className
      )}
    >
      {/* Animated indicator */}
      {variant !== "underline" && (
        <div
          className={cn(
            "absolute top-[1.5px] left-0 pointer-events-none",
            config.variant.indicator,
            size === "sm"
              ? "top-[1.5px]"
              : size === "md"
              ? "top-[3.5px]"
              : "top-[6px]"
          )}
          style={indicatorStyle}
        />
      )}

      {/* Options */}
      {options.map((option) => {
        const isActive = value === option.value;
        const isDisabled = disabled || option.disabled;

        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) {
                buttonRefs.current.set(option.value, el);
              } else {
                buttonRefs.current.delete(option.value);
              }
            }}
            onClick={() => {
              if (!isDisabled) {
                onValueChange(option.value);
              }
            }}
            disabled={isDisabled}
            className={cn(
              "relative z-10 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-1.5",
              config.size.button,
              isActive ? config.variant.active : config.variant.inactive,
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {option.icon && (
              <span className="flex-shrink-0">{option.icon}</span>
            )}
            <span className={cn(option.icon && "hidden sm:inline")}>
              {option.label}
            </span>
          </button>
        );
      })}

      {/* Underline indicator */}
      {variant === "underline" && (
        <div
          className={cn(
            "absolute pointer-events-none left-0",
            config.variant.indicator
          )}
          style={indicatorStyle}
        />
      )}
    </div>
  );
});
