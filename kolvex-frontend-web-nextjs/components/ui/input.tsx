"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "auth";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "default", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-w-0 w-full rounded-xl border bg-muted py-2 text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-secondary-foreground placeholder:text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:border-foreground/60 focus-visible:bg-background disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150 aria-[invalid=true]:border-negative aria-[invalid=true]:focus-visible:border-negative",
          variant === "auth"
            ? "h-12 border-border px-4 text-base focus-visible:ring-2 focus-visible:ring-foreground/10 motion-reduce:transition-none"
            : "h-10 border-transparent px-3.5 text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
