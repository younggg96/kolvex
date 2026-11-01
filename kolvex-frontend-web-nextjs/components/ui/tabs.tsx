"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: "default" | "auth" | "pill";
  }
>(({ className, variant = "pill", ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "min-h-11 items-center justify-start text-muted-foreground",
      variant === "auth"
        ? "grid w-full grid-cols-2 gap-1 rounded-full bg-muted/50 p-1"
        : variant === "pill"
          ? "inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-muted/50 p-1 scrollbar-hide"
          : "inline-flex w-full gap-1 overflow-x-auto border-b border-border scrollbar-hide",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    variant?: "default" | "pill";
  }
>(({ className, variant = "pill", ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex shrink-0 items-center justify-center whitespace-nowrap text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-8",
      variant === "pill"
        ? "min-h-10 rounded-full px-4 hover:bg-secondary focus-visible:bg-secondary data-[state=active]:bg-foreground data-[state=active]:text-background"
        : "-mb-px min-h-11 border-b-2 border-transparent hover:text-foreground focus-visible:rounded-t-md focus-visible:bg-muted data-[state=active]:border-primary data-[state=active]:text-foreground",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "focus-visible:outline-none ",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
