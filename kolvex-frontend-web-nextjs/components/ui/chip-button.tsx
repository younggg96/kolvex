"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const chipButtonVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      /* Chips are filters and tags, not directional data, so every variant
         uses the same neutral hover/press feedback. `primary` is a heavier
         resting fill rather than a green tint, which would read as a signal. */
      variant: {
        default:
          "bg-muted hover:bg-foreground/[0.08] border border-border hover:border-foreground/25 text-muted-foreground hover:text-foreground active:bg-foreground/[0.1]",
        primary:
          "bg-muted hover:bg-foreground/[0.08] border border-border hover:border-foreground/25 text-foreground",
        outline:
          "bg-transparent hover:bg-foreground/[0.06] border border-border hover:border-foreground/25 text-muted-foreground hover:text-foreground active:bg-foreground/[0.1]",
        ghost:
          "bg-transparent hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground active:bg-foreground/[0.1]",
      },
      size: {
        default: "px-3 py-1.5 text-xs",
        sm: "px-2.5 py-1 text-xs",
        lg: "px-4 py-2 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ChipButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chipButtonVariants> {
  asChild?: boolean;
  icon?: React.ReactNode;
}

const ChipButton = React.forwardRef<HTMLButtonElement, ChipButtonProps>(
  ({ className, variant, size, asChild = false, icon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(chipButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </Comp>
    );
  }
);
ChipButton.displayName = "ChipButton";

export { ChipButton, chipButtonVariants };

