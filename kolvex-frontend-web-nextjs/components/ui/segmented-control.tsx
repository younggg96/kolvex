"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * iOS-style segmented control.
 *
 * Instead of each segment fading its own background in and out, one thumb
 * glides between segments. As in UISegmentedControl the thumb keeps the pill's
 * radius, so it grows or shrinks when the neighbouring option changes width
 * rather than only sliding; the labels stay put and the thumb springs back
 * under the finger after a selection.
 *
 * The thumb is an `aria-hidden` span inside the group, so assistive tech still
 * sees plain buttons with their pressed/selected state.
 */

type Size = "sm" | "md";

const SIZES: Record<Size, { item: string; gap: string; thumbPress: string }> = {
  sm: {
    item: "min-h-8 px-3 text-[0.8125rem]",
    gap: "gap-0.5",
    thumbPress: "scale-y-[0.88]",
  },
  md: {
    item: "min-h-10 px-4 text-sm",
    gap: "gap-1",
    thumbPress: "scale-y-[0.9]",
  },
};

type Thumb = { left: number; top: number; width: number; height: number };

type Bind = (active: boolean) => Record<string, unknown>;

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Read by screen readers; falls back to the plain label. */
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "children"> {
  options: readonly SegmentedOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  size?: Size;
  className?: string;
  itemClassName?: string;
  /**
   * `single` is a one-of-many choice (`aria-pressed`); `tabs`, `radio` and
   * `nav` map to the matching WAI-ARIA patterns for switchers that behave
   * like navigation.
   */
  semantics?: "single" | "tabs" | "radio" | "nav";
  /** Omit the outer glass track and paint only the thumb. */
  bare?: boolean;
  /** Let the pill wrap instead of forcing one row (wide label sets). */
  wrap?: boolean;
}

/** Critically damped spring from app/globals.css (`--spring`). */
const EASE = "var(--spring)";
/** Longer than the glide so a fast tap still reads as a distinct press. */
const PRESS_MS = 320;

const BINDS: Record<
  NonNullable<SegmentedControlProps<string>["semantics"]>,
  { group: string | undefined; item: string | undefined; bind: Bind }
