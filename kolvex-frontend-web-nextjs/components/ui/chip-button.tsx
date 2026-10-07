"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const chipButtonVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "bg-muted hover:bg-muted border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground",
        primary:
          "bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 text-primary",
        outline:
          "bg-transparent hover:bg-muted border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground",
        ghost:
          "bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground",
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

