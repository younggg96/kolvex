import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Canonical list-card shell. The Markets "Stock watch" card is the reference:
 * one 24px card on the page background, 12–16px inner padding, controls and
 * column headings inside the card, hoverable rows, and footer actions.
 * Every collection list (watchlist, KOL opinions, X, Reddit, news, holdings…)
 * uses this shell so lists read as the same surface across the workspace.
 */
export const ListCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <Card
    ref={ref}
    className={cn("min-w-0 p-3 sm:p-4", className)}
    {...props}
  />
));
ListCard.displayName = "ListCard";

/** Title row for a list card: label/scope on the start side, count/sort on the end side. */
export function ListToolbar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Column headings above the rows. Visual only; each row repeats its own labels. */
export function ListColumnHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex items-center gap-1 border-b border-border pr-2 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The list body. Rows control their own dividers; the canonical card keeps none. */
export function ListRows({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("min-w-0", className)} {...props} />;
}

/**
 * A hoverable list row matching the Markets stock rows. The trailing action
 * (watch star, disclosure) sits beside the row target, never nested inside it.
 */
export const ListRow = React.forwardRef<
  HTMLLIElement,
  React.LiHTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn(
      "flex items-center gap-1 rounded-2xl pr-2 transition-colors hover:bg-muted/50 focus-within:bg-muted/50 motion-reduce:transition-none",
      className,
    )}
    {...props}
  />
));
ListRow.displayName = "ListRow";

/**
 * Shared classes for the primary link/button that fills a ListRow. The consumer
 * adds its own display/grid classes so stock rows, feed rows and compact rails
 * can all share the same height, corner and focus treatment.
 */
export const listRowTargetClass =
  "min-h-20 min-w-0 flex-1 items-center rounded-2xl px-2 py-4 focus-visible:bg-transparent focus-visible:outline-none";

/** Long-reading rows (opinions, posts) keep a hairline so prose stays scannable. */
export const listFeedRowClass =
  "min-w-0 border-b border-border py-6 first:pt-2 last:border-0 [overflow-wrap:anywhere]";

/** Centered "load more" footer of a list card. */
export function ListLoadMore({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <div className="flex justify-center py-4">
      <Button
        variant="outline"
        size="sm"
        className={cn("min-h-11", className)}
        {...props}
      >
        {children}
      </Button>
    </div>
  );
}

/** Top-divided footer link inside a list card, e.g. "View all opinions". */
export function ListFooterLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "mt-2 flex min-h-11 items-center justify-between gap-3 border-t border-border px-1 pt-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none",
        className,
      )}
    >
      {children}
      <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}

/** Compact row for secondary rails (holdings, recent changes) inside a list card. */
export const listCompactRowClass =
  "flex min-h-11 items-center justify-between gap-3 rounded-2xl px-1 py-2.5 text-sm transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none";
