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
      button: "h-7 w-auto px-2 text-[0.75rem]",
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
  // Match the shared Tabs/SegmentedControl foreground + inverse-text pairing.
  const variantConfig = {
    pills: {
      container:
        "bg-card rounded-full w-full border border-border",
      indicator: "bg-foreground rounded-full",
      active: "text-background",
      inactive:
        "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]",
    },
    tabs: {
      container: "bg-transparent border-b border-border",
      indicator: "bg-foreground rounded-t-md",
      active: "text-background",
      inactive:
        "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]",
    },
    underline: {
      container: "bg-transparent",
      indicator: "bg-foreground h-0.5 bottom-0 rounded-full",
      active: "text-foreground font-semibold",
      inactive:
        "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]",
    },
  };

  // Update indicator position and size
  const updateIndicator = React.useCallback(() => {
    const activeOption = options.find((opt) => opt.value === value);
    if (!activeOption) {
      setIndicatorStyle({});
      return;
    }

    const activeButton = buttonRefs.current.get(activeOption.value);
    if (!activeButton || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    const style: React.CSSProperties = {
      width: buttonRect.width,
      transform: `translateX(${buttonRect.left - containerRect.left + containerRef.current.scrollLeft - containerRef.current.clientLeft}px)`,
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    };

    if (variant === "underline") {
      style.height = "2px";
      style.bottom = "0";
    } else {
      style.height = buttonRect.height;
      style.top = buttonRect.top - containerRect.top + containerRef.current.scrollTop - containerRef.current.clientTop;
    }

    setIndicatorStyle(style);
  }, [value, options, variant]);

  React.useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Font loading and the mobile root size can reflow labels after resize.
  React.useLayoutEffect(() => {
    const handleResize = () => {
      updateIndicator();
    };
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    buttonRefs.current.forEach((button) => observer.observe(button));
    window.addEventListener("resize", handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [updateIndicator]);

  const config = {
    size: sizeConfig[size],
    variant: variantConfig[variant],
  };
  const hasIndicator = typeof indicatorStyle.width === "number" && indicatorStyle.width > 0
    && typeof indicatorStyle.height === "number" && indicatorStyle.height > 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative isolate flex items-center",
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
            "pointer-events-none absolute left-0 z-0 motion-reduce:!transition-none",
            config.variant.indicator,
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
            type="button"
            onClick={() => {
              if (!isDisabled) {
                onValueChange(option.value);
              }
            }}
            disabled={isDisabled}
            aria-label={option.label}
            aria-pressed={isActive}
            title={option.label}
            className={cn(
              "relative z-10 rounded-full font-medium transition-all duration-200 flex items-center justify-center gap-1.5",
              config.size.button,
              isActive ? config.variant.active : config.variant.inactive,
              isActive && variant !== "underline" && (hasIndicator
                ? "bg-transparent focus-visible:bg-transparent"
                : "bg-foreground focus-visible:bg-foreground"),
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
            "absolute pointer-events-none left-0 motion-reduce:!transition-none",
            config.variant.indicator
          )}
          style={indicatorStyle}
        />
      )}
    </div>
  );
});
