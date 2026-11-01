"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const chipButtonVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "bg-muted hover:bg-primary/10 border border-border hover:border-primary/40 text-muted-foreground hover:text-primary-text active:bg-primary/[0.16]",
        primary:
          "bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 text-primary-text",
        outline:
          "bg-transparent hover:bg-primary/[0.08] border border-border hover:border-primary/40 text-muted-foreground hover:text-primary-text active:bg-primary/[0.16]",
        ghost:
          "bg-transparent hover:bg-primary/[0.09] text-muted-foreground hover:text-primary-text active:bg-primary/[0.16]",
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

