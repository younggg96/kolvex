"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;
const TabsVariantContext = React.createContext<"default" | "pill">("pill");

/** Suppresses the pill's entry animation until after the first frame. */
const useArmedAfterFirstFrame = () => {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return armed;
};

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  variant?: "default" | "auth" | "pill" | "pill-solid";
};

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant = "pill", children, ...props }, ref) => {
  const pill = variant === "pill" || variant === "pill-solid" || variant === "auth";
  // A single animated pill sits under the active trigger in the pill variants,
  // matching `SegmentedControl`; the underline variant stays per-trigger.
  if (!pill) {
    return (
      <TabsVariantContext.Provider value="default">
        <TabsPrimitive.List
          ref={ref}
          className={cn(
            "min-h-11 items-center justify-start text-muted-foreground",
            "inline-flex w-full gap-1 overflow-x-auto border-b border-border scrollbar-hide",
            className,
          )}
          {...props}
        >
          {children}
        </TabsPrimitive.List>
      </TabsVariantContext.Provider>
    );
  }
  return (
    <TabsVariantContext.Provider value="pill">
      <TabsPrimitive.List
        ref={ref}
        data-variant={variant}
        className={cn(
          // Phones use a segmented-control height so the track does not eat a row of content.
          "group/tabs relative isolate min-h-9 items-center justify-start gap-0.5 rounded-full p-0.5 text-foreground/70 sm:min-h-11 sm:gap-1 sm:p-1",
          variant === "auth"
            ? "grid w-full grid-cols-2"
            : "inline-flex w-fit max-w-full overflow-x-auto scrollbar-hide",
          "glass-track",
          variant === "pill-solid" && "glass-track-strong",
          className,
        )}
        {...props}
      >
        <PillIndicator />
        {children}
      </TabsPrimitive.List>
    </TabsVariantContext.Provider>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

type TabsTriggerProps = React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
> & {
  variant?: "default" | "pill";
};

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, ...props }, ref) => {
  const listVariant = React.useContext(TabsVariantContext);
  const resolvedVariant = variant ?? listVariant;
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      data-tab-variant={resolvedVariant}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap text-sm font-semibold transition-colors duration-150 focus-visible:outline-none",
        resolvedVariant === "pill"
          ? // The fill is painted by the list's sliding glass pill. Until a
            // visible indicator is measured (SSR, hidden panels), the trigger
            // paints a matching white fill of its own.
            // Unselected segments get a neutral wash: tabs are navigation, not
            // direction, so brand green here would compete with real signals.
            "relative z-10 min-h-8 rounded-full px-3 [transform:translateZ(0)] sm:min-h-10 sm:px-4 data-[state=inactive]:hover:bg-foreground/[0.06] data-[state=inactive]:hover:text-foreground data-[state=inactive]:active:bg-foreground/[0.1] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/20 data-[state=active]:bg-glass-thumb data-[state=active]:text-glass-thumb-foreground group-data-[pill-ready=true]/tabs:data-[state=active]:bg-transparent"
          : // The underline variant uses border as its only active affordance, so
            // the rule itself has to go neutral too — a green indicator line
            // would read as state colour on what is just a tab position.
            "-mb-px min-h-11 border-b-2 border-transparent px-4 focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-8 hover:border-foreground/25 hover:text-foreground focus-visible:rounded-t-md focus-visible:bg-foreground/[0.06] focus-visible:text-foreground active:bg-foreground/[0.1] data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:hover:border-foreground",
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/** Critically damped spring from app/globals.css (`--spring`). */
const EASE = "var(--spring)";

/** A list wider than its screen scrolls so the chosen tab is never left clipped. */
function centerActive(list: HTMLElement, behavior?: ScrollBehavior) {
  const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
  if (!active || list.scrollWidth <= list.clientWidth) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  list.scrollTo({
    left: active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2,
    behavior: behavior ?? (reduced ? "auto" : "smooth"),
  });
}

/**
 * The sliding active pill for pill lists. It is measured from the active
 * trigger, so it works no matter how the triggers are rendered or filtered.
 */
function PillIndicator() {
  const indicatorRef = React.useRef<HTMLSpanElement>(null);
  const armed = useArmedAfterFirstFrame();

  const measure = React.useCallback(() => {
    const list = indicatorRef.current?.closest<HTMLElement>('[role="tablist"]');
    const active = list?.querySelector<HTMLElement>(
      '[role="tab"][data-state="active"]',
    );
    const indicator = indicatorRef.current;
    if (!list || !active || !indicator) {
      if (list) delete list.dataset.pillReady;
      if (indicator) indicator.style.opacity = "0";
      return;
    }
    const listRect = list.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      delete list.dataset.pillReady;
      indicator.style.opacity = "0";
      return;
    }
    indicator.style.transitionDuration = armed ? "420ms, 420ms, 420ms" : "0ms";
    indicator.style.transitionTimingFunction = armed
      ? `${EASE}, ${EASE}, ${EASE}`
      : "linear";
    indicator.style.opacity = "1";
    indicator.style.width = `${rect.width}px`;
    indicator.style.height = `${rect.height}px`;
    indicator.style.transform = `translate3d(${
      rect.left - listRect.left + list.scrollLeft
    }px, ${rect.top - listRect.top + list.scrollTop}px, 0)`;
    list.dataset.pillReady = "true";
  }, [armed]);

  React.useLayoutEffect(() => {
    const list = indicatorRef.current?.closest<HTMLElement>('[role="tablist"]');
    if (!list) return;
    measure();
    centerActive(list, "auto");
    const observer = new ResizeObserver(() => measure());
    observer.observe(list);
    const triggers = list.querySelectorAll<HTMLElement>('[role="tab"]');
    triggers.forEach((trigger) => observer.observe(trigger));
    const mutations = new MutationObserver((records) => {
      // Measuring writes the indicator's style; do not observe our own writes.
      if (records.some((record) => record.target !== indicatorRef.current)) measure();
      if (records.some((record) => record.attributeName === "data-state")) centerActive(list);
    });
    mutations.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "hidden", "style", "class"],
      childList: true,
    });
    list.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      list.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <span
      ref={indicatorRef}
      aria-hidden="true"
      data-slot="tabs-pill-indicator"
      className="pointer-events-none absolute left-0 top-0 z-0 rounded-full glass-thumb opacity-0 motion-reduce:!transition-none"
      style={{
        transitionProperty: "transform, width, height",
      }}
    />
  );
}

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      // The incoming panel settles in instead of swapping in place.
      "focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-200",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
