"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary/90",
        secondary:
          "bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-white/20",
        outline:
          "border border-gray-300 dark:border-white/10 bg-transparent hover:bg-gray-100 dark:hover:bg-white/10",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        ghost: "hover:bg-gray-100 dark:hover:bg-white/10",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2",
        xs: "h-6 px-2.5 py-1.5",
        sm: "h-9 px-4 py-2",
        lg: "h-11 px-8 py-2.5",
        icon: "h-10 w-10",
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
