"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/** Suppresses the pill's entry animation until after the first frame. */
const useArmedAfterFirstFrame = () => {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return armed;
};

/**
 * Edge fades that hint at labels hidden past the scroll clip. They are painted
 * only for the side that actually hides content: rendering them unconditionally
 * laid a grey fade over the active pill's rounded ends even when every trigger
 * fit, which read as a dirty shadow rather than an affordance.
 */
function ScrollHint({ listRef }: { listRef: React.RefObject<HTMLDivElement> }) {
  const [edges, setEdges] = React.useState({ left: false, right: false });

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const sync = () => {
      const overflow = el.scrollWidth - el.clientWidth;
      setEdges({
        left: overflow > 1 && el.scrollLeft > 1,
        right: overflow > 1 && el.scrollLeft < overflow - 1,
      });
    };

    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    // A font swap or a label translation changes scrollWidth without resizing
    // the tracked boxes, so re-measure once fonts settle as well.
    document.fonts?.ready.then(sync).catch(() => {});

    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [listRef]);

  return (
    <>
      <span
        aria-hidden="true"
        data-visible={edges.left}
        className="pointer-events-none absolute inset-y-1 left-1 z-20 w-8 rounded-l-full bg-gradient-to-r from-muted to-transparent transition-opacity duration-150 data-[visible=false]:opacity-0 motion-reduce:transition-none"
      />
      <span
        aria-hidden="true"
        data-visible={edges.right}
        className="pointer-events-none absolute inset-y-1 right-1 z-20 w-8 rounded-r-full bg-gradient-to-l from-muted to-transparent transition-opacity duration-150 data-[visible=false]:opacity-0 motion-reduce:transition-none"
      />
    </>
  );
}

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  variant?: "default" | "auth" | "pill" | "pill-solid";
};

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant = "pill", children, ...props }, ref) => {
  const pill = variant === "pill" || variant === "pill-solid";
  // The scroll hint measures the list itself, so it needs a ref even when the
  // caller forwards one of its own.
  const listRef = React.useRef<HTMLDivElement | null>(null) as React.MutableRefObject<HTMLDivElement | null>;
  const setListRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null | undefined>).current = node;
    },
    [ref],
  );
  // A single animated pill sits under the active trigger in the pill variants,
  // matching `SegmentedControl`; the underline variant stays per-trigger.
  if (!pill) {
    return (
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          "min-h-11 items-center justify-start text-muted-foreground",
          variant === "auth"
            ? "grid w-full grid-cols-2 gap-1 rounded-full bg-muted/50 p-1"
            : "inline-flex w-full gap-1 overflow-x-auto border-b border-border scrollbar-hide",
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    );
  }
  return (
    <TabsPrimitive.List
      ref={setListRef}
      data-variant={variant}
      className={cn(
        "group relative min-h-11 items-center justify-start text-muted-foreground",
        "inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1 scrollbar-hide",
        variant === "pill-solid" ? "bg-muted" : "bg-muted/50",
        className,
      )}
      {...props}
    >
      <PillIndicator />
      <ScrollHint listRef={listRef} />
      {children}
    </TabsPrimitive.List>
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
>(({ className, variant = "pill", ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex shrink-0 items-center justify-center whitespace-nowrap text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-8",
      variant === "pill"
        ? // The colour is painted by the list's sliding pill so only the
          // active hover surface is suppressed, never the shared indicator.
          // Unselected segments get a neutral wash: tabs are navigation, not
          // direction, so brand green here would compete with real signals.
          "relative z-10 min-h-10 rounded-full px-4 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:bg-foreground/[0.06] focus-visible:text-foreground active:bg-foreground/[0.1] data-[state=active]:text-background data-[state=active]:hover:bg-transparent data-[state=active]:hover:text-background"
        : // The underline variant uses border as its only active affordance, so
          // the rule itself has to go neutral too — a green indicator line
          // would read as state colour on what is just a tab position.
          "-mb-px min-h-11 border-b-2 border-transparent hover:border-foreground/25 hover:text-foreground focus-visible:rounded-t-md focus-visible:bg-foreground/[0.06] focus-visible:text-foreground active:bg-foreground/[0.1] data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:hover:border-foreground",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const EASE = "cubic-bezier(0.32, 0.72, 0.24, 1)";

/**
 * The sliding active pill for pill lists. It is measured from the active
 * trigger, so it works no matter how the triggers are rendered or filtered.
 */
function PillIndicator() {
  const indicatorRef = React.useRef<HTMLSpanElement>(null);
  const armed = useArmedAfterFirstFrame();

  const measure = React.useCallback(() => {
    const list = indicatorRef.current?.closest('[role="tablist"]');
    const active = list?.querySelector<HTMLElement>(
      '[data-state="active"]',
    );
    const indicator = indicatorRef.current;
    if (!list || !active || !indicator) {
      if (indicator) indicator.style.opacity = "0";
      return;
    }
    const listRect = list.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    indicator.style.transitionDuration = armed ? "420ms, 420ms, 60ms" : "0ms";
    indicator.style.transitionTimingFunction = armed
      ? `${EASE}, ${EASE}, linear`
      : "linear";
    indicator.style.opacity = "1";
    indicator.style.width = `${rect.width}px`;
    indicator.style.height = `${rect.height}px`;
    indicator.style.transform = `translate3d(${
      rect.left - listRect.left + list.scrollLeft
    }px, ${rect.top - listRect.top + list.scrollTop}px, 0)`;
  }, [armed]);

  React.useLayoutEffect(() => {
    const list = indicatorRef.current?.closest('[role="tablist"]');
    if (!list) return;
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(list);
    const triggers = list.querySelectorAll<HTMLElement>('[role="tab"]');
    triggers.forEach((trigger) => observer.observe(trigger));
    const mutations = new MutationObserver(() => measure());
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
      className="pointer-events-none absolute left-0 top-0 z-0 rounded-full bg-foreground opacity-0"
      style={{
        transitionProperty: "transform, width, opacity",
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
      "focus-visible:outline-none ",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
