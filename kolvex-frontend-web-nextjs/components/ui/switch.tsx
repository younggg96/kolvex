"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: {
    root: "h-3.5 w-6",
    thumb: "h-2.5 w-2.5 data-[state=checked]:translate-x-2.5",
  },
  md: {
    root: "h-4 w-7",
    thumb: "h-3 w-3 data-[state=checked]:translate-x-3",
  },
  lg: {
    root: "h-5 w-9",
    thumb: "h-4 w-4 data-[state=checked]:translate-x-4",
  },
};

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = "md", ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-200 dark:focus-visible:ring-offset-background-dark dark:data-[state=unchecked]:bg-white/20",
      sizeConfig[size].root,
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0",
        sizeConfig[size].thumb
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
