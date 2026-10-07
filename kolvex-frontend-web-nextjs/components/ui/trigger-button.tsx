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
            "border-2 border-positive/30 bg-positive/10 text-foreground",
            "hover:bg-positive/20 hover:border-positive/50",
          ];
        case "red":
          return [
            "border-2 border-negative/30 bg-negative/10 text-foreground",
            "hover:bg-negative/20 hover:border-negative/50",
          ];
        case "gray":
          return [
            "border-2 border-border bg-foreground/10 text-foreground",
            "hover:bg-foreground/[0.15] hover:border-border",
          ];
        default:
          return [
            // Light mode - selected
            "border-2 border-primary/60 bg-primary/40 text-foreground",
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
            "border border-border bg-background text-foreground",
            "hover:bg-muted hover:border-border",
            
            // Dark mode - default
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

