"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 min-w-0 w-full rounded-xl border border-transparent bg-muted px-3.5 py-2 text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-secondary-foreground placeholder:text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:border-foreground/60 focus-visible:bg-background disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
