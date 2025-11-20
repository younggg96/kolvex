import * as React from "react";
import { cn } from "@/lib/utils";

export interface TriggerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Whether the button is in selected/active state
   */
  selected?: boolean;
  /**
   * Additional className for custom styling
   */
  className?: string;
  /**
   * Button size
   */
  size?: "sm" | "md" | "lg";
  /**
   * Color variant for the button
   */
  variant?: "default" | "green" | "red" | "gray";
}

const TriggerButton = React.forwardRef<HTMLButtonElement, TriggerButtonProps>(
  ({ className, selected = false, size = "md", variant = "default", children, ...props }, ref) => {
    const sizeClasses = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    // Variant-specific selected styles
    const getSelectedStyles = () => {
      switch (variant) {
        case "green":
          return [
            "border-2 border-green-500 bg-green-500/20 text-gray-900",
            "hover:bg-green-500/30 hover:border-green-500",
            "dark:border-green-500 dark:bg-green-500/20 dark:text-green-400",
            "dark:hover:bg-green-500/30 dark:hover:border-green-500",
          ];
        case "red":
          return [
            "border-2 border-red-500 bg-red-500/20 text-gray-900",
            "hover:bg-red-500/30 hover:border-red-500",
            "dark:border-red-500 dark:bg-red-500/20 dark:text-red-400",
            "dark:hover:bg-red-500/30 dark:hover:border-red-500",
          ];
        case "gray":
          return [
            "border-2 border-gray-400 bg-gray-400/20 text-gray-900",
            "hover:bg-gray-400/30 hover:border-gray-400",
            "dark:border-gray-400 dark:bg-gray-400/20 dark:text-gray-300",
            "dark:hover:bg-gray-400/30 dark:hover:border-gray-400",
          ];
        default:
          return [
            // Light mode - selected
            "border-2 border-primary/60 bg-primary/40 text-gray-900",
            "hover:bg-primary/10 hover:border-primary",
            
            // Dark mode - selected
            "dark:border-primary dark:bg-primary/20 dark:text-primary",
            "dark:hover:bg-primary/30 dark:hover:border-primary",
          ];
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          // Base styles
          "inline-flex items-center justify-center rounded-md font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          
          // Size
          sizeClasses[size],
          
          // Default state (not selected)
          !selected && [
            // Light mode - default
            "border border-gray-200 bg-white text-gray-900",
            "hover:bg-gray-50 hover:border-gray-300",
            
            // Dark mode - default
            "dark:border-white/10 dark:bg-white/5 dark:text-white",
            "dark:hover:bg-white/10 dark:hover:border-white/20",
          ],
          
          // Selected state with variant styles
          selected && getSelectedStyles(),
          
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TriggerButton.displayName = "TriggerButton";

export { TriggerButton };

