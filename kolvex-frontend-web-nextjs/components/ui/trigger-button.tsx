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
          /* The selected trigger is a neutral chip with a heavier edge, not a
             green panel: a 40% brand fill was the loudest green on most forms
             and competed with the price colours around it. `green` and `red`
             still carry their semantic tint when a caller asks for it. */
          return [
            "border-2 border-foreground/25 bg-foreground/[0.06] text-foreground",
            "hover:bg-foreground/[0.1] hover:border-foreground/35",

            "dark:border-foreground/30 dark:bg-foreground/10 dark:text-foreground",
            "dark:hover:bg-foreground/[0.15] dark:hover:border-foreground/40",
          ];
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          // Base styles
          "inline-flex items-center justify-center rounded-full font-medium transition-all duration-200",
          "focus-visible:outline-none ",
          "disabled:pointer-events-none disabled:opacity-50",
          
          // Size
          sizeClasses[size],
          
          // Default state (not selected)
          !selected && [
            // Light mode - default. Unselected triggers preview a grey wash on
            // hover; the selected variants below carry the semantic colour.
            "border border-border bg-background text-foreground",
            "hover:border-foreground/25 hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]",
            
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

