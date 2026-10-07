"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex max-w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:brightness-95 active:brightness-90 disabled:opacity-40",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-foreground/10 active:bg-foreground/15 disabled:opacity-40",
        outline:
          "border border-border bg-transparent text-foreground hover:border-foreground/40 hover:bg-muted active:bg-secondary disabled:opacity-40",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-95 active:brightness-90 disabled:opacity-40",
        ghost: "font-medium hover:bg-muted active:bg-secondary disabled:opacity-40",
        link: "text-positive underline-offset-4 hover:underline active:opacity-80 disabled:opacity-40",
        text: "text-positive hover:opacity-80 active:opacity-70 !p-0 !h-auto !w-auto disabled:opacity-40",
        icon: "bg-primary text-primary-foreground hover:brightness-95 active:brightness-90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed",
      },
      size: {
        default: "h-11 px-6 py-2",
        xs: "h-8 px-3 text-xs",
        md: "h-10 px-5 py-2",
        sm: "h-9 px-4 py-2",
        lg: "h-12 px-8 py-2.5 text-[15px]",
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
