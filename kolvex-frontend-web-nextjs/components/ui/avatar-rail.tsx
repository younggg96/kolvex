"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { listRevealClass } from "@/components/ui/list-card";
import { cn } from "@/lib/utils";

export interface AvatarRailItem {
  id: string;
  label: string;
  avatar: ReactNode;
  href?: string;
  badge?: { text: string; label: string };
}

export function AvatarRail({
  items,
  label,
  selected,
  onSelect,
}: {
  items: AvatarRailItem[];
  label: string;
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const c = useCopy();
  const rail = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);

  const updateEdges = useCallback(() => {
    const element = rail.current;
    if (!element) return;
    setLeft(element.scrollLeft > 1);
    setRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    updateEdges();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    return () => observer.disconnect();
  }, [items.length, updateEdges]);

  useEffect(() => {
    const element = rail.current;
    const active = element?.querySelector<HTMLElement>('[data-avatar-selected="true"]');
    if (!element || !active) return;
    const bounds = element.getBoundingClientRect();
    const buttonBounds = active.getBoundingClientRect();
    if (buttonBounds.left < bounds.left) element.scrollLeft += buttonBounds.left - bounds.left;
    else if (buttonBounds.right > bounds.right)
      element.scrollLeft += buttonBounds.right - bounds.right;
  }, [selected]);

  function scroll(direction: number) {
    const element = rail.current;
    if (!element) return;
    element.scrollBy({
      left: direction * element.clientWidth * 0.75,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  return (
    <div className="relative min-w-0">
      <div
        ref={rail}
        onScroll={updateEdges}
        className="overflow-x-auto overscroll-x-contain px-1 py-1"
      >
        <ul className="flex w-max min-w-full items-start gap-2" aria-label={label}>
          {items.map((item) => {
            const isSelected = selected === item.id;
            const itemProps = {
              "data-avatar-selected": isSelected,
              title: item.badge ? `${item.label} · ${item.badge.label}` : item.label,
              className: cn(
                "group/avatar flex w-[4.75rem] flex-col items-center gap-2 rounded-2xl px-1 py-2 text-xs transition-colors hover:bg-foreground/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none",
                isSelected
                  ? "bg-foreground/[0.08] font-semibold text-foreground"
                  : "text-muted-foreground",
              ),
            };
            const content = (
              <>
                <span className="relative" aria-hidden="true">
                  <span
                    className={cn(
                      "flex size-[3.25rem] items-center justify-center rounded-full border-2 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:group-active/avatar:scale-95",
                      item.badge ? "border-primary" : "border-transparent",
                      isSelected && "motion-safe:scale-105",
                    )}
                  >
                    {item.avatar}
                  </span>
                  {item.badge && (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full border border-background bg-primary px-1 text-center text-[10px] font-semibold leading-[1.05rem] tabular-nums text-primary-foreground">
                      {item.badge.text}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 w-full leading-4 [overflow-wrap:anywhere]">
                  {item.label}
                </span>
                {item.badge && <span className="sr-only">{item.badge.label}</span>}
              </>
            );
            return (
              <li key={item.id} className={cn("shrink-0", listRevealClass)}>
                {item.href ? (
                  <a
                    {...itemProps}
                    href={item.href}
                    aria-current={isSelected ? "true" : undefined}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      onSelect(item.id);
                    }}
                  >
                    {content}
                  </a>
                ) : (
                  <button
                    {...itemProps}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(item.id)}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {left && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute left-0 top-5 z-10 hidden rounded-full bg-background lg:inline-flex"
          aria-label={c("Scroll left", "向左浏览")}
          onClick={() => scroll(-1)}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
      )}
      {right && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute right-0 top-5 z-10 hidden rounded-full bg-background lg:inline-flex"
          aria-label={c("Scroll right", "向右浏览")}
          onClick={() => scroll(1)}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      )}
    </div>
  );
}