> = {
  single: {
    group: undefined,
    item: undefined,
    bind: (active) => ({ "aria-pressed": active }),
  },
  tabs: {
    group: "tablist",
    item: "tab",
    bind: (active) => ({ "aria-selected": active }),
  },
  radio: {
    group: "radiogroup",
    item: "radio",
    bind: (active) => ({ "aria-checked": active }),
  },
  nav: {
    group: "navigation",
    item: undefined,
    bind: (active) => ({ "aria-current": active ? "page" : undefined }),
  },
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
  itemClassName,
  semantics = "single",
  bare = false,
  wrap = false,
  ...rest
}: SegmentedControlProps<T>) {
  const controlRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef(new Map<T, HTMLButtonElement>());
  const settle = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [thumb, setThumb] = React.useState<Thumb | null>(null);
  const [ready, setReady] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  const measure = React.useCallback(() => {
    const target = value == null ? null : itemRefs.current.get(value);
    if (!target) {
      setThumb(null);
      return;
    }
    const next: Thumb = {
      left: target.offsetLeft,
      top: target.offsetTop,
      width: target.offsetWidth,
      height: target.offsetHeight,
    };
    setThumb((current) =>
      current &&
      current.left === next.left &&
      current.top === next.top &&
      current.width === next.width &&
      current.height === next.height
        ? current
        : next,
    );
  }, [value]);

  // Measure before paint so the thumb is already in place on first render;
  // transitions are armed one frame later to suppress an entry animation.
  React.useLayoutEffect(() => {
    measure();
  }, [measure, options.length, size, wrap]);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // A control wider than its screen scrolls so the chosen option is never clipped.
  const center = React.useCallback(
    (behavior: ScrollBehavior) => {
      const control = controlRef.current;
      const target = value == null ? null : itemRefs.current.get(value);
      if (!control || !target || control.scrollWidth <= control.clientWidth) return;
      control.scrollTo({
        left: target.offsetLeft - (control.clientWidth - target.offsetWidth) / 2,
        behavior,
      });
    },
    [value],
  );

  // Re-measure on reflow (fonts, responsive labels) and while the pill
  // scrolls, so the thumb never drifts off its segment.
  React.useLayoutEffect(() => {
    const control = controlRef.current;
    if (!control) return;
    let width = control.clientWidth;
    const onLayout = () => {
      measure();
      // A control can mount squeezed by a sibling that is about to leave, so
      // a centring done at that width has to be redone once it has its room.
      if (control.clientWidth !== width) {
        width = control.clientWidth;
        center("auto");
      }
    };
    const observer = new ResizeObserver(onLayout);
    observer.observe(control);
    for (const node of itemRefs.current.values()) observer.observe(node);
    control.addEventListener("scroll", onLayout, { passive: true });
    window.addEventListener("resize", onLayout);
    return () => {
      observer.disconnect();
      control.removeEventListener("scroll", onLayout);
      window.removeEventListener("resize", onLayout);
    };
  }, [center, measure, options.length]);

  const centeredValue = React.useRef(value);
  React.useEffect(() => {
    const changed = centeredValue.current !== value;
    centeredValue.current = value;
    center(changed && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto");
  }, [center, value]);

  React.useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  const select = (next: T) => {
    if (next === value) return;
    setPressed(true);
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => setPressed(false), PRESS_MS);
    onChange(next);
  };

  const move = (step: number | "first" | "last") => {
    const enabled = options.filter((option) => !option.disabled);
    if (!enabled.length) return;
    const index = enabled.findIndex((option) => option.value === value);
    const nextIndex =
      step === "first"
        ? 0
        : step === "last"
          ? enabled.length - 1
          : (index + step + enabled.length) % enabled.length;
    const next = enabled[nextIndex];
    itemRefs.current.get(next.value)?.focus();
    select(next.value);
  };

  const config = SIZES[size];
  const pattern = BINDS[semantics];
  const roving = semantics === "tabs" || semantics === "radio";
  const hasThumb = Boolean(thumb && thumb.width > 0 && thumb.height > 0);

  return (
    <div
      ref={controlRef}
      {...rest}
      role={pattern.group}
      aria-label={pattern.group ? label : undefined}
      data-slot="segmented-control"
      className={cn(
        "relative isolate inline-flex max-w-full shrink-0 items-center p-1",
        wrap ? "flex-wrap" : "flex-nowrap",
        config.gap,
        bare ? "" : "glass-track rounded-full",
        className,
      )}
      onKeyDown={(event) => {
        rest.onKeyDown?.(event);
        const key = event.key;
        const handled =
          key === "ArrowRight" || key === "ArrowDown"
            ? 1
            : key === "ArrowLeft" || key === "ArrowUp"
              ? -1
              : key === "Home"
                ? "first"
                : key === "End"
                  ? "last"
                  : null;
        if (handled === null) return;
        event.preventDefault();
        move(handled);
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-0 rounded-full glass-thumb",
          "transition-[transform,width,height] duration-300 ease-out motion-reduce:!transition-none",
          hasThumb ? "opacity-100" : "opacity-0",
          pressed && config.thumbPress,
        )}
        style={{
          width: thumb ? `${thumb.width}px` : 0,
          height: thumb ? `${thumb.height}px` : 0,
          transitionProperty: "transform, width, height, opacity",
          transitionDuration: ready ? `340ms, 340ms, 340ms, 0ms` : "0ms",
          transitionTimingFunction: ready
            ? `${EASE}, ${EASE}, ${EASE}, ${EASE}`
            : "linear",
          transform: `translate3d(${thumb?.left ?? 0}px, ${thumb?.top ?? 0}px, 0)`,
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) itemRefs.current.set(option.value, node);
              else itemRefs.current.delete(option.value);
            }}
            type="button"
            role={pattern.item}
            {...pattern.bind(active)}
            aria-label={option.ariaLabel}
            title={option.title}
            disabled={option.disabled}
            tabIndex={roving && !active ? -1 : undefined}
            onClick={() => {
              // Re-picking the active segment still matters for tab/nav
              // switchers, so forward it instead of swallowing the click.
              if (active && semantics !== "single") {
                onChange(option.value);
                return;
              }
              select(option.value);
            }}
            className={cn(
              // The thumb is a GPU layer (translate3d); inside a scrolling
              // pill iOS WebKit paints it over non-composited labels despite
              // z-index, hiding the selected label. Lift the labels too.
              "relative z-10 inline-flex shrink-0 select-none items-center justify-center gap-1.5 [transform:translateZ(0)]",
              "whitespace-nowrap rounded-full font-semibold",
              "transition-colors duration-200 ease-out",
              "focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4",
              "disabled:pointer-events-none disabled:opacity-40",
              config.item,
              active
                ? cn(
                    "text-glass-thumb-foreground",
                    hasThumb
                      ? "bg-transparent focus-visible:bg-transparent"
                      : "bg-glass-thumb focus-visible:bg-glass-thumb",
                  )
                : "text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground",
              itemClassName,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
