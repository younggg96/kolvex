"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, UsersRound } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { PersonUpdatePerson } from "@/lib/personUpdates";
import { cn } from "@/lib/utils";

export function PersonUpdatesPeopleRail({
  people,
  selected,
  onSelect,
}: {
  people: PersonUpdatePerson[];
  selected: string;
  onSelect: (name: string) => void;
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
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    return () => observer.disconnect();
  }, [people.length, updateEdges]);

  useEffect(() => {
    const element = rail.current;
    const active = element?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
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

  const allPeople = c("All people", "全部人物");

  return (
    <div className="relative min-w-0">
      <div
        ref={rail}
        onScroll={updateEdges}
        className="overflow-x-auto overscroll-x-contain px-1 py-1"
      >
        <ul className="flex w-max min-w-full items-start gap-2" aria-label={c("People", "人物")}>
          {[{ name: "", label: allPeople, avatar: null, newCount: 0 }, ...people].map((person) => {
            const isSelected = selected === person.name;
            const recentLabel = c(
              `${person.newCount} new ${person.newCount === 1 ? "update" : "updates"} in the past 24 hours`,
              `近 24 小时 ${person.newCount} 条新动态`,
            );
            return (
              <li key={person.name} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  title={person.newCount ? `${person.label} · ${recentLabel}` : person.label}
                  onClick={() => onSelect(person.name)}
                  className={cn(
                    "flex w-[4.75rem] flex-col items-center gap-2 rounded-2xl px-1 py-2 text-xs transition-colors hover:bg-foreground/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none",
                    isSelected
                      ? "bg-foreground/[0.08] font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="relative">
                    <span
                      className={cn(
                        "block rounded-full border-2 p-0.5",
                        person.newCount ? "border-primary" : "border-transparent",
                      )}
                    >
                      <Avatar aria-hidden="true" className="h-11 w-11">
                        {person.avatar && (
                          <AvatarImage
                            src={person.avatar}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="object-cover"
                          />
                        )}
                        <AvatarFallback className="bg-foreground/[0.08] text-sm font-semibold text-foreground">
                          {person.name ? (
                            Array.from(person.label)[0]
                          ) : (
                            <UsersRound className="size-5" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                    </span>
                    {person.newCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-1 -top-1 min-w-5 rounded-full border border-background bg-primary px-1 text-center text-[10px] font-semibold leading-[1.05rem] tabular-nums text-primary-foreground"
                      >
                        {person.newCount > 99 ? "99+" : person.newCount}
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate">{person.label}</span>
                  {person.newCount > 0 && <span className="sr-only">{recentLabel}</span>}
                </button>
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
          aria-label={c("Scroll people left", "向左浏览人物")}
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
          aria-label={c("Scroll people right", "向右浏览人物")}
          onClick={() => scroll(1)}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      )}
    </div>
  );
}
