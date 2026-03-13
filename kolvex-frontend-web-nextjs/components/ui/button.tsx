"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70 disabled:opacity-50",
        outline:
          "border border-border bg-transparent hover:bg-muted active:bg-muted/80 disabled:opacity-50",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80 disabled:opacity-50",
        ghost: "hover:bg-muted active:bg-muted/80 disabled:opacity-50",
        link: "text-primary underline-offset-4 hover:underline active:opacity-80 disabled:opacity-50",
        text: "text-primary hover:text-primary/80 active:text-primary/70 !p-0 !h-auto !w-auto disabled:opacity-50",
        icon: "rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:cursor-not-allowed",
      },
      size: {
        default: "h-10 px-6 py-2",
        xs: "h-6 px-2.5 py-1.5 text-xs",
        md: "h-10 px-6 py-2",
        sm: "h-9 px-4 py-2",
        lg: "h-11 px-8 py-2.5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
