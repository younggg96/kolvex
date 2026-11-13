import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Glass surface shared by every floating bar: the mobile dock, the chat header
 * and page toolbars. One radius, one shadow, one rim.
 */
export const floatingSurfaceClass =
  "glass-track glass-track-strong rounded-3xl ring-1 ring-foreground/[0.06] !shadow-[0_10px_30px_-6px_rgb(0_0_0/0.30),0_2px_8px_rgb(0_0_0/0.10)]";

/**
 * A toolbar that floats over the top of the page below `lg` (content scrolls
 * beneath it) and sits flat in the layout from `lg` up. The parent must be
 * `relative`; the scroll region below should pad its top by `floatingBarInset`.
 */
export const FloatingBar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-floating-bar
      className={cn(
        floatingSurfaceClass,
        "z-30 flex shrink-0 items-center gap-1 px-2",
        "max-lg:absolute max-lg:inset-x-4 max-lg:top-[max(0.5rem,env(safe-area-inset-top))] max-lg:min-h-[3.25rem]",
        "lg:rounded-none lg:ring-0 lg:!bg-transparent lg:!shadow-none lg:![-webkit-backdrop-filter:none] lg:![backdrop-filter:none]",
        className,
      )}
      {...props}
    />
  ),
);
FloatingBar.displayName = "FloatingBar";

/** Top padding a scroll region needs below `lg` so its first row starts under a FloatingBar. */
export const floatingBarInset = "max-lg:pt-[calc(max(0.5rem,env(safe-area-inset-top))+3.25rem+0.75rem)]";
