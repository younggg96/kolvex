"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SPRING_RESPONSE,
  VelocityTracker,
  animateSpring,
  projectRelease,
  rubberBand,
  type SpringAnimation,
} from "@/lib/motion/spring";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = {
  side: {
    top: "inset-x-0 top-0 border-b data-[state=closed]:animate-slide-out-to-top data-[state=open]:animate-slide-in-from-top",
    bottom:
      "inset-x-0 bottom-0 border-t data-[state=closed]:animate-slide-out-to-bottom data-[state=open]:animate-slide-in-from-bottom",
    left: "inset-y-0 left-0 h-full w-3/4 data-[state=closed]:animate-slide-out-to-left data-[state=open]:animate-slide-in-from-left sm:max-w-sm",
    right:
      "inset-y-0 right-0 h-full w-3/4 data-[state=closed]:animate-slide-out-to-right data-[state=open]:animate-slide-in-from-right sm:max-w-sm",
  },
};

type Side = "top" | "bottom" | "left" | "right";

/** Drags that start on a field or inside something that scrolls sideways belong to it, not the sheet. */
function ownsHorizontalDrag(target: EventTarget | null, root: HTMLElement) {
  for (let node = target as HTMLElement | null; node && node !== root; node = node.parentElement) {
    if (node.matches("input, textarea, select, [contenteditable='true'], [data-sheet-no-drag]")) return true;
    const overflow = getComputedStyle(node).overflowX;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollWidth > node.clientWidth) return true;
  }
  return false;
}

/**
 * Swipe a side sheet toward its edge to dismiss it. The sheet follows the finger; pulling the
 * other way stretches with a rubber band. On release the critically damped spring keeps the
 * hand's speed: a flick (or a drag past half the width) carries the sheet out and closes it,
 * anything else springs back. Vertical scrolling inside the sheet is untouched.
 */
function useSwipeToDismiss(side: Side) {
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const drag = React.useRef<{ id: number; x: number; y: number; active: boolean; offset: number } | null>(null);
  const tracker = React.useRef(new VelocityTracker());
  const spring = React.useRef<SpringAnimation | null>(null);
  const swallowClick = React.useRef(false);
  const enabled = side === "left" || side === "right";
  const closing = side === "right" ? 1 : -1;

  React.useEffect(() => () => spring.current?.stop(), []);

  const place = (x: number) => {
    const el = contentRef.current;
    if (el) el.style.transform = Math.abs(x) < 0.5 ? "" : `translate3d(${x}px, 0, 0)`;
  };

  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    const el = contentRef.current;
    if (!d?.active || !el) return;
    swallowClick.current = true;
    const width = el.offsetWidth || 1;
    const velocity = event.type === "pointercancel" ? 0 : tracker.current.velocity(event.timeStamp);
    const dismiss = projectRelease(d.offset, velocity) * closing > width * 0.5;
    spring.current = animateSpring({
      from: d.offset,
      to: dismiss ? closing * width : 0,
      velocity,
      response: SPRING_RESPONSE.standard,
      precision: 0.5,
      onUpdate: place,
      onComplete: () => {
        spring.current = null;
        if (!dismiss) return;
        // Already off screen: skip the keyframe exit so it does not restart from the edge.
        el.style.animation = "none";
        closeRef.current?.click();
      },
    });
  };

  const handlers = enabled
    ? {
        onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
          const el = contentRef.current;
          if (!el || event.button !== 0 || ownsHorizontalDrag(event.target, el)) return;
          spring.current?.stop();
          tracker.current.reset();
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false, offset: 0 };
        },
        onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
          const d = drag.current;
          const el = contentRef.current;
          if (!d || !el || d.id !== event.pointerId) return;
          const dx = event.clientX - d.x;
          if (!d.active) {
            const dy = event.clientY - d.y;
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            if (Math.abs(dx) <= Math.abs(dy) * 1.2) {
              drag.current = null;
              return;
            }
            d.active = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          const width = el.offsetWidth || 1;
          d.offset = dx * closing >= 0 ? dx : rubberBand(dx, width);
          tracker.current.add(d.offset, event.timeStamp);
          place(d.offset);
        },
        onPointerUp: release,
        onPointerCancel: release,
        onClickCapture(event: React.MouseEvent<HTMLDivElement>) {
          // The click that ends a drag is not a tap on whatever sits under the finger.
          if (!swallowClick.current) return;
          swallowClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        },
      }
    : {};

  return { contentRef, closeRef, handlers, enabled };
}

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (value: T) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value);
      else if (ref) (ref as React.MutableRefObject<T>).current = value;
    }
  };
}

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  side?: Side;
  closeLabel?: string;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", closeLabel = "Close", className, children, ...props }, ref) => {
  const swipe = useSwipeToDismiss(side);
  const call = <E,>(own?: (event: E) => void, theirs?: (event: E) => void) =>
    own || theirs ? (event: E) => { theirs?.(event); own?.(event); } : undefined;
  return (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={mergeRefs(ref, swipe.contentRef)}
      className={cn(
        "surface-overlay fixed z-50 gap-4 pt-8 !p-0 sm:p-6",
        sheetVariants.side[side],
        swipe.enabled && "touch-pan-y",
        className
      )}
      {...props}
      onPointerDown={call(swipe.handlers.onPointerDown, props.onPointerDown)}
      onPointerMove={call(swipe.handlers.onPointerMove, props.onPointerMove)}
      onPointerUp={call(swipe.handlers.onPointerUp, props.onPointerUp)}
      onPointerCancel={call(swipe.handlers.onPointerCancel, props.onPointerCancel)}
      onClickCapture={call(swipe.handlers.onClickCapture, props.onClickCapture)}
    >
      {children}
      <SheetPrimitive.Close ref={swipe.closeRef} className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground opacity-80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground hover:opacity-100 focus:outline-none disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">{closeLabel}</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
  );
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold text-foreground",
      className
    )}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
